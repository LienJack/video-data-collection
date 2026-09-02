import "server-only";

import { createHmac, randomUUID } from "node:crypto";
import { z } from "zod";
import { DomainError } from "@egocapture/core/domain/errors";
import {
  createInvitationToken,
  hashInvitationToken,
  internalParticipantEmail,
  invitationExpiresAt,
} from "@egocapture/core/domain/invitation";
import { assertParticipantTransition, type ParticipantStatus } from "@egocapture/core/domain/participant";
import { createPublicId } from "@egocapture/core/domain/public-id";
import {
  isCanonicalLocale,
  isSupportedCountryCode,
  isSupportedTimezone,
} from "@egocapture/core/domain/regional-preferences";
import { writeAudit } from "@egocapture/core/server/audit";
import type { Viewer } from "@egocapture/core/server/auth";
import { database } from "@egocapture/core/server/database";
import { serverEnvironment } from "@egocapture/core/server/env";
import { withIdempotency } from "@egocapture/core/server/idempotency";
import { createSupabaseAdminClient } from "@egocapture/core/server/supabase/admin";

const localeSchema = z.string().trim().min(2).max(20).refine(isCanonicalLocale, {
  message: "Locale 必须是规范的 BCP 47 标识",
});
const timezoneSchema = z.string().trim().min(3).max(64).refine(isSupportedTimezone, {
  message: "Timezone 必须是受支持的 IANA 时区",
});
const countryRegionSchema = z.string().trim().length(2).refine(isSupportedCountryCode, {
  message: "Country / Region 必须是受支持的 ISO 3166-1 alpha-2 代码",
});

export const createParticipantSchema = z.object({
  displayAlias: z.string().trim().min(1).max(120),
  managementEmail: z.string().trim().email().max(254).nullable().optional(),
  locale: localeSchema.default("zh-CN"),
  timezone: timezoneSchema.default("Asia/Shanghai"),
  countryRegion: countryRegionSchema.nullable().optional(),
  notes: z.string().trim().max(500).nullable().optional(),
});

export const participantListSchema = z.object({
  search: z.string().trim().max(120).optional(),
  status: z.enum(["draft", "invited", "expired", "active", "suspended", "withdrawn"]).optional(),
  consentStatus: z.enum(["pending", "valid", "expired", "withdrawn"]).optional(),
  locale: localeSchema.optional(),
  countryRegion: countryRegionSchema.optional(),
  missing: z.enum(["yes", "no"]).optional(),
  needsReview: z.enum(["yes", "no"]).optional(),
  cursor: z.string().regex(/^PT-[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{6,16}$/).optional(),
  limit: z.coerce.number().int().min(1).max(50).default(25),
});

export const participantReasonSchema = z.object({ reason: z.string().trim().min(10).max(500) });

export const updateParticipantSchema = z.object({
  displayAlias: z.string().trim().min(1).max(120).optional(),
  managementEmail: z.string().trim().email().max(254).nullable().optional(),
  locale: localeSchema.optional(),
  timezone: timezoneSchema.optional(),
  countryRegion: countryRegionSchema.nullable().optional(),
  notes: z.string().trim().max(500).nullable().optional(),
  expectedUpdatedAt: z.string().datetime(),
}).refine((value) => Object.keys(value).some((key) => key !== "expectedUpdatedAt"), {
  message: "至少提交一个修改字段",
});

export const deviceSchema = z.object({
  manufacturer: z.string().trim().min(1).max(80),
  model: z.string().trim().min(1).max(120),
  deviceType: z.enum(["phone", "action_camera", "camera", "other"]),
  serial: z.string().trim().min(1).max(160).nullable().optional(),
  firmwareVersion: z.string().trim().max(80).nullable().optional(),
  status: z.enum(["active", "shared"]).default("active"),
  setAsDefault: z.boolean().default(true),
});

export const updateDeviceSchema = z.object({
  firmwareVersion: z.string().trim().max(80).nullable().optional(),
  status: z.enum(["active", "lost", "retired", "shared"]).optional(),
  reason: z.string().trim().min(10).max(500),
  expectedUpdatedAt: z.string().datetime(),
}).refine((value) => value.firmwareVersion !== undefined || value.status !== undefined, {
  message: "至少提交一个修改字段",
});

type ParticipantRow = {
  id: string;
  publicId: string;
  status: ParticipantStatus;
  consentStatus: string;
  displayAlias: string;
  isFixture: boolean;
};

async function participantForAdmin(
  _viewer: Viewer,
  participantPublicId: string,
  options: { forUpdate?: boolean } = {},
) {
  const db = database();
  const rows = await db<ParticipantRow[]>`
    select
      participant.id,
      participant.public_id,
      participant.status,
      participant.consent_status,
      participant.display_alias,
      participant.is_fixture
    from egocapture.participants participant
    where participant.public_id = ${participantPublicId}
    limit 1
    ${options.forUpdate ? db`for update of participant` : db``}
  `;
  const participant = rows[0];
  if (!participant) throw new DomainError("NOT_FOUND", "Participant 或资源不存在", 404);
  return participant;
}

function protectFixture(viewer: Viewer, participant: ParticipantRow) {
  if (viewer.isDemoAdmin && participant.isFixture) {
    throw new DomainError("FIXTURE_PROTECTED", "公开 Demo 的系统账号不可执行该操作", 403);
  }
}

export async function listParticipants(_viewer: Viewer, input: z.infer<typeof participantListSchema>) {
  const db = database();
  const rows = await db<{
    publicId: string;
    displayAlias: string;
    status: ParticipantStatus;
    consentStatus: string;
    locale: string;
    countryRegion: string | null;
    isFixture: boolean;
    isMissing: boolean;
    needsReview: boolean;
  }[]>`
    select distinct
      participant.public_id,
      participant.display_alias,
      participant.status,
      participant.consent_status,
      participant.locale,
      participant.country_region,
      participant.is_fixture,
      exists (
        select 1 from egocapture.missing_assignments missing
        where missing.participant_id = participant.id
      ) as is_missing,
      exists (
        select 1
        from egocapture.review_cases review
        left join egocapture.assignments review_assignment on review_assignment.id = review.assignment_id
        left join egocapture.video_assets review_asset on review_asset.id = review.video_asset_id
        where review.status in ('open', 'in_review')
          and coalesce(review_assignment.participant_id, review_asset.participant_id) = participant.id
      ) as needs_review
    from egocapture.participants participant
    where (${input.search ?? null}::text is null or participant.public_id ilike '%' || ${input.search ?? ""} || '%' or participant.display_alias ilike '%' || ${input.search ?? ""} || '%')
      and (${input.status ?? null}::text is null or participant.status = ${input.status ?? ""})
      and (${input.consentStatus ?? null}::text is null or participant.consent_status = ${input.consentStatus ?? ""})
      and (${input.locale ?? null}::text is null or participant.locale = ${input.locale ?? ""})
      and (${input.countryRegion ?? null}::text is null or participant.country_region = ${input.countryRegion ?? ""})
      and (${input.missing ?? null}::text is null or exists (
        select 1 from egocapture.missing_assignments missing
        where missing.participant_id = participant.id
      ) = (${input.missing ?? "yes"} = 'yes'))
      and (${input.needsReview ?? null}::text is null or exists (
        select 1
        from egocapture.review_cases review
        left join egocapture.assignments review_assignment on review_assignment.id = review.assignment_id
        left join egocapture.video_assets review_asset on review_asset.id = review.video_asset_id
        where review.status in ('open', 'in_review')
          and coalesce(review_assignment.participant_id, review_asset.participant_id) = participant.id
      ) = (${input.needsReview ?? "yes"} = 'yes'))
      and (${input.cursor ?? null}::text is null or participant.public_id > ${input.cursor ?? ""})
    order by participant.public_id
    limit ${input.limit + 1}
  `;
  const hasNext = rows.length > input.limit;
  const data = rows.slice(0, input.limit);
  return { items: data, nextCursor: hasNext ? data.at(-1)?.publicId ?? null : null };
}

export async function getParticipant(viewer: Viewer, participantPublicId: string) {
  const participant = await participantForAdmin(viewer, participantPublicId);
  const db = database();
  const [detail] = await db<{
    publicId: string;
    displayAlias: string;
    managementEmail: string | null;
    status: ParticipantStatus;
    consentStatus: string;
    locale: string;
    timezone: string;
    countryRegion: string | null;
    notes: string | null;
    isFixture: boolean;
    defaultDevicePublicId: string | null;
    invitationStatus: string | null;
    invitationExpiresAt: Date | null;
    updatedAt: Date;
  }[]>`
    select
      participant.public_id,
      participant.display_alias,
      participant.management_email,
      participant.status,
      participant.consent_status,
      participant.locale,
      participant.timezone,
      participant.country_region,
      participant.notes,
      participant.is_fixture,
      device.public_id as default_device_public_id,
      invitation.status as invitation_status,
      invitation.expires_at as invitation_expires_at,
      participant.updated_at
    from egocapture.participants participant
    left join egocapture.devices device on device.id = participant.default_device_id
    left join lateral (
      select participant_invitation.status, participant_invitation.expires_at
      from egocapture.participant_invitations participant_invitation
      where participant_invitation.participant_id = participant.id
      order by participant_invitation.created_at desc
      limit 1
    ) invitation on true
    where participant.id = ${participant.id}::uuid
  `;
  return detail;
}

export async function updateParticipant(
  viewer: Viewer,
  participantPublicId: string,
  input: z.infer<typeof updateParticipantSchema>,
  requestId: string,
) {
  const db = database();
  return await db.begin(async (transaction) => {
    const [participant] = await transaction<(ParticipantRow & {
      updatedAt: Date;
      managementEmail: string | null;
      locale: string;
      timezone: string;
      countryRegion: string | null;
      notes: string | null;
    })[]>`
      select
        participant.id, participant.public_id, participant.status,
        participant.consent_status, participant.display_alias,
        participant.is_fixture, participant.updated_at, participant.management_email,
        participant.locale, participant.timezone, participant.country_region, participant.notes
      from egocapture.participants participant
      where participant.public_id = ${participantPublicId}
      for update of participant
    `;
    if (!participant) throw new DomainError("NOT_FOUND", "Participant 或资源不存在", 404);
    protectFixture(viewer, participant);
    if (participant.updatedAt.toISOString() !== input.expectedUpdatedAt) {
      throw new DomainError("STALE_WRITE", "Participant 已被其他操作更新，请刷新后重试", 409);
    }
    const next = {
      displayAlias: input.displayAlias ?? participant.displayAlias,
      managementEmail: input.managementEmail === undefined ? participant.managementEmail : input.managementEmail,
      locale: input.locale ?? participant.locale,
      timezone: input.timezone ?? participant.timezone,
      countryRegion: input.countryRegion === undefined ? participant.countryRegion : input.countryRegion,
      notes: input.notes === undefined ? participant.notes : input.notes,
    };
    const [updated] = await transaction<{ updatedAt: Date }[]>`
      update egocapture.participants
      set display_alias = ${next.displayAlias},
          management_email = ${next.managementEmail},
          locale = ${next.locale},
          timezone = ${next.timezone},
          country_region = ${next.countryRegion},
          notes = ${next.notes}
      where id = ${participant.id}::uuid
      returning updated_at
    `;
    await writeAudit(transaction, {
      actorProfileId: viewer.profileId,
      actorAuthUserId: viewer.authUserId,
      action: "participant.updated",
      entityType: "participant",
      entityPublicId: participant.publicId,
      requestId,
      beforeValues: {
        locale: participant.locale,
        timezone: participant.timezone,
        countryRegion: participant.countryRegion,
        managementEmailPresent: Boolean(participant.managementEmail),
        notesPresent: Boolean(participant.notes),
      },
      afterValues: {
        locale: next.locale,
        timezone: next.timezone,
        countryRegion: next.countryRegion,
        managementEmailPresent: Boolean(next.managementEmail),
        notesPresent: Boolean(next.notes),
        changedFields: Object.keys(input).filter((field) => field !== "expectedUpdatedAt"),
      },
    });
    return { participantPublicId, updatedAt: updated.updatedAt.toISOString() };
  });
}

export async function createParticipant(
  viewer: Viewer,
  input: z.infer<typeof createParticipantSchema>,
  idempotencyKey: string,
  requestId: string,
) {
  const db = database();
  return await db.begin(async (transaction) => await withIdempotency(transaction, {
    actorAuthUserId: viewer.authUserId,
    commandName: "participant.create",
    idempotencyKey,
    input,
    execute: async () => {
      if (viewer.isDemoAdmin) {
        const [usage] = await transaction<{ count: number }[]>`
          select count(*)::integer as count
          from egocapture.participants
          where not is_fixture
        `;
        if (usage.count >= 25) throw new DomainError("DEMO_PARTICIPANT_LIMIT", "公开 Demo 最多创建 25 个临时 Participant", 429);
      }
      const publicId = createPublicId("PT");
      const [participant] = await transaction<{ id: string; publicId: string }[]>`
        insert into egocapture.participants (
          public_id, display_alias, management_email, locale, timezone,
          country_region, notes, created_by
        ) values (
          ${publicId}, ${input.displayAlias}, ${input.managementEmail ?? null},
          ${input.locale}, ${input.timezone}, ${input.countryRegion ?? null},
          ${input.notes ?? null}, ${viewer.profileId}::uuid
        ) returning id, public_id
      `;
      await writeAudit(transaction, {
        actorProfileId: viewer.profileId,
        actorAuthUserId: viewer.authUserId,
        action: "participant.created",
        entityType: "participant",
        entityPublicId: participant.publicId,
        requestId,
        afterValues: { publicId: participant.publicId, status: "draft", consentStatus: "pending" },
      });
      return { participantPublicId: participant.publicId };
    },
  }));
}

export async function generateInvitation(
  viewer: Viewer,
  participantPublicId: string,
  idempotencyKey: string,
  requestId: string,
) {
  const db = database();
  const result = await db.begin(async (transaction) => await withIdempotency(transaction, {
    actorAuthUserId: viewer.authUserId,
    commandName: "participant.invitation.generate",
    idempotencyKey,
    input: { participantPublicId },
    receiptResponse: (response) => ({ expiresAt: response.expiresAt }),
    onReplay: () => {
      throw new DomainError(
        "INVITATION_ALREADY_GENERATED",
        "该命令已经执行；为避免保存明文 Token，请从 Participant 页面显式重新生成",
        409,
      );
    },
    execute: async () => {
      const [participant] = await transaction<ParticipantRow[]>`
        select
          participant.id, participant.public_id, participant.status,
          participant.consent_status, participant.display_alias,
          participant.is_fixture
        from egocapture.participants participant
        where participant.public_id = ${participantPublicId}
        for update of participant
      `;
      if (!participant) throw new DomainError("NOT_FOUND", "Participant 或资源不存在", 404);
      protectFixture(viewer, participant);
      if (!["draft", "invited", "expired"].includes(participant.status)) {
        throw new DomainError("INVALID_PARTICIPANT_STATE", "当前状态不能生成邀请", 409);
      }
      const invitation = createInvitationToken();
      const expiresAt = invitationExpiresAt();
      await transaction`
        update egocapture.participant_invitations
        set status = 'revoked', revoked_at = now()
        where participant_id = ${participant.id}::uuid and status in ('generated', 'opened')
      `;
      await transaction`
        insert into egocapture.participant_invitations (
          participant_id, token_hash, status, expires_at, created_by
        ) values (
          ${participant.id}::uuid, ${invitation.tokenHash}, 'generated', ${expiresAt}, ${viewer.profileId}::uuid
        )
      `;
      if (participant.status !== "invited") {
        await transaction`
          update egocapture.participants set status = 'invited' where id = ${participant.id}::uuid
        `;
      }
      await writeAudit(transaction, {
        actorProfileId: viewer.profileId,
        actorAuthUserId: viewer.authUserId,
        action: "participant.invitation_generated",
        entityType: "participant",
        entityPublicId: participant.publicId,
        requestId,
        beforeValues: { status: participant.status },
        afterValues: { status: "invited", invitationExpiresAt: expiresAt.toISOString() },
      });
      return { token: invitation.token, expiresAt: expiresAt.toISOString() };
    },
  }));
  return {
    invitationUrl: `${serverEnvironment().PARTICIPANT_SITE_URL}/invite/${result.token}`,
    expiresAt: result.expiresAt,
  };
}

export async function openInvitation(token: string) {
  if (!/^[A-Za-z0-9_-]{43}$/.test(token)) return false;
  const db = database();
  return await db.begin(async (transaction) => {
    const [invitation] = await transaction<{
      id: string;
      participantId: string;
      participantPublicId: string;
      participantStatus: ParticipantStatus;
      status: string;
      expiresAt: Date;
    }[]>`
      select
        invitation.id,
        invitation.participant_id,
        participant.public_id as participant_public_id,
        participant.status as participant_status,
        invitation.status,
        invitation.expires_at
      from egocapture.participant_invitations invitation
      join egocapture.participants participant on participant.id = invitation.participant_id
      where invitation.token_hash = ${hashInvitationToken(token)}
      for update of invitation, participant
    `;
    if (!invitation || !["generated", "opened"].includes(invitation.status)) return false;
    if (invitation.expiresAt <= new Date()) {
      await transaction`
        update egocapture.participant_invitations
        set status = 'expired'
        where id = ${invitation.id}::uuid
      `;
      if (invitation.participantStatus === "invited") {
        await transaction`
          update egocapture.participants set status = 'expired'
          where id = ${invitation.participantId}::uuid
        `;
      }
      await writeAudit(transaction, {
        actorProfileId: null,
        actorAuthUserId: null,
        action: "participant.invitation_expired",
        entityType: "participant",
        entityPublicId: invitation.participantPublicId,
        requestId: randomUUID(),
        beforeValues: { status: invitation.participantStatus, invitationStatus: invitation.status },
        afterValues: { status: "expired", invitationStatus: "expired" },
        metadata: { source: "invitation_page" },
      });
      return false;
    }
    await transaction`
      update egocapture.participant_invitations
      set opened_at = coalesce(opened_at, now()), status = 'opened'
      where id = ${invitation.id}::uuid
    `;
    return true;
  });
}

export async function revokeInvitation(
  viewer: Viewer,
  participantPublicId: string,
  reason: string,
  requestId: string,
) {
  const db = database();
  return await db.begin(async (transaction) => {
    const [participant] = await transaction<ParticipantRow[]>`
      select
        participant.id, participant.public_id, participant.status,
        participant.consent_status, participant.display_alias,
        participant.is_fixture
      from egocapture.participants participant
      where participant.public_id = ${participantPublicId}
      for update of participant
    `;
    if (!participant) throw new DomainError("NOT_FOUND", "Participant 或资源不存在", 404);
    protectFixture(viewer, participant);
    const revoked = await transaction`
      update egocapture.participant_invitations
      set status = 'revoked', revoked_at = now()
      where participant_id = ${participant.id}::uuid and status in ('generated', 'opened')
      returning id
    `;
    if (revoked.length === 0) {
      throw new DomainError("INVITATION_NOT_ACTIVE", "没有可撤销的有效邀请", 409);
    }
    const nextStatus = participant.status === "invited" ? "expired" : participant.status;
    if (nextStatus !== participant.status) {
      await transaction`
        update egocapture.participants set status = ${nextStatus}
        where id = ${participant.id}::uuid
      `;
    }
    await writeAudit(transaction, {
      actorProfileId: viewer.profileId,
      actorAuthUserId: viewer.authUserId,
      action: "participant.invitation_revoked",
      entityType: "participant",
      entityPublicId: participant.publicId,
      reason,
      requestId,
      beforeValues: { status: participant.status, invitationStatus: "active" },
      afterValues: { status: nextStatus, invitationStatus: "revoked" },
    });
    return { participantPublicId, status: nextStatus, invitationStatus: "revoked" as const };
  });
}

export async function acceptInvitation(token: string, password: string, requestId: string) {
  if (!/^[A-Za-z0-9_-]{43}$/.test(token)) {
    throw new DomainError("INVITATION_INVALID_OR_EXPIRED", "邀请无效或已过期", 400);
  }
  const db = database();
  const supabase = createSupabaseAdminClient();
  let createdAuthUserId: string | undefined;
  try {
    return await db.begin(async (transaction) => {
      const [invitation] = await transaction<ParticipantRow[]>`
        select
          participant.id, participant.public_id, participant.status,
          participant.consent_status, participant.display_alias,
          participant.is_fixture
        from egocapture.participant_invitations invitation
        join egocapture.participants participant on participant.id = invitation.participant_id
        where invitation.token_hash = ${hashInvitationToken(token)}
          and invitation.status in ('generated', 'opened')
          and invitation.expires_at > now()
        for update of invitation, participant
      `;
      if (!invitation || invitation.status !== "invited") {
        throw new DomainError("INVITATION_INVALID_OR_EXPIRED", "邀请无效或已过期", 400);
      }
      const email = internalParticipantEmail(invitation.publicId);
      const { data, error } = await supabase.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      });
      if (error || !data.user) throw new DomainError("INVITATION_ACCEPT_FAILED", "暂时无法接受邀请", 503);
      createdAuthUserId = data.user.id;
      const [profile] = await transaction<{ id: string }[]>`
        insert into egocapture.profiles (auth_user_id, role, display_name)
        values (${createdAuthUserId}::uuid, 'participant', ${invitation.displayAlias})
        returning id
      `;
      await transaction`
        update egocapture.participants
        set auth_user_id = ${createdAuthUserId}::uuid,
            status = 'active',
            consent_status = 'valid'
        where id = ${invitation.id}::uuid
      `;
      await transaction`
        update egocapture.participant_invitations
        set status = 'accepted', accepted_at = now(), opened_at = coalesce(opened_at, now())
        where token_hash = ${hashInvitationToken(token)}
      `;
      await transaction`
        insert into egocapture.consent_records (
          participant_id, status, recorded_by, accepted_at
        ) values (
          ${invitation.id}::uuid, 'accepted', ${profile.id}::uuid, now()
        )
      `;
      await writeAudit(transaction, {
        actorProfileId: profile.id,
        actorAuthUserId: createdAuthUserId,
        action: "participant.invitation_accepted",
        entityType: "participant",
        entityPublicId: invitation.publicId,
        requestId,
        beforeValues: { status: "invited", consentStatus: invitation.consentStatus },
        afterValues: { status: "active", consentStatus: "valid" },
      });
      return { participantPublicId: invitation.publicId };
    });
  } catch (error) {
    if (createdAuthUserId) await supabase.auth.admin.deleteUser(createdAuthUserId);
    throw error;
  }
}

export async function changeParticipantStatus(
  viewer: Viewer,
  participantPublicId: string,
  targetStatus: "suspended" | "active" | "withdrawn",
  reason: string,
  requestId: string,
) {
  const db = database();
  return await db.begin(async (transaction) => {
    const [participant] = await transaction<ParticipantRow[]>`
      select
        participant.id, participant.public_id, participant.status,
        participant.consent_status, participant.display_alias,
        participant.is_fixture
      from egocapture.participants participant
      where participant.public_id = ${participantPublicId}
      for update of participant
    `;
    if (!participant) throw new DomainError("NOT_FOUND", "Participant 或资源不存在", 404);
    protectFixture(viewer, participant);
    try {
      assertParticipantTransition(participant.status, targetStatus);
    } catch {
      throw new DomainError("INVALID_PARTICIPANT_STATE", "Participant 状态不允许该操作", 409);
    }
    if (targetStatus === "active" && participant.consentStatus !== "valid") {
      throw new DomainError("CONSENT_REQUIRED", "Consent 无效，不能恢复 Participant", 422);
    }
    await transaction`
      update egocapture.participants
      set status = ${targetStatus},
          consent_status = case when ${targetStatus} = 'withdrawn' then 'withdrawn' else consent_status end,
          withdrawn_at = case when ${targetStatus} = 'withdrawn' then now() else null end
      where id = ${participant.id}::uuid
    `;
    if (targetStatus === "withdrawn") {
      await transaction`
        insert into egocapture.consent_records (participant_id, status, recorded_by, reason)
        values (${participant.id}::uuid, 'withdrawn', ${viewer.profileId}::uuid, ${reason})
      `;
    }
    await writeAudit(transaction, {
      actorProfileId: viewer.profileId,
      actorAuthUserId: viewer.authUserId,
      action: `participant.${targetStatus}`,
      entityType: "participant",
      entityPublicId: participant.publicId,
      reason,
      requestId,
      beforeValues: { status: participant.status, consentStatus: participant.consentStatus },
      afterValues: {
        status: targetStatus,
        consentStatus: targetStatus === "withdrawn" ? "withdrawn" : participant.consentStatus,
      },
    });
    return { participantPublicId: participant.publicId, status: targetStatus };
  });
}

export async function listDevices(viewer: Viewer, participantPublicId: string) {
  const participant = await participantForAdmin(viewer, participantPublicId);
  const db = database();
  return await db<{
    publicId: string;
    manufacturer: string;
    model: string;
    deviceType: string;
    firmwareVersion: string | null;
    status: string;
    assignedAt: Date;
    isDefault: boolean;
    updatedAt: Date;
  }[]>`
    select
      device.public_id,
      device.manufacturer,
      device.model,
      device.device_type,
      device.firmware_version,
      device.status,
      assignment.assigned_at,
      participant.default_device_id = device.id as is_default,
      device.updated_at
    from egocapture.device_assignments assignment
    join egocapture.devices device on device.id = assignment.device_id
    join egocapture.participants participant on participant.id = assignment.participant_id
    where assignment.participant_id = ${participant.id}::uuid
      and assignment.ended_at is null
    order by assignment.assigned_at desc
  `;
}

export async function createDevice(
  viewer: Viewer,
  participantPublicId: string,
  input: z.infer<typeof deviceSchema>,
  idempotencyKey: string,
  requestId: string,
) {
  const participant = await participantForAdmin(viewer, participantPublicId);
  protectFixture(viewer, participant);
  if (participant.status === "withdrawn") {
    throw new DomainError("INVALID_PARTICIPANT_STATE", "Withdrawn Participant 不能登记新设备", 409);
  }
  const db = database();
  const serialHmac = input.serial
    ? createHmac("sha256", serverEnvironment().DEVICE_SERIAL_HMAC_KEY)
        .update(input.serial.trim().toUpperCase())
        .digest("hex")
    : null;
  return await db.begin(async (transaction) => await withIdempotency(transaction, {
    actorAuthUserId: viewer.authUserId,
    commandName: "participant.device.create",
    idempotencyKey,
    input: { ...input, serial: input.serial ? "[provided]" : null, participantPublicId },
    execute: async () => {
      const publicId = createPublicId("DEV");
      const [device] = await transaction<{ id: string; publicId: string }[]>`
        insert into egocapture.devices (
          public_id, manufacturer, model, device_type, serial_hmac, firmware_version, status
        ) values (
          ${publicId}, ${input.manufacturer}, ${input.model},
          ${input.deviceType}, ${serialHmac}, ${input.firmwareVersion ?? null}, ${input.status}
        ) returning id, public_id
      `;
      await transaction`
        insert into egocapture.device_assignments (device_id, participant_id, assigned_by)
        values (${device.id}::uuid, ${participant.id}::uuid, ${viewer.profileId}::uuid)
      `;
      if (input.setAsDefault) {
        await transaction`
          update egocapture.participants set default_device_id = ${device.id}::uuid
          where id = ${participant.id}::uuid
        `;
      }
      await writeAudit(transaction, {
        actorProfileId: viewer.profileId,
        actorAuthUserId: viewer.authUserId,
        action: "participant.device_created",
        entityType: "device",
        entityPublicId: device.publicId,
        requestId,
        afterValues: {
          participantPublicId,
          manufacturer: input.manufacturer,
          model: input.model,
          status: input.status,
          serialProvided: Boolean(input.serial),
        },
      });
      return { devicePublicId: device.publicId };
    },
  }));
}

export async function updateDevice(
  viewer: Viewer,
  devicePublicId: string,
  input: z.infer<typeof updateDeviceSchema>,
  requestId: string,
) {
  const db = database();
  return await db.begin(async (transaction) => {
    const [device] = await transaction<{
      id: string;
      publicId: string;
      firmwareVersion: string | null;
      status: "active" | "lost" | "retired" | "shared";
      isFixture: boolean;
      updatedAt: Date;
    }[]>`
      select
        device.id, device.public_id, device.firmware_version,
        device.status, device.is_fixture, device.updated_at
      from egocapture.devices device
      where device.public_id = ${devicePublicId}
      for update of device
    `;
    if (!device) throw new DomainError("NOT_FOUND", "Device 或资源不存在", 404);
    if (viewer.isDemoAdmin && device.isFixture) {
      throw new DomainError("FIXTURE_PROTECTED", "公开 Demo 的系统设备不可修改", 403);
    }
    if (device.updatedAt.toISOString() !== input.expectedUpdatedAt) {
      throw new DomainError("STALE_WRITE", "Device 已被其他操作更新，请刷新后重试", 409);
    }
    if (device.status === "retired" && input.status && input.status !== "retired") {
      throw new DomainError("INVALID_DEVICE_STATE", "Retired Device 不能恢复", 409);
    }
    const nextStatus = input.status ?? device.status;
    const nextFirmware = input.firmwareVersion === undefined ? device.firmwareVersion : input.firmwareVersion;
    const [updated] = await transaction<{ updatedAt: Date }[]>`
      update egocapture.devices
      set status = ${nextStatus},
          firmware_version = ${nextFirmware},
          retired_at = case when ${nextStatus} = 'retired' then coalesce(retired_at, now()) else null end
      where id = ${device.id}::uuid
      returning updated_at
    `;
    await writeAudit(transaction, {
      actorProfileId: viewer.profileId,
      actorAuthUserId: viewer.authUserId,
      action: "device.updated",
      entityType: "device",
      entityPublicId: device.publicId,
      reason: input.reason,
      requestId,
      beforeValues: { status: device.status, firmwareVersion: device.firmwareVersion },
      afterValues: { status: nextStatus, firmwareVersion: nextFirmware },
    });
    return { devicePublicId, status: nextStatus, updatedAt: updated.updatedAt.toISOString() };
  });
}
