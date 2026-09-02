import "server-only";

import type { JWK } from "jose";
import type postgres from "postgres";
import QRCode from "qrcode";
import { z } from "zod";
import { DomainError } from "@egocapture/core/domain/errors";
import {
  createMarkerPayload,
  markerShortCode,
  markerUri,
  signMarkerPayload,
} from "@egocapture/core/domain/marker";
import { createPublicId } from "@egocapture/core/domain/public-id";
import { writeAudit } from "@egocapture/core/server/audit";
import type { Viewer } from "@egocapture/core/server/auth";
import { decodeCreatedAtCursor, encodeCreatedAtCursor } from "@egocapture/core/server/cursor";
import { database } from "@egocapture/core/server/database";
import { serverEnvironment } from "@egocapture/core/server/env";
import { withIdempotency } from "@egocapture/core/server/idempotency";

const assignmentPublicIdSchema = z.string().regex(/^AS-[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{6,16}$/);
const devicePublicIdSchema = z.string().regex(/^DEV-[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{6,16}$/);

export const createSessionSchema = z.object({
  assignmentPublicId: assignmentPublicIdSchema,
  devicePublicId: devicePublicIdSchema,
});

export const sessionReasonSchema = z.object({ reason: z.string().trim().min(10).max(500) });

export const adminSessionListSchema = z.object({
  search: z.string().trim().max(160).optional(),
  status: z.enum(["open", "closed", "all"]).optional(),
  cursor: z.string().max(512).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

async function createSignedMarker(input: {
  sessionPublicId: string;
  assignmentPublicId: string;
  devicePublicId: string;
}) {
  const environment = serverEnvironment();
  const payload = createMarkerPayload(input);
  const jws = await signMarkerPayload(
    payload,
    environment.MARKER_PRIVATE_KEY_JWK as JWK,
    environment.MARKER_KEY_ID,
  );
  return { payload, jws, keyId: environment.MARKER_KEY_ID };
}

export async function listParticipantDevices(viewer: Viewer) {
  const db = database();
  return await db<{
    publicId: string;
    manufacturer: string;
    model: string;
    deviceType: string;
    status: string;
    isDefault: boolean;
  }[]>`
    select distinct
      device.public_id,
      device.manufacturer,
      device.model,
      device.device_type,
      device.status,
      participant.default_device_id = device.id as is_default
    from egocapture.participants participant
    join egocapture.devices device on true
    left join egocapture.device_assignments assignment on assignment.device_id = device.id
      and assignment.participant_id = participant.id and assignment.ended_at is null
    where participant.auth_user_id = ${viewer.authUserId}::uuid
      and device.status in ('active', 'shared')
      and (device.status = 'shared' or assignment.id is not null)
    order by is_default desc, device.manufacturer, device.model
  `;
}

export async function createSession(
  viewer: Viewer,
  input: z.infer<typeof createSessionSchema>,
  idempotencyKey: string,
  requestId: string,
) {
  const db = database();
  return await db.begin(async (transaction) => await withIdempotency(transaction, {
    actorAuthUserId: viewer.authUserId,
    commandName: "session.create",
    idempotencyKey,
    input,
    execute: async () => {
      const [authority] = await transaction<{
        assignmentId: string;
        assignmentPublicId: string;
        assignmentStatus: string;
        participantId: string;
        participantStatus: string;
        consentStatus: string;
        taskVersionId: string;
        timezone: string;
      }[]>`
        select
          assignment.id as assignment_id,
          assignment.public_id as assignment_public_id,
          assignment.status as assignment_status,
          participant.id as participant_id,
          participant.status as participant_status,
          participant.consent_status,
          assignment.task_version_id,
          participant.timezone
        from egocapture.assignments assignment
        join egocapture.participants participant on participant.id = assignment.participant_id
        where assignment.public_id = ${input.assignmentPublicId}
          and participant.auth_user_id = ${viewer.authUserId}::uuid
        for update of assignment, participant
      `;
      if (!authority) throw new DomainError("NOT_FOUND", "Assignment 或资源不存在", 404);
      if (authority.participantStatus !== "active" || authority.consentStatus !== "valid") {
        throw new DomainError("PARTICIPANT_NOT_ELIGIBLE", "当前账号不能创建 Recording Session", 403);
      }
      if (!["acknowledged", "session_created", "rework_required"].includes(authority.assignmentStatus)) {
        throw new DomainError("INVALID_ASSIGNMENT_STATE", "请先确认任务，或当前 Assignment 已关闭", 409);
      }
      const [device] = await transaction<{ id: string; publicId: string }[]>`
        select device.id, device.public_id
        from egocapture.devices device
        where device.public_id = ${input.devicePublicId}
          and device.status in ('active', 'shared')
          and (
            device.status = 'shared'
            or exists (
              select 1 from egocapture.device_assignments device_assignment
              where device_assignment.device_id = device.id
                and device_assignment.participant_id = ${authority.participantId}::uuid
                and device_assignment.ended_at is null
            )
          )
      `;
      if (!device) throw new DomainError("DEVICE_NOT_AVAILABLE", "Device 未分配给当前 Participant", 422);
      const sessionPublicId = createPublicId("RS");
      const [session] = await transaction<{ id: string; publicId: string }[]>`
        insert into egocapture.recording_sessions (
          public_id, assignment_id, participant_id, task_version_id,
          declared_device_id, timezone
        ) values (
          ${sessionPublicId}, ${authority.assignmentId}::uuid, ${authority.participantId}::uuid,
          ${authority.taskVersionId}::uuid, ${device.id}::uuid, ${authority.timezone}
        ) returning id, public_id
      `;
      const marker = await createSignedMarker({
        sessionPublicId: session.publicId,
        assignmentPublicId: authority.assignmentPublicId,
        devicePublicId: device.publicId,
      });
      await transaction`
        insert into egocapture.session_markers (
          session_id, marker_jws, payload, key_id, nonce, issued_at, expires_at
        ) values (
          ${session.id}::uuid, ${marker.jws}, ${transaction.json(marker.payload)},
          ${marker.keyId}, ${marker.payload.nonce}, ${marker.payload.issued_at}, ${marker.payload.expires_at}
        )
      `;
      if (authority.assignmentStatus !== "session_created") {
        await transaction`
          update egocapture.assignments set status = 'session_created'
          where id = ${authority.assignmentId}::uuid
        `;
      }
      await writeAudit(transaction, {
        actorProfileId: viewer.profileId,
        actorAuthUserId: viewer.authUserId,
        action: "session.created",
        entityType: "recording_session",
        entityPublicId: session.publicId,
        requestId,
        afterValues: {
          assignmentPublicId: authority.assignmentPublicId,
          devicePublicId: device.publicId,
          markerExpiresAt: marker.payload.expires_at,
          keyId: marker.keyId,
        },
      });
      return {
        sessionPublicId: session.publicId,
        assignmentPublicId: authority.assignmentPublicId,
        devicePublicId: device.publicId,
        markerExpiresAt: marker.payload.expires_at,
      };
    },
  }));
}

async function participantSession(
  db: postgres.Sql | postgres.TransactionSql,
  viewer: Viewer,
  sessionPublicId: string,
  forUpdate = false,
) {
  const rows = await db<{
    id: string;
    publicId: string;
    status: "open" | "closed";
    assignmentId: string;
    assignmentPublicId: string;
    assignmentStatus: string;
    devicePublicId: string;
    participantStatus: string;
    consentStatus: string;
    markerAcknowledgedAt: Date | null;
  }[]>`
    select
      session.id,
      session.public_id,
      session.status,
      session.assignment_id,
      assignment.public_id as assignment_public_id,
      assignment.status as assignment_status,
      device.public_id as device_public_id,
      participant.status as participant_status,
      participant.consent_status,
      session.marker_acknowledged_at
    from egocapture.recording_sessions session
    join egocapture.assignments assignment on assignment.id = session.assignment_id
    join egocapture.participants participant on participant.id = session.participant_id
    join egocapture.devices device on device.id = session.declared_device_id
    where session.public_id = ${sessionPublicId}
      and participant.auth_user_id = ${viewer.authUserId}::uuid
    limit 1
    ${forUpdate ? db`for update of session, assignment, participant` : db``}
  `;
  const session = rows[0];
  if (!session) throw new DomainError("NOT_FOUND", "Recording Session 或资源不存在", 404);
  return session;
}

export async function listParticipantSessions(viewer: Viewer, assignmentPublicId?: string) {
  const db = database();
  return await db<{
    publicId: string;
    assignmentPublicId: string;
    taskTitle: string;
    devicePublicId: string;
    deviceLabel: string;
    status: string;
    markerAcknowledgedAt: Date | null;
    createdAt: Date;
  }[]>`
    select
      session.public_id,
      assignment.public_id as assignment_public_id,
      version.instructions ->> 'title' as task_title,
      device.public_id as device_public_id,
      device.manufacturer || ' ' || device.model as device_label,
      session.status,
      session.marker_acknowledged_at,
      session.created_at
    from egocapture.recording_sessions session
    join egocapture.assignments assignment on assignment.id = session.assignment_id
    join egocapture.task_versions version on version.id = session.task_version_id
    join egocapture.participants participant on participant.id = session.participant_id
    join egocapture.devices device on device.id = session.declared_device_id
    where participant.auth_user_id = ${viewer.authUserId}::uuid
      and (${assignmentPublicId ?? null}::text is null or assignment.public_id = ${assignmentPublicId ?? ""})
    order by session.created_at desc
  `;
}

export async function getMarker(viewer: Viewer, sessionPublicId: string) {
  const db = database();
  const session = await participantSession(db, viewer, sessionPublicId);
  const [marker] = await db<{
    markerJws: string;
    keyId: string;
    issuedAt: Date;
    expiresAt: Date;
  }[]>`
    select marker_jws, key_id, issued_at, expires_at
    from egocapture.session_markers
    where session_id = ${session.id}::uuid
    order by issued_at desc, created_at desc
    limit 1
  `;
  if (!marker) throw new DomainError("MARKER_NOT_FOUND", "Marker 不存在", 404);
  const uri = markerUri(marker.markerJws);
  const qrDataUrl = await QRCode.toDataURL(uri, {
    type: "image/png",
    errorCorrectionLevel: "M",
    margin: 2,
    width: 900,
  });
  return {
    sessionPublicId: session.publicId,
    assignmentPublicId: session.assignmentPublicId,
    devicePublicId: session.devicePublicId,
    shortCode: markerShortCode(session.publicId),
    markerUri: uri,
    qrDataUrl,
    keyId: marker.keyId,
    issuedAt: marker.issuedAt.toISOString(),
    expiresAt: marker.expiresAt.toISOString(),
    markerAcknowledgedAt: session.markerAcknowledgedAt?.toISOString() ?? null,
    sessionStatus: session.status,
  };
}

export async function regenerateMarker(
  viewer: Viewer,
  sessionPublicId: string,
  idempotencyKey: string,
  requestId: string,
) {
  const db = database();
  return await db.begin(async (transaction) => await withIdempotency(transaction, {
    actorAuthUserId: viewer.authUserId,
    commandName: "session.marker.regenerate",
    idempotencyKey,
    input: { sessionPublicId },
    execute: async () => {
      const current = await participantSession(transaction, viewer, sessionPublicId, true);
      if (current.status !== "open" || ["accepted", "canceled"].includes(current.assignmentStatus)) {
        throw new DomainError("SESSION_CLOSED", "Recording Session 已关闭", 409);
      }
      if (current.participantStatus !== "active" || current.consentStatus !== "valid") {
        throw new DomainError("PARTICIPANT_NOT_ELIGIBLE", "当前账号不能重新生成 Marker", 403);
      }
      const marker = await createSignedMarker({
        sessionPublicId: current.publicId,
        assignmentPublicId: current.assignmentPublicId,
        devicePublicId: current.devicePublicId,
      });
      await transaction`
        insert into egocapture.session_markers (
          session_id, marker_jws, payload, key_id, nonce, issued_at, expires_at
        ) values (
          ${current.id}::uuid, ${marker.jws}, ${transaction.json(marker.payload)},
          ${marker.keyId}, ${marker.payload.nonce}, ${marker.payload.issued_at}, ${marker.payload.expires_at}
        )
      `;
      await writeAudit(transaction, {
        actorProfileId: viewer.profileId,
        actorAuthUserId: viewer.authUserId,
        action: "session.marker_regenerated",
        entityType: "recording_session",
        entityPublicId: current.publicId,
        requestId,
        afterValues: { expiresAt: marker.payload.expires_at, keyId: marker.keyId },
      });
      return { sessionPublicId: current.publicId, expiresAt: marker.payload.expires_at };
    },
  }));
}

export async function acknowledgeMarker(viewer: Viewer, sessionPublicId: string, requestId: string) {
  const db = database();
  return await db.begin(async (transaction) => {
    const session = await participantSession(transaction, viewer, sessionPublicId, true);
    if (session.status !== "open") throw new DomainError("SESSION_CLOSED", "Recording Session 已关闭", 409);
    if (session.participantStatus !== "active" || session.consentStatus !== "valid") {
      throw new DomainError("PARTICIPANT_NOT_ELIGIBLE", "当前账号不能确认 Marker", 403);
    }
    if (session.markerAcknowledgedAt) {
      return { sessionPublicId, acknowledgedAt: session.markerAcknowledgedAt.toISOString() };
    }
    const [updated] = await transaction<{ markerAcknowledgedAt: Date }[]>`
      update egocapture.recording_sessions
      set marker_acknowledged_at = now()
      where id = ${session.id}::uuid
      returning marker_acknowledged_at
    `;
    await writeAudit(transaction, {
      actorProfileId: viewer.profileId,
      actorAuthUserId: viewer.authUserId,
      action: "session.marker_acknowledged",
      entityType: "recording_session",
      entityPublicId: session.publicId,
      requestId,
      afterValues: { acknowledgedAt: updated.markerAcknowledgedAt.toISOString() },
    });
    return { sessionPublicId, acknowledgedAt: updated.markerAcknowledgedAt.toISOString() };
  });
}

export async function listAdminSessions(
  viewer: Viewer,
  input: z.infer<typeof adminSessionListSchema> = adminSessionListSchema.parse({}),
) {
  const cursor = decodeCreatedAtCursor(input.cursor);
  const db = database();
  const rows = await db<{
    publicId: string;
    assignmentPublicId: string;
    participantPublicId: string;
    participantAlias: string;
    taskTitle: string;
    taskPublicId: string;
    devicePublicId: string;
    deviceLabel: string;
    status: string;
    markerAcknowledgedAt: Date | null;
    closedAt: Date | null;
    matchedVideoCount: number;
    createdAt: Date;
  }[]>`
    select
      session.public_id,
      assignment.public_id as assignment_public_id,
      participant.public_id as participant_public_id,
      participant.display_alias as participant_alias,
      version.instructions ->> 'title' as task_title,
      task.public_id as task_public_id,
      device.public_id as device_public_id,
      device.manufacturer || ' ' || device.model as device_label,
      session.status,
      session.marker_acknowledged_at,
      session.closed_at,
      (select count(*)::integer
        from egocapture.current_match_decisions decision
        where decision.resolved_session_id = session.id) as matched_video_count,
      session.created_at
    from egocapture.recording_sessions session
    join egocapture.assignments assignment on assignment.id = session.assignment_id
    join egocapture.participants participant on participant.id = session.participant_id
    join egocapture.task_versions version on version.id = session.task_version_id
    join egocapture.tasks task on task.id = version.task_id
    join egocapture.devices device on device.id = session.declared_device_id
    where (${input.search ?? null}::text is null
        or session.public_id ilike '%' || ${input.search ?? ""} || '%'
        or assignment.public_id ilike '%' || ${input.search ?? ""} || '%'
        or participant.public_id ilike '%' || ${input.search ?? ""} || '%'
        or participant.display_alias ilike '%' || ${input.search ?? ""} || '%'
        or version.instructions ->> 'title' ilike '%' || ${input.search ?? ""} || '%')
      and (${input.status ?? null}::text is null or ${input.status ?? ""} = 'all' or session.status = ${input.status ?? ""})
      and (
        ${cursor?.createdAt ?? null}::timestamptz is null
        or (session.created_at, session.public_id) < (${cursor?.createdAt ?? null}::timestamptz, ${cursor?.publicId ?? ""})
      )
    order by session.created_at desc, session.public_id desc
    limit ${input.limit + 1}
  `;
  const hasMore = rows.length > input.limit;
  const items = rows.slice(0, input.limit);
  const last = items.at(-1);
  return {
    items,
    nextCursor: hasMore && last ? encodeCreatedAtCursor({ createdAt: last.createdAt, publicId: last.publicId }) : null,
  };
}

export async function closeSession(
  viewer: Viewer,
  sessionPublicId: string,
  reason: string,
  requestId: string,
) {
  const db = database();
  return await db.begin(async (transaction) => {
    const [session] = await transaction<{
      id: string;
      publicId: string;
      status: "open" | "closed";
    }[]>`
      select session.id, session.public_id, session.status
      from egocapture.recording_sessions session
      where session.public_id = ${sessionPublicId}
      for update of session
    `;
    if (!session) throw new DomainError("NOT_FOUND", "Recording Session 或资源不存在", 404);
    if (session.status === "closed") return { sessionPublicId, status: "closed" as const };
    await transaction`
      update egocapture.recording_sessions
      set status = 'closed', closed_at = now(), close_reason = ${reason}
      where id = ${session.id}::uuid
    `;
    await writeAudit(transaction, {
      actorProfileId: viewer.profileId,
      actorAuthUserId: viewer.authUserId,
      action: "session.closed",
      entityType: "recording_session",
      entityPublicId: session.publicId,
      reason,
      requestId,
      beforeValues: { status: "open" },
      afterValues: { status: "closed" },
    });
    return { sessionPublicId, status: "closed" as const };
  });
}
