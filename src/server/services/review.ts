import "server-only";

import { randomUUID } from "node:crypto";
import { z } from "zod";
import { STORAGE_BUCKET } from "@/src/domain/constants";
import { DomainError } from "@/src/domain/errors";
import { compareDeviceConsistency } from "@/src/metadata/device-consistency";
import { writeAudit } from "@/src/server/audit";
import type { Viewer } from "@/src/server/auth";
import { decodeCreatedAtCursor, encodeCreatedAtCursor } from "@/src/server/cursor";
import { database } from "@/src/server/database";
import { withIdempotency } from "@/src/server/idempotency";
import { createSupabaseAdminClient } from "@/src/server/supabase/admin";

const reviewPublicIdSchema = z.string().regex(/^RV-[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{6,16}$/);
const uploadPublicIdSchema = z.string().regex(/^UP-[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{6,16}$/);

export const reviewListSchema = z.object({
  status: z.enum(["open", "in_review", "resolved", "dismissed"]).optional(),
  caseType: z.enum(["missing", "upload_failed", "metadata_failed", "duplicate_candidate", "unmatched", "device_mismatch", "needs_review"]).optional(),
  cursor: z.string().max(512).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

export const adminUploadListSchema = z.object({
  search: z.string().trim().max(160).optional(),
  transferStatus: z.enum(["created", "uploading", "reconciling", "verified", "failed", "aborted", "expired"]).optional(),
  metadataStatus: z.enum(["pending", "processing", "extracted", "partial", "unsupported", "failed"]).optional(),
  cursor: z.string().max(512).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

export const auditListSchema = z.object({
  cursor: z.string().max(512).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

export const reviewDecisionSchema = z.object({
  action: z.enum(["confirm_match", "correct_match", "reject_upload", "request_rerecord", "extend_assignment", "suspend_participant", "resolve_case", "dismiss_case"]),
  reason: z.string().trim().min(10).max(500),
  sessionPublicId: z.string().regex(/^RS-[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{6,16}$/).nullable().optional(),
  devicePublicId: z.string().regex(/^DEV-[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{6,16}$/).nullable().optional(),
  dueAt: z.string().datetime().optional(),
}).superRefine((input, context) => {
  if (input.action === "correct_match" && !input.sessionPublicId) {
    context.addIssue({ code: "custom", path: ["sessionPublicId"], message: "Correct Match 必须选择 Recording Session" });
  }
  if (input.action === "extend_assignment" && !input.dueAt) {
    context.addIssue({ code: "custom", path: ["dueAt"], message: "Extend Assignment 必须选择 Due At" });
  }
});

type ReviewDecisionInput = z.infer<typeof reviewDecisionSchema>;

export async function listReviewCases(viewer: Viewer, input: z.infer<typeof reviewListSchema>) {
  const cursor = decodeCreatedAtCursor(input.cursor);
  const db = database();
  const items = await db<{
    publicId: string;
    caseType: string;
    status: string;
    reason: string | null;
    isFixture: boolean;
    createdAt: Date;
    videoAssetPublicId: string | null;
    uploadPublicId: string | null;
    assignmentPublicId: string | null;
    participantPublicId: string | null;
    participantAlias: string | null;
    decisionType: string | null;
  }[]>`
    select
      review.public_id,
      review.case_type,
      review.status,
      review.reason,
      review.is_fixture,
      review.created_at,
      asset.public_id as video_asset_public_id,
      coalesce(asset_upload.public_id, direct_upload.public_id) as upload_public_id,
      coalesce(review_assignment.public_id, session_assignment.public_id) as assignment_public_id,
      participant.public_id as participant_public_id,
      participant.display_alias as participant_alias,
      decision.decision_type
    from egocapture.review_cases review
    join egocapture.study_memberships membership on membership.study_id = review.study_id
      and membership.profile_id = ${viewer.profileId}::uuid and membership.status = 'active'
    left join egocapture.video_assets asset on asset.id = review.video_asset_id
    left join egocapture.upload_intents asset_upload on asset_upload.id = asset.upload_intent_id
    left join egocapture.upload_intents direct_upload on direct_upload.id = review.upload_intent_id
    left join egocapture.current_match_decisions decision on decision.video_asset_id = asset.id
    left join egocapture.recording_sessions session on session.id = decision.resolved_session_id
    left join egocapture.assignments session_assignment on session_assignment.id = session.assignment_id
    left join egocapture.assignments review_assignment on review_assignment.id = review.assignment_id
    left join egocapture.participants participant on participant.id = coalesce(asset.participant_id, session_assignment.participant_id, review_assignment.participant_id, direct_upload.participant_id)
    where (${input.status ?? null}::text is null or review.status = ${input.status ?? null})
      and (${input.caseType ?? null}::text is null or review.case_type = ${input.caseType ?? null})
      and (
        ${cursor?.createdAt ?? null}::timestamptz is null
        or (review.created_at, review.public_id) < (${cursor?.createdAt ?? null}::timestamptz, ${cursor?.publicId ?? ""})
      )
    order by review.created_at desc, review.public_id desc
    limit ${input.limit + 1}
  `;
  const hasMore = items.length > input.limit;
  const page = hasMore ? items.slice(0, input.limit) : items;
  return {
    items: page,
    nextCursor: hasMore && page.at(-1) ? encodeCreatedAtCursor({ createdAt: page.at(-1)!.createdAt, publicId: page.at(-1)!.publicId }) : null,
  };
}

export async function getReviewCase(viewer: Viewer, reviewPublicId: string) {
  reviewPublicIdSchema.parse(reviewPublicId);
  const db = database();
  const [review] = await db<{
    id: string;
    publicId: string;
    studyId: string;
    caseType: string;
    status: string;
    reason: string | null;
    resolutionReason: string | null;
    isFixture: boolean;
    createdAt: Date;
    resolvedAt: Date | null;
    videoAssetId: string | null;
    videoAssetPublicId: string | null;
    uploadPublicId: string | null;
    participantId: string | null;
    participantPublicId: string | null;
    participantAlias: string | null;
    participantStatus: string | null;
    assignmentPublicId: string | null;
    assignmentStatus: string | null;
    assignmentDueAt: Date | null;
    assetStatus: string | null;
    currentSessionPublicId: string | null;
    currentDevicePublicId: string | null;
    metadataStatus: string | null;
    transferStatus: string | null;
    deviceConsistency: string | null;
  }[]>`
    select
      review.id,
      review.public_id,
      review.study_id,
      review.case_type,
      review.status,
      review.reason,
      review.resolution_reason,
      review.is_fixture,
      review.created_at,
      review.resolved_at,
      review.video_asset_id,
      asset.public_id as video_asset_public_id,
      coalesce(asset_upload.public_id, direct_upload.public_id) as upload_public_id,
      participant.id as participant_id,
      participant.public_id as participant_public_id,
      participant.display_alias as participant_alias,
      participant.status as participant_status,
      coalesce(review_assignment.public_id, session_assignment.public_id) as assignment_public_id,
      coalesce(review_assignment.status, session_assignment.status) as assignment_status,
      coalesce(review_assignment.due_at, session_assignment.due_at) as assignment_due_at,
      asset.status as asset_status,
      current_session.public_id as current_session_public_id,
      current_device.public_id as current_device_public_id,
      coalesce(asset_upload.metadata_status, direct_upload.metadata_status) as metadata_status,
      coalesce(asset_upload.transfer_status, direct_upload.transfer_status) as transfer_status,
      metadata.device_consistency
    from egocapture.review_cases review
    join egocapture.study_memberships membership on membership.study_id = review.study_id
      and membership.profile_id = ${viewer.profileId}::uuid and membership.status = 'active'
    left join egocapture.video_assets asset on asset.id = review.video_asset_id
    left join egocapture.upload_intents asset_upload on asset_upload.id = asset.upload_intent_id
    left join egocapture.upload_intents direct_upload on direct_upload.id = review.upload_intent_id
    left join egocapture.current_match_decisions decision on decision.video_asset_id = asset.id
    left join egocapture.recording_sessions current_session on current_session.id = decision.resolved_session_id
    left join egocapture.devices current_device on current_device.id = decision.resolved_device_id
    left join egocapture.assignments session_assignment on session_assignment.id = current_session.assignment_id
    left join egocapture.assignments review_assignment on review_assignment.id = review.assignment_id
    left join egocapture.participants participant on participant.id = coalesce(asset.participant_id, session_assignment.participant_id, review_assignment.participant_id, direct_upload.participant_id)
    left join egocapture.video_file_metadata metadata on metadata.video_asset_id = asset.id
    where review.public_id = ${reviewPublicId}
    limit 1
  `;
  if (!review) throw new DomainError("NOT_FOUND", "ReviewCase 或资源不存在", 404);
  const sessions = review.participantId
    ? await db<{
        publicId: string;
        status: string;
        assignmentPublicId: string;
        taskTitle: string;
        declaredDevicePublicId: string;
      }[]>`
        select session.public_id, session.status, assignment.public_id as assignment_public_id,
          version.instructions ->> 'title' as task_title,
          device.public_id as declared_device_public_id
        from egocapture.recording_sessions session
        join egocapture.assignments assignment on assignment.id = session.assignment_id
        join egocapture.task_versions version on version.id = assignment.task_version_id
        join egocapture.devices device on device.id = session.declared_device_id
        where session.participant_id = ${review.participantId}::uuid
          and session.study_id = ${review.studyId}::uuid
        order by (session.status = 'open') desc, session.created_at desc
      `
    : [];
  const devices = review.participantId
    ? await db<{
        publicId: string;
        manufacturer: string;
        model: string;
        status: string;
      }[]>`
        select distinct device.public_id, device.manufacturer, device.model, device.status
        from egocapture.devices device
        left join egocapture.device_assignments assignment on assignment.device_id = device.id and assignment.ended_at is null
        where device.study_id = ${review.studyId}::uuid
          and (assignment.participant_id = ${review.participantId}::uuid or device.status = 'shared')
        order by device.public_id
      `
    : [];
  const decisions = review.videoAssetId
    ? await db<{
        id: string;
        decisionType: string;
        sessionPublicId: string | null;
        devicePublicId: string | null;
        reason: string | null;
        supersedesDecisionId: string | null;
        supersededBy: string | null;
        decidedAt: Date;
      }[]>`
        select decision.id, decision.decision_type, session.public_id as session_public_id,
          device.public_id as device_public_id, decision.reason,
          decision.supersedes_decision_id, decision.superseded_by, decision.decided_at
        from egocapture.match_decisions decision
        left join egocapture.recording_sessions session on session.id = decision.resolved_session_id
        left join egocapture.devices device on device.id = decision.resolved_device_id
        where decision.video_asset_id = ${review.videoAssetId}::uuid
        order by decision.decided_at desc
      `
    : [];
  return { ...review, sessions, devices, decisions };
}

type LockedReview = {
  id: string;
  publicId: string;
  studyId: string;
  status: string;
  caseType: string;
  videoAssetId: string | null;
  videoAssetPublicId: string | null;
  participantId: string | null;
  participantPublicId: string | null;
  participantIsFixture: boolean | null;
  participantStatus: string | null;
  assignmentId: string | null;
  assignmentPublicId: string | null;
  assignmentStatus: string | null;
  assignmentDueAt: Date | null;
  currentDecisionId: string | null;
  currentDecisionType: string | null;
  currentSessionId: string | null;
  currentSessionPublicId: string | null;
  currentDeviceId: string | null;
  currentDevicePublicId: string | null;
};

async function lockReview(
  transaction: ReturnType<typeof database>,
  viewer: Viewer,
  reviewPublicId: string,
): Promise<LockedReview> {
  const [review] = await transaction<LockedReview[]>`
    select
      review.id,
      review.public_id,
      review.study_id,
      review.status,
      review.case_type,
      review.video_asset_id,
      asset.public_id as video_asset_public_id,
      participant.id as participant_id,
      participant.public_id as participant_public_id,
      participant.is_fixture as participant_is_fixture,
      participant.status as participant_status,
      coalesce(review.assignment_id, session.assignment_id) as assignment_id,
      assignment.public_id as assignment_public_id,
      assignment.status as assignment_status,
      assignment.due_at as assignment_due_at,
      decision.id as current_decision_id,
      decision.decision_type as current_decision_type,
      decision.resolved_session_id as current_session_id,
      session.public_id as current_session_public_id,
      decision.resolved_device_id as current_device_id,
      device.public_id as current_device_public_id
    from egocapture.review_cases review
    join egocapture.study_memberships membership on membership.study_id = review.study_id
      and membership.profile_id = ${viewer.profileId}::uuid and membership.status = 'active'
    left join egocapture.video_assets asset on asset.id = review.video_asset_id
    left join egocapture.current_match_decisions decision on decision.video_asset_id = asset.id
    left join egocapture.recording_sessions session on session.id = decision.resolved_session_id
    left join egocapture.assignments assignment on assignment.id = coalesce(review.assignment_id, session.assignment_id)
    left join egocapture.participants participant on participant.id = coalesce(asset.participant_id, assignment.participant_id)
    left join egocapture.devices device on device.id = decision.resolved_device_id
    where review.public_id = ${reviewPublicId}
    for update of review
  `;
  if (!review) throw new DomainError("NOT_FOUND", "ReviewCase 或资源不存在", 404);
  if (!["open", "in_review"].includes(review.status)) {
    throw new DomainError("REVIEW_CASE_TERMINAL", "ReviewCase 已处理", 409);
  }
  return review;
}

async function resolveSession(
  transaction: ReturnType<typeof database>,
  review: LockedReview,
  input: ReviewDecisionInput,
) {
  const publicId = input.action === "confirm_match" ? review.currentSessionPublicId : input.sessionPublicId;
  if (!publicId || !review.participantId) throw new DomainError("SESSION_REQUIRED", "必须选择 Recording Session", 422);
  const [session] = await transaction<{
    id: string;
    publicId: string;
    assignmentId: string;
    assignmentPublicId: string;
    declaredDeviceId: string;
    declaredDevicePublicId: string;
  }[]>`
    select session.id, session.public_id, session.assignment_id,
      assignment.public_id as assignment_public_id,
      session.declared_device_id, device.public_id as declared_device_public_id
    from egocapture.recording_sessions session
    join egocapture.assignments assignment on assignment.id = session.assignment_id
    join egocapture.devices device on device.id = session.declared_device_id
    where session.public_id = ${publicId}
      and session.study_id = ${review.studyId}::uuid
      and session.participant_id = ${review.participantId}::uuid
    limit 1
  `;
  if (!session) throw new DomainError("SESSION_NOT_AVAILABLE", "Recording Session 不属于该 Participant/Study", 422);
  return session;
}

async function resolveDevice(
  transaction: ReturnType<typeof database>,
  review: LockedReview,
  session: Awaited<ReturnType<typeof resolveSession>>,
  input: ReviewDecisionInput,
) {
  const publicId = input.devicePublicId
    ?? (input.action === "confirm_match" ? review.currentDevicePublicId : null)
    ?? session.declaredDevicePublicId;
  const [device] = await transaction<{
    id: string;
    publicId: string;
    manufacturer: string;
    model: string;
    serialHmac: string | null;
  }[]>`
    select distinct device.id, device.public_id, device.manufacturer, device.model, device.serial_hmac
    from egocapture.devices device
    left join egocapture.device_assignments assignment on assignment.device_id = device.id and assignment.ended_at is null
    where device.public_id = ${publicId}
      and device.study_id = ${review.studyId}::uuid
      and (
        assignment.participant_id = ${review.participantId}::uuid
        or device.status = 'shared'
        or device.id = ${session.declaredDeviceId}::uuid
      )
    limit 1
  `;
  if (!device) throw new DomainError("DEVICE_NOT_AVAILABLE", "Device 不属于该 Participant/Study", 422);
  return device;
}

async function supersedeMatchDecision(
  transaction: ReturnType<typeof database>,
  viewer: Viewer,
  review: LockedReview,
  input: ReviewDecisionInput,
  decisionType: "admin_confirmed" | "admin_corrected" | "rejected",
  session: Awaited<ReturnType<typeof resolveSession>> | null,
  device: Awaited<ReturnType<typeof resolveDevice>> | null,
) {
  if (!review.videoAssetId || !review.currentDecisionId) {
    throw new DomainError("MATCH_DECISION_REQUIRED", "该 ReviewCase 没有可纠正的当前 MatchDecision", 409);
  }
  const [locked] = await transaction<{ id: string }[]>`
    select id from egocapture.match_decisions
    where id = ${review.currentDecisionId}::uuid and superseded_by is null
    for update
  `;
  if (!locked) throw new DomainError("STALE_MATCH_DECISION", "MatchDecision 已被其他操作更新", 409);
  const nextId = randomUUID();
  await transaction`set constraints all deferred`;
  await transaction`
    update egocapture.match_decisions set superseded_by = ${nextId}::uuid
    where id = ${locked.id}::uuid
  `;
  await transaction`
    insert into egocapture.match_decisions (
      id, video_asset_id, claimed_session_id, resolved_session_id, resolved_device_id,
      decision_type, reason, supersedes_decision_id, decided_by
    )
    select
      ${nextId}::uuid, old.video_asset_id, old.claimed_session_id,
      ${session?.id ?? null}::uuid, ${device?.id ?? null}::uuid,
      ${decisionType}, ${input.reason}, old.id, ${viewer.profileId}::uuid
    from egocapture.match_decisions old where old.id = ${locked.id}::uuid
  `;
  return nextId;
}

export async function decideReviewCase(
  viewer: Viewer,
  reviewPublicId: string,
  input: ReviewDecisionInput,
  idempotencyKey: string,
  requestId: string,
) {
  reviewPublicIdSchema.parse(reviewPublicId);
  const db = database();
  return await db.begin(async (transaction) => await withIdempotency(transaction, {
    actorAuthUserId: viewer.authUserId,
    commandName: "review_case.decision",
    idempotencyKey,
    input: { reviewPublicId, ...input },
    execute: async () => {
      const review = await lockReview(transaction as ReturnType<typeof database>, viewer, reviewPublicId);
      const before = {
        reviewStatus: review.status,
        decisionType: review.currentDecisionType,
        sessionPublicId: review.currentSessionPublicId,
        devicePublicId: review.currentDevicePublicId,
        assignmentPublicId: review.assignmentPublicId,
      };
      let nextDecisionId: string | null = null;
      let session: Awaited<ReturnType<typeof resolveSession>> | null = null;
      let device: Awaited<ReturnType<typeof resolveDevice>> | null = null;
      let nextAssignmentStatus: string | null = null;

      if (input.action === "confirm_match" || input.action === "correct_match") {
        session = await resolveSession(transaction as ReturnType<typeof database>, review, input);
        if (review.assignmentStatus === "canceled") {
          throw new DomainError("INVALID_ASSIGNMENT_STATE", "Canceled Assignment 不能接受 Match", 409);
        }
        device = await resolveDevice(transaction as ReturnType<typeof database>, review, session, input);
        nextDecisionId = await supersedeMatchDecision(
          transaction as ReturnType<typeof database>, viewer, review, input,
          input.action === "confirm_match" ? "admin_confirmed" : "admin_corrected",
          session, device,
        );
        nextAssignmentStatus = "accepted";
        await transaction`
          update egocapture.assignments set status = 'accepted'
          where id = ${session.assignmentId}::uuid and status <> 'canceled'
        `;
        await transaction`
          update egocapture.recording_sessions
          set status = 'closed', closed_at = now(), close_reason = ${input.reason}
          where assignment_id = ${session.assignmentId}::uuid and status = 'open'
        `;
        const [metadata] = await transaction<{
          cameraManufacturer: string | null;
          cameraModel: string | null;
          cameraSerialHash: string | null;
        }[]>`
          select camera_manufacturer, camera_model, camera_serial_hash
          from egocapture.video_file_metadata where video_asset_id = ${review.videoAssetId}::uuid
        `;
        if (metadata) {
          const consistency = compareDeviceConsistency(
            { manufacturer: device.manufacturer, model: device.model, serialHmac: device.serialHmac },
            { manufacturer: metadata.cameraManufacturer, model: metadata.cameraModel, serialHash: metadata.cameraSerialHash },
          );
          await transaction`
            update egocapture.video_file_metadata set device_consistency = ${consistency}
            where video_asset_id = ${review.videoAssetId}::uuid
          `;
        }
      } else if (input.action === "reject_upload") {
        nextDecisionId = await supersedeMatchDecision(
          transaction as ReturnType<typeof database>, viewer, review, input,
          "rejected", null, null,
        );
        await transaction`update egocapture.video_assets set status = 'rejected' where id = ${review.videoAssetId}::uuid`;
        if (review.assignmentId) {
          nextAssignmentStatus = "rework_required";
          await transaction`
            update egocapture.assignments set status = 'rework_required'
            where id = ${review.assignmentId}::uuid and status <> 'canceled'
          `;
          await transaction`
            update egocapture.recording_sessions
            set status = 'closed', closed_at = now(), close_reason = ${input.reason}
            where assignment_id = ${review.assignmentId}::uuid and status = 'open'
          `;
        }
      } else if (input.action === "request_rerecord") {
        if (!review.assignmentId) throw new DomainError("ASSIGNMENT_REQUIRED", "该 ReviewCase 没有关联 Assignment", 409);
        nextAssignmentStatus = "rework_required";
        await transaction`
          update egocapture.assignments set status = 'rework_required'
          where id = ${review.assignmentId}::uuid and status <> 'canceled'
        `;
        await transaction`
          update egocapture.recording_sessions
          set status = 'closed', closed_at = now(), close_reason = ${input.reason}
          where assignment_id = ${review.assignmentId}::uuid and status = 'open'
        `;
      } else if (input.action === "extend_assignment") {
        if (!review.assignmentId || !input.dueAt) throw new DomainError("ASSIGNMENT_REQUIRED", "该 ReviewCase 没有关联 Assignment", 409);
        if (["accepted", "canceled"].includes(review.assignmentStatus ?? "")) {
          throw new DomainError("INVALID_ASSIGNMENT_STATE", "当前 Assignment 不能延期", 409);
        }
        const dueAt = new Date(input.dueAt);
        if (dueAt <= new Date()) throw new DomainError("DUE_AT_IN_PAST", "Due At 必须晚于当前时间", 422);
        await transaction`
          update egocapture.assignments
          set due_at = ${dueAt},
            status = case when status in ('expired', 'missing_upload') then 'assigned' else status end
          where id = ${review.assignmentId}::uuid
        `;
      } else if (input.action === "suspend_participant") {
        if (!review.participantId) throw new DomainError("PARTICIPANT_REQUIRED", "该 ReviewCase 没有关联 Participant", 409);
        if (viewer.isDemoAdmin && review.participantIsFixture) {
          throw new DomainError("FIXTURE_PROTECTED", "公开 Demo Fixture Participant 不能被暂停", 403);
        }
        if (review.participantStatus !== "active") {
          throw new DomainError("INVALID_PARTICIPANT_STATE", "只有 Active Participant 可以暂停", 409);
        }
        await transaction`
          update egocapture.participants set status = 'suspended'
          where id = ${review.participantId}::uuid
        `;
      }

      const nextReviewStatus = input.action === "dismiss_case" ? "dismissed" : "resolved";
      await transaction`
        update egocapture.review_cases
        set status = ${nextReviewStatus}, resolution_reason = ${input.reason}, resolved_at = now()
        where id = ${review.id}::uuid
      `;
      if (review.videoAssetId && ["confirm_match", "correct_match", "reject_upload"].includes(input.action)) {
        await transaction`
          update egocapture.review_cases
          set status = ${nextReviewStatus}, resolution_reason = ${input.reason}, resolved_at = now()
          where video_asset_id = ${review.videoAssetId}::uuid
            and status in ('open', 'in_review')
            and (
              ${input.action} = 'reject_upload'
              or case_type in ('unmatched', 'device_mismatch', 'needs_review')
            )
        `;
      }
      await writeAudit(transaction, {
        studyId: review.studyId,
        actorProfileId: viewer.profileId,
        actorAuthUserId: viewer.authUserId,
        action: `review_case.${input.action}`,
        entityType: "review_case",
        entityPublicId: review.publicId,
        reason: input.reason,
        requestId,
        beforeValues: before,
        afterValues: {
          reviewStatus: nextReviewStatus,
          matchDecisionId: nextDecisionId,
          decisionType: input.action === "confirm_match" ? "admin_confirmed"
            : input.action === "correct_match" ? "admin_corrected"
              : input.action === "reject_upload" ? "rejected" : review.currentDecisionType,
          sessionPublicId: session?.publicId ?? review.currentSessionPublicId,
          devicePublicId: device?.publicId ?? review.currentDevicePublicId,
          assignmentStatus: nextAssignmentStatus,
          dueAt: input.action === "extend_assignment" ? input.dueAt : review.assignmentDueAt?.toISOString() ?? null,
          participantStatus: input.action === "suspend_participant" ? "suspended" : review.participantStatus,
        },
      });
      return {
        reviewPublicId: review.publicId,
        status: nextReviewStatus,
        action: input.action,
        matchDecisionId: nextDecisionId,
      };
    },
  }));
}

export async function listAdminUploads(
  viewer: Viewer,
  input: z.infer<typeof adminUploadListSchema> = adminUploadListSchema.parse({}),
) {
  const cursor = decodeCreatedAtCursor(input.cursor);
  const db = database();
  const rows = await db<{
    publicId: string;
    originalFilename: string;
    transferStatus: string;
    metadataStatus: string;
    sizeBytes: number;
    videoAssetPublicId: string | null;
    decisionType: string | null;
    deviceConsistency: string | null;
    reviewCount: number;
    participantPublicId: string;
    participantAlias: string;
    createdAt: Date;
  }[]>`
    select intent.public_id, intent.original_filename, intent.transfer_status, intent.metadata_status,
      intent.size_bytes::integer, asset.public_id as video_asset_public_id,
      decision.decision_type, metadata.device_consistency,
      (select count(*)::integer from egocapture.review_cases review
        where (review.video_asset_id = asset.id or review.upload_intent_id = intent.id)
          and review.status in ('open', 'in_review')) as review_count,
      participant.public_id as participant_public_id, participant.display_alias as participant_alias,
      intent.created_at
    from egocapture.upload_intents intent
    join egocapture.participants participant on participant.id = intent.participant_id
    join egocapture.study_memberships membership on membership.study_id = intent.study_id
      and membership.profile_id = ${viewer.profileId}::uuid and membership.status = 'active'
    left join egocapture.video_assets asset on asset.upload_intent_id = intent.id
    left join egocapture.current_match_decisions decision on decision.video_asset_id = asset.id
    left join egocapture.video_file_metadata metadata on metadata.video_asset_id = asset.id
    where (${input.search ?? null}::text is null
      or intent.public_id ilike '%' || ${input.search ?? ""} || '%'
      or intent.original_filename ilike '%' || ${input.search ?? ""} || '%'
      or participant.public_id ilike '%' || ${input.search ?? ""} || '%'
      or participant.display_alias ilike '%' || ${input.search ?? ""} || '%')
      and (${input.transferStatus ?? null}::text is null or intent.transfer_status = ${input.transferStatus ?? ""})
      and (${input.metadataStatus ?? null}::text is null or intent.metadata_status = ${input.metadataStatus ?? ""})
      and (
        ${cursor?.createdAt ?? null}::timestamptz is null
        or (intent.created_at, intent.public_id) < (${cursor?.createdAt ?? null}::timestamptz, ${cursor?.publicId ?? ""})
      )
    order by intent.created_at desc, intent.public_id desc
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

export async function getAdminUpload(viewer: Viewer, uploadPublicId: string) {
  uploadPublicIdSchema.parse(uploadPublicId);
  const db = database();
  const [upload] = await db<{
    id: string;
    publicId: string;
    originalFilename: string;
    contentType: string;
    sizeBytes: number;
    transferStatus: string;
    metadataStatus: string;
    objectKey: string | null;
    storageDeletedAt: Date | null;
    localModifiedAt: Date | null;
    claimedSessionPublicId: string | null;
    unableToDetermine: boolean;
    participantNote: string | null;
    fingerprintV1: string;
    failureCode: string | null;
    verifiedAt: Date | null;
    expectedExpiresAt: Date;
    videoAssetId: string | null;
    videoAssetPublicId: string | null;
    decisionType: string | null;
    deviceConsistency: string | null;
    participantPublicId: string;
    participantAlias: string;
    createdAt: Date;
  }[]>`
    select intent.id, intent.public_id, intent.original_filename, intent.content_type, intent.size_bytes::integer,
      intent.transfer_status, intent.metadata_status, object.object_key, object.deleted_at as storage_deleted_at,
      intent.local_modified_at, claimed_session.public_id as claimed_session_public_id,
      intent.unable_to_determine, intent.participant_note, intent.fingerprint_v1,
      intent.failure_code, intent.verified_at, intent.expected_expires_at,
      asset.id as video_asset_id, asset.public_id as video_asset_public_id, decision.decision_type,
      metadata.device_consistency, participant.public_id as participant_public_id,
      participant.display_alias as participant_alias, intent.created_at
    from egocapture.upload_intents intent
    join egocapture.participants participant on participant.id = intent.participant_id
    join egocapture.study_memberships membership on membership.study_id = intent.study_id
      and membership.profile_id = ${viewer.profileId}::uuid and membership.status = 'active'
    left join egocapture.video_assets asset on asset.upload_intent_id = intent.id
    left join egocapture.asset_files asset_file on asset_file.video_asset_id = asset.id and asset_file.file_role = 'source'
    left join egocapture.stored_objects object on object.id = asset_file.stored_object_id
    left join egocapture.recording_sessions claimed_session on claimed_session.id = intent.claimed_session_id
    left join egocapture.current_match_decisions decision on decision.video_asset_id = asset.id
    left join egocapture.video_file_metadata metadata on metadata.video_asset_id = asset.id
    where intent.public_id = ${uploadPublicId}
  `;
  if (!upload) throw new DomainError("NOT_FOUND", "Upload 或资源不存在", 404);
  const attempts = await db<{
    publicId: string;
    attemptNumber: number;
    provider: string;
    status: string;
    bytesUploaded: number;
    expiresAt: Date | null;
    startedAt: Date | null;
    completedAt: Date | null;
    errorCode: string | null;
  }[]>`
    select public_id, attempt_number, provider, status, bytes_uploaded::integer,
      expires_at, started_at, completed_at, error_code
    from egocapture.upload_attempts
    where upload_intent_id = ${upload.id}::uuid
    order by attempt_number desc
  `;
  const [metadata] = upload.videoAssetId ? await db<{
    parserName: string;
    parserVersion: string;
    containerFormat: string | null;
    durationMs: number | null;
    fileSizeBytes: number | null;
    videoCodec: string | null;
    width: number | null;
    height: number | null;
    frameRate: number | null;
    bitrate: number | null;
    audioCodec: string | null;
    audioChannels: number | null;
    normalizedCaptureTime: Date | null;
    captureTimeSource: string | null;
    captureTimeConfidence: string;
    timezoneOffset: string | null;
    cameraManufacturer: string | null;
    cameraModel: string | null;
    cameraSerialHash: string | null;
    gpsMetadataPresent: boolean;
    projectionType: string | null;
    is360: boolean | null;
    deviceConsistency: string;
    extractedAt: Date;
  }[]>`
    select parser_name, parser_version, container_format, duration_ms::integer,
      file_size_bytes::integer, video_codec, width, height, frame_rate::float8,
      bitrate::integer, audio_codec, audio_channels, normalized_capture_time,
      capture_time_source, capture_time_confidence, timezone_offset,
      camera_manufacturer, camera_model, camera_serial_hash,
      gps_metadata_present, projection_type, is_360, device_consistency, extracted_at
    from egocapture.video_file_metadata
    where video_asset_id = ${upload.videoAssetId}::uuid
  ` : [];
  const metadataAttempts = upload.videoAssetId ? await db<{
    attemptNumber: number;
    parserName: string;
    parserVersion: string;
    status: string;
    rangeRequestCount: number;
    bytesRead: number;
    startedAt: Date;
    completedAt: Date | null;
    errorCode: string | null;
  }[]>`
    select attempt_number, parser_name, parser_version, status, range_request_count,
      bytes_read::integer, started_at, completed_at, error_code
    from egocapture.metadata_attempts
    where video_asset_id = ${upload.videoAssetId}::uuid
    order by attempt_number desc
  ` : [];
  const evidence = upload.videoAssetId ? await db<{
    fieldName: string;
    normalizedValue: unknown;
    parserName: string;
    source: string;
  }[]>`
    select field_name, normalized_value, parser_name, source
    from egocapture.metadata_evidence
    where video_asset_id = ${upload.videoAssetId}::uuid
    order by field_name
  ` : [];
  const relatedReviews = await db<{
    publicId: string;
    caseType: string;
    status: string;
    isFixture: boolean;
  }[]>`
    select public_id, case_type, status, is_fixture
    from egocapture.review_cases
    where upload_intent_id = ${upload.id}::uuid
      or (${upload.videoAssetId}::uuid is not null and video_asset_id = ${upload.videoAssetId}::uuid)
    order by created_at desc, public_id desc
  `;
  return { ...upload, attempts, metadata: metadata ?? null, metadataAttempts, evidence, relatedReviews };
}

export async function adminUploadSignedUrl(viewer: Viewer, uploadPublicId: string) {
  const upload = await getAdminUpload(viewer, uploadPublicId);
  if (!upload.objectKey || upload.storageDeletedAt || upload.transferStatus !== "verified") {
    throw new DomainError("STORAGE_OBJECT_NOT_VERIFIED", "该 Upload 尚无已验证对象", 409);
  }
  const { data, error } = await createSupabaseAdminClient().storage
    .from(STORAGE_BUCKET)
    .createSignedUrl(upload.objectKey, 5 * 60);
  if (error || !data?.signedUrl) throw new DomainError("SIGNED_URL_FAILED", "暂时无法创建预览链接", 503);
  return { uploadPublicId, signedUrl: data.signedUrl, expiresAt: new Date(Date.now() + 5 * 60 * 1000).toISOString() };
}

export async function listAuditEvents(
  viewer: Viewer,
  input: z.infer<typeof auditListSchema> = auditListSchema.parse({}),
) {
  const cursor = decodeCreatedAtCursor(input.cursor);
  const db = database();
  const rows = await db<{
    id: string;
    action: string;
    entityType: string;
    entityPublicId: string | null;
    reason: string | null;
    requestId: string;
    actorDisplayName: string | null;
    beforeValues: Record<string, unknown> | null;
    afterValues: Record<string, unknown> | null;
    createdAt: Date;
  }[]>`
    select audit.id, audit.action, audit.entity_type, audit.entity_public_id,
      audit.reason, audit.request_id, profile.display_name as actor_display_name,
      audit.before_values, audit.after_values, audit.created_at
    from egocapture.audit_events audit
    join egocapture.study_memberships membership on membership.study_id = audit.study_id
      and membership.profile_id = ${viewer.profileId}::uuid and membership.status = 'active'
    left join egocapture.profiles profile on profile.id = audit.actor_profile_id
    where (
      ${cursor?.createdAt ?? null}::timestamptz is null
      or (audit.created_at, audit.id::text) < (${cursor?.createdAt ?? null}::timestamptz, ${cursor?.publicId ?? ""})
    )
    order by audit.created_at desc, audit.id desc
    limit ${input.limit + 1}
  `;
  const hasMore = rows.length > input.limit;
  const items = rows.slice(0, input.limit);
  const last = items.at(-1);
  return {
    items,
    nextCursor: hasMore && last ? encodeCreatedAtCursor({ createdAt: last.createdAt, publicId: last.id }) : null,
  };
}

export async function dashboardSummary(viewer: Viewer) {
  const db = database();
  const [summary] = await db<{
    missing: number;
    uploadFailed: number;
    metadataFailed: number;
    unmatched: number;
    deviceMismatch: number;
    needsReview: number;
    bytes24h: number;
  }[]>`
    select
      (select count(*)::integer from egocapture.missing_assignments missing
        join egocapture.study_memberships membership on membership.study_id = missing.study_id
        where membership.profile_id = ${viewer.profileId}::uuid and membership.status = 'active') as missing,
      count(*) filter (where review.case_type = 'upload_failed' and review.status in ('open', 'in_review'))::integer as upload_failed,
      count(*) filter (where review.case_type = 'metadata_failed' and review.status in ('open', 'in_review'))::integer as metadata_failed,
      count(*) filter (where review.case_type = 'unmatched' and review.status in ('open', 'in_review'))::integer as unmatched,
      count(*) filter (where review.case_type = 'device_mismatch' and review.status in ('open', 'in_review'))::integer as device_mismatch,
      count(*) filter (where review.status in ('open', 'in_review'))::integer as needs_review,
      (select coalesce(sum(intent.size_bytes), 0)::float8 from egocapture.upload_intents intent
        join egocapture.study_memberships member on member.study_id = intent.study_id
        where member.profile_id = ${viewer.profileId}::uuid and member.status = 'active'
          and intent.created_at >= now() - interval '24 hours') as bytes_24h
    from egocapture.review_cases review
    join egocapture.study_memberships membership on membership.study_id = review.study_id
      and membership.profile_id = ${viewer.profileId}::uuid and membership.status = 'active'
  `;
  const assignmentFunnel = await db<{ status: string; count: number }[]>`
    select assignment.status, count(*)::integer
    from egocapture.assignments assignment
    join egocapture.study_memberships membership on membership.study_id = assignment.study_id
      and membership.profile_id = ${viewer.profileId}::uuid and membership.status = 'active'
    group by assignment.status order by assignment.status
  `;
  const uploadFunnel = await db<{ status: string; count: number }[]>`
    select intent.transfer_status as status, count(*)::integer
    from egocapture.upload_intents intent
    join egocapture.study_memberships membership on membership.study_id = intent.study_id
      and membership.profile_id = ${viewer.profileId}::uuid and membership.status = 'active'
    group by intent.transfer_status order by intent.transfer_status
  `;
  const audits = await listAuditEvents(viewer, { limit: 8 });
  return { summary, assignmentFunnel, uploadFunnel, recentAudits: audits.items };
}
