import "server-only";

import type postgres from "postgres";
import { z } from "zod";
import {
  canAcknowledgeAssignment,
  canCancelAssignment,
  statusAfterExtension,
  type AssignmentStatus,
} from "@egocapture/core/domain/assignment";
import { DomainError } from "@egocapture/core/domain/errors";
import { createPublicId } from "@egocapture/core/domain/public-id";
import { isCanonicalLocale } from "@egocapture/core/domain/regional-preferences";
import {
  taskContentHash,
  taskInstructionsSchema,
  type TaskInstructions,
} from "@egocapture/core/domain/task-instructions";
import { writeAudit } from "@egocapture/core/server/audit";
import type { Viewer } from "@egocapture/core/server/auth";
import { database } from "@egocapture/core/server/database";
import { withIdempotency } from "@egocapture/core/server/idempotency";

const taskPublicIdSchema = z.string().regex(/^TSK-[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{6,16}$/);
const participantPublicIdSchema = z.string().regex(/^PT-[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{6,16}$/);
const devicePublicIdSchema = z.string().regex(/^DEV-[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{6,16}$/);
const assignmentPublicIdSchema = z.string().regex(/^AS-[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{6,16}$/);
const localeSchema = z.string().trim().min(2).max(20).refine(isCanonicalLocale, {
  message: "Locale 必须是规范的 BCP 47 标识",
});

export const createTaskSchema = z.object({
  instructions: taskInstructionsSchema,
});

export const updateTaskSchema = z.object({
  instructions: taskInstructionsSchema,
  expectedUpdatedAt: z.string().datetime(),
});

export const taskListSchema = z.object({
  search: z.string().trim().max(160).optional(),
  lifecycle: z.enum(["draft", "active", "archived"]).optional(),
  cursor: taskPublicIdSchema.optional(),
  limit: z.coerce.number().int().min(1).max(50).default(25),
});

export const createAssignmentSchema = z.object({
  participantPublicId: participantPublicIdSchema,
  taskPublicId: taskPublicIdSchema,
  taskVersion: z.number().int().positive(),
  dueAt: z.string().datetime({ offset: true }),
  locale: localeSchema.optional(),
  preferredDevicePublicId: devicePublicIdSchema.nullable().optional(),
  note: z.string().trim().max(500).nullable().optional(),
});

const taskParticipantSelectionSchema = z.object({
  participantPublicId: participantPublicIdSchema,
  preferredDevicePublicId: devicePublicIdSchema.nullable().optional(),
});

export const addTaskParticipantsSchema = z.object({
  taskVersion: z.number().int().positive().optional(),
  dueAt: z.string().datetime({ offset: true }),
  note: z.string().trim().max(500).nullable().optional(),
  participants: z.array(taskParticipantSelectionSchema).min(1).max(100),
}).superRefine((input, context) => {
  const seen = new Set<string>();
  input.participants.forEach((participant, index) => {
    if (seen.has(participant.participantPublicId)) {
      context.addIssue({
        code: "custom",
        path: ["participants", index, "participantPublicId"],
        message: "同一参与者不能重复选择",
      });
    }
    seen.add(participant.participantPublicId);
  });
});

export const replaceTaskParticipantSchema = z.object({
  participantPublicId: participantPublicIdSchema,
  taskVersion: z.number().int().positive().optional(),
  dueAt: z.string().datetime({ offset: true }),
  preferredDevicePublicId: devicePublicIdSchema.nullable().optional(),
  reason: z.string().trim().min(10).max(500),
});

export const assignmentListSchema = z.object({
  search: z.string().trim().max(160).optional(),
  status: z.enum([
    "assigned", "acknowledged", "session_created", "uploading", "submitted",
    "needs_review", "rework_required", "accepted", "expired", "missing_upload", "canceled",
  ]).optional(),
  cursor: assignmentPublicIdSchema.optional(),
  limit: z.coerce.number().int().min(1).max(50).default(25),
});

export const acknowledgeAssignmentSchema = z.object({
  contentHash: z.string().regex(/^[a-f0-9]{64}$/),
});

export const assignmentReasonSchema = z.object({ reason: z.string().trim().min(10).max(500) });

export const extendAssignmentSchema = assignmentReasonSchema.extend({
  dueAt: z.string().datetime({ offset: true }),
});

export async function listTasks(_viewer: Viewer, input: z.infer<typeof taskListSchema>) {
  const db = database();
  const rows = await db<{
    publicId: string;
    title: string;
    lifecycle: string;
    latestVersion: number | null;
    latestContentHash: string | null;
    participantCount: number;
    completedCount: number;
    videoCount: number;
    attentionCount: number;
    nextDueAt: Date | null;
    isFixture: boolean;
    updatedAt: Date;
  }[]>`
    select distinct
      task.public_id,
      task.title,
      task.lifecycle,
      latest.version as latest_version,
      latest.content_hash as latest_content_hash,
      (coalesce(operations.participant_count, 0) + coalesce(planned.participant_count, 0))::integer as participant_count,
      coalesce(operations.completed_count, 0)::integer as completed_count,
      coalesce(operations.video_count, 0)::integer as video_count,
      coalesce(operations.attention_count, 0)::integer as attention_count,
      operations.next_due_at,
      task.is_fixture,
      task.updated_at
    from egocapture.tasks task
    left join lateral (
      select version.version, version.content_hash
      from egocapture.task_versions version
      where version.task_id = task.id
      order by version.version desc
      limit 1
    ) latest on true
    left join lateral (
      select
        count(distinct assignment.id) filter (where assignment.status <> 'canceled') as participant_count,
        count(distinct assignment.id) filter (where assignment.status = 'accepted') as completed_count,
        count(distinct asset.id) filter (
          where asset.status = 'active'
            and decision.decision_type in ('participant_claim', 'admin_confirmed', 'admin_corrected')
        ) as video_count,
        count(distinct assignment.id) filter (
          where assignment.status in ('needs_review', 'rework_required', 'expired', 'missing_upload')
             or progress.is_missing
        ) + count(distinct review.id) filter (
          where review.status in ('open', 'in_review')
        ) as attention_count,
        min(assignment.due_at) filter (
          where assignment.status not in ('accepted', 'canceled')
        ) as next_due_at
      from egocapture.assignments assignment
      left join egocapture.assignment_progress progress on progress.id = assignment.id
      left join egocapture.recording_sessions session on session.assignment_id = assignment.id
      left join egocapture.current_match_decisions decision on decision.resolved_session_id = session.id
      left join egocapture.video_assets asset on asset.id = decision.video_asset_id
      left join egocapture.review_cases review
        on review.assignment_id = assignment.id or review.video_asset_id = asset.id
      where assignment.task_id = task.id
    ) operations on true
    left join lateral (
      select count(*)::integer as participant_count
      from egocapture.task_participant_plans plan
      where plan.task_id = task.id
        and plan.removed_at is null
        and plan.assignment_id is null
    ) planned on true
    where (${input.search ?? null}::text is null
        or task.public_id ilike '%' || ${input.search ?? ""} || '%'
        or task.title ilike '%' || ${input.search ?? ""} || '%')
      and (${input.lifecycle ?? null}::text is null or task.lifecycle = ${input.lifecycle ?? ""})
      and (${input.cursor ?? null}::text is null or task.public_id > ${input.cursor ?? ""})
    order by task.public_id
    limit ${input.limit + 1}
  `;
  const hasNext = rows.length > input.limit;
  const items = rows.slice(0, input.limit).map((task) => ({
    ...task,
    operationalStatus: task.lifecycle === "archived"
      ? "archived"
      : !task.latestVersion
        ? "draft"
        : task.participantCount === 0
          ? "awaiting_participants"
          : task.completedCount === task.participantCount
            ? "completed"
            : task.attentionCount > 0
              ? "needs_attention"
              : "running",
  }));
  return { items, nextCursor: hasNext ? items.at(-1)?.publicId ?? null : null };
}

export async function getTask(_viewer: Viewer, taskPublicId: string) {
  const db = database();
  const [task] = await db<{
    id: string;
    publicId: string;
    title: string;
    lifecycle: string;
    draftInstructions: TaskInstructions;
    isFixture: boolean;
    updatedAt: Date;
  }[]>`
    select
      task.id,
      task.public_id,
      task.title,
      task.lifecycle,
      task.draft_instructions,
      task.is_fixture,
      task.updated_at
    from egocapture.tasks task
    where task.public_id = ${taskPublicId}
    limit 1
  `;
  if (!task) throw new DomainError("NOT_FOUND", "Task 或资源不存在", 404);
  const versions = await db<{
    version: number;
    contentHash: string;
    publishedAt: Date;
  }[]>`
    select version, content_hash, published_at
    from egocapture.task_versions
    where task_id = ${task.id}::uuid
    order by version desc
  `;
  return { ...task, draftInstructions: taskInstructionsSchema.parse(task.draftInstructions), versions };
}

export async function getTaskOperations(_viewer: Viewer, taskPublicId: string) {
  taskPublicIdSchema.parse(taskPublicId);
  const db = database();
  const [task] = await db<{ id: string; lifecycle: string }[]>`
    select id, lifecycle from egocapture.tasks where public_id = ${taskPublicId} limit 1
  `;
  if (!task) throw new DomainError("NOT_FOUND", "Task 或资源不存在", 404);

  const assignedParticipants = await db<{
    assignmentPublicId: string | null;
    participantPublicId: string;
    participantAlias: string;
    participantStatus: string;
    status: AssignmentStatus;
    taskVersion: number | null;
    locale: string;
    dueAt: Date;
    createdAt: Date;
    canceledAt: Date | null;
    sessionCount: number;
    videoCount: number;
    isMissing: boolean;
    reviewCount: number;
    preferredDevicePublicId: string | null;
    replacesAssignmentPublicId: string | null;
    replacedByAssignmentPublicId: string | null;
  }[]>`
    select
      assignment.public_id as assignment_public_id,
      participant.public_id as participant_public_id,
      participant.display_alias as participant_alias,
      participant.status as participant_status,
      assignment.status,
      version.version as task_version,
      assignment.locale,
      assignment.due_at,
      assignment.created_at,
      assignment.canceled_at,
      progress.session_count::integer,
      progress.accepted_asset_candidates::integer as video_count,
      progress.is_missing,
      (
        select count(*)::integer
        from egocapture.review_cases review
        where review.status in ('open', 'in_review')
          and (
            review.assignment_id = assignment.id
            or review.video_asset_id in (
              select decision.video_asset_id
              from egocapture.current_match_decisions decision
              join egocapture.recording_sessions session on session.id = decision.resolved_session_id
              where session.assignment_id = assignment.id
            )
          )
      ) as review_count,
      preferred_device.public_id as preferred_device_public_id,
      replaced.public_id as replaces_assignment_public_id,
      replacement.public_id as replaced_by_assignment_public_id
    from egocapture.assignments assignment
    join egocapture.participants participant on participant.id = assignment.participant_id
    join egocapture.task_versions version on version.id = assignment.task_version_id
    join egocapture.assignment_progress progress on progress.id = assignment.id
    left join egocapture.devices preferred_device on preferred_device.id = assignment.preferred_device_id
    left join egocapture.assignments replaced on replaced.id = assignment.replaces_assignment_id
    left join egocapture.assignments replacement on replacement.replaces_assignment_id = assignment.id
    where assignment.task_id = ${task.id}::uuid
    order by (assignment.status = 'canceled'), assignment.created_at desc, assignment.public_id
  `;

  const plannedParticipants = await db<{
    assignmentPublicId: string | null;
    participantPublicId: string;
    participantAlias: string;
    participantStatus: string;
    status: "planned";
    taskVersion: number | null;
    locale: string;
    dueAt: Date;
    createdAt: Date;
    canceledAt: Date | null;
    sessionCount: number;
    videoCount: number;
    isMissing: boolean;
    reviewCount: number;
    preferredDevicePublicId: string | null;
    replacesAssignmentPublicId: string | null;
    replacedByAssignmentPublicId: string | null;
  }[]>`
    select
      null::text as assignment_public_id,
      participant.public_id as participant_public_id,
      participant.display_alias as participant_alias,
      participant.status as participant_status,
      'planned'::text as status,
      null::integer as task_version,
      plan.locale,
      plan.due_at,
      plan.created_at,
      null::timestamptz as canceled_at,
      0::integer as session_count,
      0::integer as video_count,
      false as is_missing,
      0::integer as review_count,
      preferred_device.public_id as preferred_device_public_id,
      null::text as replaces_assignment_public_id,
      null::text as replaced_by_assignment_public_id
    from egocapture.task_participant_plans plan
    join egocapture.participants participant on participant.id = plan.participant_id
    left join egocapture.devices preferred_device on preferred_device.id = plan.preferred_device_id
    where plan.task_id = ${task.id}::uuid
      and plan.removed_at is null
      and plan.assignment_id is null
    order by plan.created_at desc, participant.public_id
  `;
  const participants = [...plannedParticipants, ...assignedParticipants];

  const eligibleParticipants = await db<{
    publicId: string;
    displayAlias: string;
    status: string;
    consentStatus: string;
    locale: string;
    countryRegion: string | null;
    defaultDevicePublicId: string | null;
    currentAssignmentPublicId: string | null;
    currentTaskState: "planned" | "assigned" | null;
    devices: Array<{ publicId: string; label: string }>;
  }[]>`
    select
      participant.public_id,
      participant.display_alias,
      participant.status,
      participant.consent_status,
      participant.locale,
      participant.country_region,
      default_device.public_id as default_device_public_id,
      current_assignment.public_id as current_assignment_public_id,
      case
        when current_assignment.public_id is not null then 'assigned'
        when current_plan.id is not null then 'planned'
        else null
      end as current_task_state,
      coalesce(devices.items, '[]'::jsonb) as devices
    from egocapture.participants participant
    left join egocapture.devices default_device on default_device.id = participant.default_device_id
    left join lateral (
      select assignment.public_id
      from egocapture.assignments assignment
      where assignment.participant_id = participant.id
        and assignment.task_id = ${task.id}::uuid
        and assignment.status <> 'canceled'
      order by assignment.created_at desc
      limit 1
    ) current_assignment on true
    left join lateral (
      select plan.id
      from egocapture.task_participant_plans plan
      where plan.participant_id = participant.id
        and plan.task_id = ${task.id}::uuid
        and plan.removed_at is null
        and plan.assignment_id is null
      limit 1
    ) current_plan on true
    left join lateral (
      select jsonb_agg(
        jsonb_build_object(
          'publicId', device.public_id,
          'label', device.manufacturer || ' ' || device.model
        ) order by (device.id = participant.default_device_id) desc, device.public_id
      ) as items
      from egocapture.devices device
      left join egocapture.device_assignments device_assignment
        on device_assignment.device_id = device.id
       and device_assignment.participant_id = participant.id
       and device_assignment.ended_at is null
      where device.status = 'shared'
         or (device.status = 'active' and device_assignment.id is not null)
    ) devices on true
    order by (participant.status = 'active' and participant.consent_status = 'valid') desc,
      participant.display_alias, participant.public_id
    limit 200
  `;

  const uploads = await db<{
    publicId: string;
    originalFilename: string;
    sizeBytes: number;
    transferStatus: string;
    metadataStatus: string;
    participantPublicId: string;
    participantAlias: string;
    videoAssetPublicId: string | null;
    decisionType: string | null;
    sessionPublicId: string | null;
    deviceConsistency: string | null;
    durationMs: number | null;
    width: number | null;
    height: number | null;
    frameRate: number | null;
    reviewCount: number;
    createdAt: Date;
  }[]>`
    select distinct
      intent.public_id,
      intent.original_filename,
      intent.size_bytes::integer,
      intent.transfer_status,
      intent.metadata_status,
      participant.public_id as participant_public_id,
      participant.display_alias as participant_alias,
      asset.public_id as video_asset_public_id,
      decision.decision_type,
      coalesce(resolved_session.public_id, claimed_session.public_id) as session_public_id,
      metadata.device_consistency,
      metadata.duration_ms::integer,
      metadata.width,
      metadata.height,
      metadata.frame_rate::float8,
      (
        select count(*)::integer from egocapture.review_cases review
        where review.status in ('open', 'in_review')
          and (review.upload_intent_id = intent.id or review.video_asset_id = asset.id)
      ) as review_count,
      intent.created_at
    from egocapture.upload_intents intent
    join egocapture.participants participant on participant.id = intent.participant_id
    left join egocapture.recording_sessions claimed_session on claimed_session.id = intent.claimed_session_id
    left join egocapture.assignments claimed_assignment on claimed_assignment.id = claimed_session.assignment_id
    left join egocapture.video_assets asset on asset.upload_intent_id = intent.id
    left join egocapture.current_match_decisions decision on decision.video_asset_id = asset.id
    left join egocapture.recording_sessions resolved_session on resolved_session.id = decision.resolved_session_id
    left join egocapture.assignments resolved_assignment on resolved_assignment.id = resolved_session.assignment_id
    left join egocapture.video_file_metadata metadata on metadata.video_asset_id = asset.id
    where claimed_assignment.task_id = ${task.id}::uuid
       or resolved_assignment.task_id = ${task.id}::uuid
    order by intent.created_at desc, intent.public_id desc
    limit 100
  `;

  const audits = await db<{
    id: string;
    action: string;
    entityPublicId: string | null;
    actorDisplayName: string | null;
    reason: string | null;
    beforeValues: Record<string, unknown> | null;
    afterValues: Record<string, unknown> | null;
    createdAt: Date;
  }[]>`
    select audit.id, audit.action, audit.entity_public_id, profile.display_name as actor_display_name,
      audit.reason, audit.before_values, audit.after_values, audit.created_at
    from egocapture.audit_events audit
    left join egocapture.profiles profile on profile.id = audit.actor_profile_id
    where audit.entity_public_id = ${taskPublicId}
      or audit.entity_public_id in (
        select assignment.public_id from egocapture.assignments assignment
        where assignment.task_id = ${task.id}::uuid
      )
      or audit.after_values ->> 'taskPublicId' = ${taskPublicId}
    order by audit.created_at desc, audit.id desc
    limit 50
  `;

  const currentParticipants = participants.filter((participant) => participant.status !== "canceled");
  const completedCount = currentParticipants.filter((participant) => participant.status === "accepted").length;
  const attentionCount = currentParticipants.filter((participant) => participant.isMissing || participant.reviewCount > 0 || ["needs_review", "rework_required", "expired", "missing_upload"].includes(participant.status)).length;
  const videoCount = new Set(uploads.filter((upload) => upload.videoAssetPublicId && ["participant_claim", "admin_confirmed", "admin_corrected"].includes(upload.decisionType ?? "")).map((upload) => upload.videoAssetPublicId)).size;
  const operationalStatus = task.lifecycle === "archived"
    ? "archived"
    : task.lifecycle === "draft"
      ? "draft"
      : currentParticipants.length === 0
      ? "awaiting_participants"
      : completedCount === currentParticipants.length
        ? "completed"
        : attentionCount > 0
          ? "needs_attention"
          : "running";

  return {
    summary: {
      operationalStatus,
      participantCount: currentParticipants.length,
      completedCount,
      videoCount,
      attentionCount,
    },
    participants,
    eligibleParticipants,
    uploads,
    audits,
  };
}

export async function createTask(
  viewer: Viewer,
  input: z.infer<typeof createTaskSchema>,
  idempotencyKey: string,
  requestId: string,
) {
  const db = database();
  return await db.begin(async (transaction) => await withIdempotency(transaction, {
    actorAuthUserId: viewer.authUserId,
    commandName: "task.create",
    idempotencyKey,
    input,
    execute: async () => {
      const publicId = createPublicId("TSK");
      const [task] = await transaction<{ id: string; publicId: string; updatedAt: Date }[]>`
        insert into egocapture.tasks (
          public_id, title, draft_instructions, created_by
        ) values (
          ${publicId}, ${input.instructions.title},
          ${transaction.json(input.instructions)}, ${viewer.profileId}::uuid
        ) returning id, public_id, updated_at
      `;
      await writeAudit(transaction, {
        actorProfileId: viewer.profileId,
        actorAuthUserId: viewer.authUserId,
        action: "task.created",
        entityType: "task",
        entityPublicId: task.publicId,
        requestId,
        afterValues: { title: input.instructions.title, lifecycle: "draft", schemaVersion: input.instructions.schemaVersion },
      });
      return { taskPublicId: task.publicId, updatedAt: task.updatedAt.toISOString() };
    },
  }));
}

export async function updateTask(
  viewer: Viewer,
  taskPublicId: string,
  input: z.infer<typeof updateTaskSchema>,
  requestId: string,
) {
  const db = database();
  return await db.begin(async (transaction) => {
    const [task] = await transaction<{
      id: string;
      publicId: string;
      title: string;
      lifecycle: "draft" | "active" | "archived";
      updatedAt: Date;
      isFixture: boolean;
    }[]>`
      select task.id, task.public_id, task.title, task.lifecycle,
             task.updated_at, task.is_fixture
      from egocapture.tasks task
      where task.public_id = ${taskPublicId}
      for update of task
    `;
    if (!task) throw new DomainError("NOT_FOUND", "Task 或资源不存在", 404);
    if (viewer.isDemoAdmin && task.isFixture) {
      throw new DomainError("FIXTURE_PROTECTED", "公开 Demo 的系统 Task 不可修改", 403);
    }
    if (task.lifecycle === "archived") throw new DomainError("TASK_ARCHIVED", "Archived Task 不可编辑", 409);
    if (task.updatedAt.toISOString() !== input.expectedUpdatedAt) {
      throw new DomainError("STALE_WRITE", "Task 已被其他操作更新，请刷新后重试", 409);
    }
    const [updated] = await transaction<{ updatedAt: Date }[]>`
      update egocapture.tasks
      set title = ${input.instructions.title},
          draft_instructions = ${transaction.json(input.instructions)}
      where id = ${task.id}::uuid
      returning updated_at
    `;
    await writeAudit(transaction, {
      actorProfileId: viewer.profileId,
      actorAuthUserId: viewer.authUserId,
      action: "task.draft_updated",
      entityType: "task",
      entityPublicId: task.publicId,
      requestId,
      beforeValues: { title: task.title },
      afterValues: { title: input.instructions.title, schemaVersion: input.instructions.schemaVersion },
    });
    return { taskPublicId, updatedAt: updated.updatedAt.toISOString() };
  });
}

export async function publishTask(
  viewer: Viewer,
  taskPublicId: string,
  idempotencyKey: string,
  requestId: string,
) {
  const db = database();
  return await db.begin(async (transaction) => await withIdempotency(transaction, {
    actorAuthUserId: viewer.authUserId,
    commandName: "task.publish",
    idempotencyKey,
    input: { taskPublicId },
    execute: async () => {
      const [task] = await transaction<{
        id: string;
        publicId: string;
        draftInstructions: TaskInstructions;
        lifecycle: string;
        isFixture: boolean;
      }[]>`
        select task.id, task.public_id, task.draft_instructions,
               task.lifecycle, task.is_fixture
        from egocapture.tasks task
        where task.public_id = ${taskPublicId}
        for update of task
      `;
      if (!task) throw new DomainError("NOT_FOUND", "Task 或资源不存在", 404);
      if (viewer.isDemoAdmin && task.isFixture) {
        throw new DomainError("FIXTURE_PROTECTED", "公开 Demo 的系统 Task 不可发布", 403);
      }
      if (task.lifecycle === "archived") throw new DomainError("TASK_ARCHIVED", "Archived Task 不可发布", 409);
      const instructions = taskInstructionsSchema.parse(task.draftInstructions);
      const contentHash = taskContentHash(instructions);
      const [next] = await transaction<{ version: number }[]>`
        select coalesce(max(version), 0)::integer + 1 as version
        from egocapture.task_versions
        where task_id = ${task.id}::uuid
      `;
      const [publishedVersion] = await transaction<{ id: string }[]>`
        insert into egocapture.task_versions (
          task_id, version, instructions, content_hash, published_by
        ) values (
          ${task.id}::uuid, ${next.version},
          ${transaction.json(instructions)}, ${contentHash}, ${viewer.profileId}::uuid
        )
        returning id
      `;
      const plannedParticipants = await transaction<{
        id: string;
        participantId: string;
        participantPublicId: string;
        participantStatus: string;
        consentStatus: string;
        preferredDeviceId: string | null;
        preferredDevicePublicId: string | null;
        dueAt: Date;
        locale: string;
        note: string | null;
      }[]>`
        select
          plan.id,
          participant.id as participant_id,
          participant.public_id as participant_public_id,
          participant.status as participant_status,
          participant.consent_status,
          plan.preferred_device_id,
          device.public_id as preferred_device_public_id,
          plan.due_at,
          plan.locale,
          plan.note
        from egocapture.task_participant_plans plan
        join egocapture.participants participant on participant.id = plan.participant_id
        left join egocapture.devices device on device.id = plan.preferred_device_id
        where plan.task_id = ${task.id}::uuid
          and plan.removed_at is null
          and plan.assignment_id is null
        order by plan.created_at, plan.id
        for update of plan, participant
      `;
      for (const planned of plannedParticipants) {
        if (planned.participantStatus !== "active" || planned.consentStatus !== "valid") {
          throw new DomainError(
            "PARTICIPANT_NOT_ELIGIBLE",
            `参与者 ${planned.participantPublicId} 当前不可分配，请先从草稿名单移除或恢复其状态`,
            422,
          );
        }
        if (planned.dueAt <= new Date()) {
          throw new DomainError(
            "ROSTER_DUE_AT_PAST",
            `参与者 ${planned.participantPublicId} 的截止时间已过，请先从草稿名单移除后重新添加`,
            422,
          );
        }
        const preferredDeviceId = await resolvePreferredDevice(
          transaction,
          planned.participantId,
          planned.preferredDevicePublicId,
        );
        if (planned.preferredDeviceId && !preferredDeviceId) {
          throw new DomainError(
            "DEVICE_NOT_AVAILABLE",
            `参与者 ${planned.participantPublicId} 的首选设备当前不可用，请先更新草稿名单`,
            422,
          );
        }
        const assignmentPublicId = createPublicId("AS");
        const [assignment] = await transaction<{ id: string }[]>`
          insert into egocapture.assignments (
            public_id, participant_id, task_id, task_version_id, preferred_device_id,
            due_at, locale, note, created_by
          ) values (
            ${assignmentPublicId}, ${planned.participantId}::uuid, ${task.id}::uuid,
            ${publishedVersion.id}::uuid, ${preferredDeviceId}::uuid,
            ${planned.dueAt}, ${planned.locale}, ${planned.note}, ${viewer.profileId}::uuid
          )
          returning id
        `;
        await transaction`
          update egocapture.task_participant_plans
          set assignment_id = ${assignment.id}::uuid, updated_at = now()
          where id = ${planned.id}::uuid
        `;
        await writeAudit(transaction, {
          actorProfileId: viewer.profileId,
          actorAuthUserId: viewer.authUserId,
          action: "assignment.created",
          entityType: "assignment",
          entityPublicId: assignmentPublicId,
          requestId,
          afterValues: {
            participantPublicId: planned.participantPublicId,
            taskPublicId,
            taskVersion: next.version,
            dueAt: planned.dueAt.toISOString(),
            preferredDevicePublicId: planned.preferredDevicePublicId,
            source: "draft_task_participant",
          },
        });
      }
      const [updated] = await transaction<{ updatedAt: Date }[]>`
        update egocapture.tasks set lifecycle = 'active' where id = ${task.id}::uuid
        returning updated_at
      `;
      await writeAudit(transaction, {
        actorProfileId: viewer.profileId,
        actorAuthUserId: viewer.authUserId,
        action: "task.published",
        entityType: "task",
        entityPublicId: task.publicId,
        requestId,
        afterValues: {
          version: next.version,
          contentHash,
          schemaVersion: instructions.schemaVersion,
          materializedParticipantCount: plannedParticipants.length,
        },
      });
      return {
        taskPublicId,
        version: next.version,
        contentHash,
        materializedParticipantCount: plannedParticipants.length,
        updatedAt: updated.updatedAt.toISOString(),
      };
    },
  }));
}

export async function listAssignments(
  _viewer: Viewer,
  input: z.infer<typeof assignmentListSchema>,
) {
  const db = database();
  const rows = await db<{
    publicId: string;
    status: AssignmentStatus;
    dueAt: Date;
    participantPublicId: string;
    participantAlias: string;
    taskPublicId: string;
    taskTitle: string;
    taskVersion: number;
    isMissing: boolean;
  }[]>`
    select distinct
      assignment.public_id,
      assignment.status,
      assignment.due_at,
      participant.public_id as participant_public_id,
      participant.display_alias as participant_alias,
      task.public_id as task_public_id,
      version.instructions ->> 'title' as task_title,
      version.version as task_version,
      progress.is_missing
    from egocapture.assignments assignment
    join egocapture.participants participant on participant.id = assignment.participant_id
    join egocapture.task_versions version on version.id = assignment.task_version_id
    join egocapture.tasks task on task.id = version.task_id
    join egocapture.assignment_progress progress on progress.id = assignment.id
    where (${input.search ?? null}::text is null
        or assignment.public_id ilike '%' || ${input.search ?? ""} || '%'
        or participant.public_id ilike '%' || ${input.search ?? ""} || '%'
        or participant.display_alias ilike '%' || ${input.search ?? ""} || '%'
        or task.title ilike '%' || ${input.search ?? ""} || '%')
      and (${input.status ?? null}::text is null or assignment.status = ${input.status ?? ""})
      and (${input.cursor ?? null}::text is null or assignment.public_id > ${input.cursor ?? ""})
    order by assignment.public_id
    limit ${input.limit + 1}
  `;
  const hasNext = rows.length > input.limit;
  const items = rows.slice(0, input.limit);
  return { items, nextCursor: hasNext ? items.at(-1)?.publicId ?? null : null };
}

export async function createAssignment(
  viewer: Viewer,
  input: z.infer<typeof createAssignmentSchema>,
  idempotencyKey: string,
  requestId: string,
) {
  const dueAt = new Date(input.dueAt);
  if (dueAt <= new Date()) throw new DomainError("DUE_AT_IN_PAST", "Due At 必须晚于当前时间", 422);
  const db = database();
  return await db.begin(async (transaction) => await withIdempotency(transaction, {
    actorAuthUserId: viewer.authUserId,
    commandName: "assignment.create",
    idempotencyKey,
    input,
    execute: async () => {
      const [authority] = await transaction<{
        participantId: string;
        participantStatus: string;
        consentStatus: string;
        locale: string;
        taskId: string;
        taskLifecycle: string;
        taskVersionId: string;
        taskTitle: string;
      }[]>`
        select
          participant.id as participant_id,
          participant.status as participant_status,
          participant.consent_status,
          participant.locale,
          task.id as task_id,
          task.lifecycle as task_lifecycle,
          version.id as task_version_id,
          task.title as task_title
        from egocapture.participants participant
        join egocapture.tasks task on task.public_id = ${input.taskPublicId}
        join egocapture.task_versions version on version.task_id = task.id
          and version.version = ${input.taskVersion}
        where participant.public_id = ${input.participantPublicId}
        for update of participant
      `;
      if (!authority) throw new DomainError("NOT_FOUND", "Participant、TaskVersion 或资源不存在", 404);
      if (authority.participantStatus !== "active" || authority.consentStatus !== "valid") {
        throw new DomainError("PARTICIPANT_NOT_ELIGIBLE", "Participant 必须 Active 且 Consent 有效", 422);
      }
      if (authority.taskLifecycle === "archived") {
        throw new DomainError("TASK_ARCHIVED", "已归档任务不能添加参与者", 409);
      }
      let preferredDeviceId: string | null = null;
      if (input.preferredDevicePublicId) {
        const [device] = await transaction<{ id: string }[]>`
          select device.id
          from egocapture.devices device
          where device.public_id = ${input.preferredDevicePublicId}
            and device.status in ('active', 'shared')
            and (
              device.status = 'shared'
              or exists (
                select 1 from egocapture.device_assignments assignment
                where assignment.device_id = device.id
                  and assignment.participant_id = ${authority.participantId}::uuid
                  and assignment.ended_at is null
              )
            )
        `;
        if (!device) throw new DomainError("DEVICE_NOT_AVAILABLE", "Preferred Device 未分配给该 Participant", 422);
        preferredDeviceId = device.id;
      }
      const publicId = createPublicId("AS");
      const assignments = await transaction<{ publicId: string }[]>`
        insert into egocapture.assignments (
          public_id, participant_id, task_id, task_version_id, preferred_device_id,
          due_at, locale, note, created_by
        ) values (
          ${publicId}, ${authority.participantId}::uuid,
          ${authority.taskId}::uuid, ${authority.taskVersionId}::uuid, ${preferredDeviceId}::uuid,
          ${dueAt}, ${input.locale ?? authority.locale}, ${input.note ?? null}, ${viewer.profileId}::uuid
        )
        on conflict (participant_id, task_id)
          where status <> 'canceled'
        do nothing
        returning public_id
      `;
      const assignment = assignments[0];
      if (!assignment) {
        throw new DomainError("ACTIVE_ASSIGNMENT_EXISTS", "该参与者已经在当前任务中", 409);
      }
      await writeAudit(transaction, {
        actorProfileId: viewer.profileId,
        actorAuthUserId: viewer.authUserId,
        action: "assignment.created",
        entityType: "assignment",
        entityPublicId: assignment.publicId,
        requestId,
        afterValues: {
          participantPublicId: input.participantPublicId,
          taskPublicId: input.taskPublicId,
          taskVersion: input.taskVersion,
          dueAt: dueAt.toISOString(),
          preferredDevicePublicId: input.preferredDevicePublicId ?? null,
        },
      });
      return { assignmentPublicId: assignment.publicId };
    },
  }));
}

async function resolvePreferredDevice(
  transaction: postgres.TransactionSql,
  participantId: string,
  preferredDevicePublicId: string | null | undefined,
) {
  if (!preferredDevicePublicId) return null;
  const [device] = await transaction<{ id: string }[]>`
    select device.id
    from egocapture.devices device
    where device.public_id = ${preferredDevicePublicId}
      and device.status in ('active', 'shared')
      and (
        device.status = 'shared'
        or exists (
          select 1 from egocapture.device_assignments assignment
          where assignment.device_id = device.id
            and assignment.participant_id = ${participantId}::uuid
            and assignment.ended_at is null
        )
      )
    limit 1
  `;
  return device?.id ?? null;
}

export async function addTaskParticipants(
  viewer: Viewer,
  taskPublicId: string,
  input: z.infer<typeof addTaskParticipantsSchema>,
  idempotencyKey: string,
  requestId: string,
) {
  taskPublicIdSchema.parse(taskPublicId);
  const dueAt = new Date(input.dueAt);
  if (dueAt <= new Date()) throw new DomainError("DUE_AT_IN_PAST", "截止时间必须晚于当前时间", 422);
  const db = database();
  return await db.begin(async (transaction) => await withIdempotency(transaction, {
    actorAuthUserId: viewer.authUserId,
    commandName: "task.participants.add",
    idempotencyKey,
    input: { taskPublicId, ...input },
    execute: async () => {
      const [task] = await transaction<{
        id: string;
        lifecycle: string;
      }[]>`
        select task.id, task.lifecycle
        from egocapture.tasks task
        where task.public_id = ${taskPublicId}
        for update of task
      `;
      if (!task) throw new DomainError("NOT_FOUND", "任务不存在", 404);
      if (task.lifecycle === "archived") throw new DomainError("TASK_ARCHIVED", "已归档任务不能添加参与者", 409);

      const [latestVersion] = await transaction<{ id: string; version: number }[]>`
        select id, version
        from egocapture.task_versions
        where task_id = ${task.id}::uuid
        order by version desc
        limit 1
      `;
      const requestedVersion = input.taskVersion ?? latestVersion?.version ?? null;
      const [taskVersion] = requestedVersion === null
        ? []
        : await transaction<{ id: string; version: number }[]>`
            select id, version
            from egocapture.task_versions
            where task_id = ${task.id}::uuid and version = ${requestedVersion}
            limit 1
          `;
      if (requestedVersion !== null && !taskVersion) {
        throw new DomainError("NOT_FOUND", "所选任务版本不存在", 404);
      }

      const created: Array<{
        participantPublicId: string;
        assignmentPublicId: string | null;
        state: "planned" | "assigned";
      }> = [];
      const skipped: Array<{ participantPublicId: string; code: string; message: string }> = [];

      for (const selection of input.participants) {
        const [participant] = await transaction<{
          id: string;
          publicId: string;
          status: string;
          consentStatus: string;
          locale: string;
        }[]>`
          select id, public_id, status, consent_status, locale
          from egocapture.participants
          where public_id = ${selection.participantPublicId}
          for update
        `;
        if (!participant) {
          skipped.push({ participantPublicId: selection.participantPublicId, code: "NOT_FOUND", message: "参与者不存在" });
          continue;
        }
        if (participant.status !== "active" || participant.consentStatus !== "valid") {
          skipped.push({ participantPublicId: participant.publicId, code: "PARTICIPANT_NOT_ELIGIBLE", message: "参与者必须处于启用状态且授权有效" });
          continue;
        }
        const [existing] = await transaction<{ state: string }[]>`
          select 'assigned'::text as state
          from egocapture.assignments
          where participant_id = ${participant.id}::uuid
            and task_id = ${task.id}::uuid
            and status <> 'canceled'
          union all
          select 'planned'::text as state
          from egocapture.task_participant_plans
          where participant_id = ${participant.id}::uuid
            and task_id = ${task.id}::uuid
            and removed_at is null
            and assignment_id is null
          limit 1
        `;
        if (existing) {
          skipped.push({
            participantPublicId: participant.publicId,
            code: existing.state === "planned" ? "CURRENT_TASK_PARTICIPANT_EXISTS" : "CURRENT_ASSIGNMENT_EXISTS",
            message: existing.state === "planned" ? "已经在草稿发布名单中" : "已经在当前任务中",
          });
          continue;
        }
        const preferredDeviceId = await resolvePreferredDevice(transaction, participant.id, selection.preferredDevicePublicId);
        if (selection.preferredDevicePublicId && !preferredDeviceId) {
          skipped.push({ participantPublicId: participant.publicId, code: "DEVICE_NOT_AVAILABLE", message: "首选设备不可用于该参与者" });
          continue;
        }
        if (!taskVersion) {
          await transaction`
            insert into egocapture.task_participant_plans (
              task_id, participant_id, preferred_device_id, due_at, locale, note, created_by
            ) values (
              ${task.id}::uuid, ${participant.id}::uuid, ${preferredDeviceId}::uuid,
              ${dueAt}, ${participant.locale}, ${input.note ?? null}, ${viewer.profileId}::uuid
            )
          `;
          await writeAudit(transaction, {
            actorProfileId: viewer.profileId,
            actorAuthUserId: viewer.authUserId,
            action: "task.participant_planned",
            entityType: "task",
            entityPublicId: taskPublicId,
            requestId,
            afterValues: {
              participantPublicId: participant.publicId,
              dueAt: dueAt.toISOString(),
              preferredDevicePublicId: selection.preferredDevicePublicId ?? null,
            },
          });
          created.push({ participantPublicId: participant.publicId, assignmentPublicId: null, state: "planned" });
          continue;
        }

        const assignmentPublicId = createPublicId("AS");
        await transaction`
          insert into egocapture.assignments (
            public_id, participant_id, task_id, task_version_id, preferred_device_id,
            due_at, locale, note, created_by
          ) values (
            ${assignmentPublicId}, ${participant.id}::uuid, ${task.id}::uuid,
            ${taskVersion.id}::uuid, ${preferredDeviceId}::uuid,
            ${dueAt}, ${participant.locale}, ${input.note ?? null}, ${viewer.profileId}::uuid
          )
        `;
        await writeAudit(transaction, {
          actorProfileId: viewer.profileId,
          actorAuthUserId: viewer.authUserId,
          action: "assignment.created",
          entityType: "assignment",
          entityPublicId: assignmentPublicId,
          requestId,
          afterValues: {
            participantPublicId: participant.publicId,
            taskPublicId,
            taskVersion: taskVersion.version,
            dueAt: dueAt.toISOString(),
            preferredDevicePublicId: selection.preferredDevicePublicId ?? null,
            source: "task_roster",
          },
        });
        created.push({ participantPublicId: participant.publicId, assignmentPublicId, state: "assigned" });
      }

      await writeAudit(transaction, {
        actorProfileId: viewer.profileId,
        actorAuthUserId: viewer.authUserId,
        action: "task.participants_added",
        entityType: "task",
        entityPublicId: taskPublicId,
        requestId,
        afterValues: {
          taskVersion: taskVersion?.version ?? null,
          state: taskVersion ? "assigned" : "planned",
          createdCount: created.length,
          skippedCount: skipped.length,
          participantPublicIds: created.map((item) => item.participantPublicId),
        },
      });
      return { taskPublicId, created, skipped };
    },
  }));
}

export async function removePlannedTaskParticipant(
  viewer: Viewer,
  taskPublicId: string,
  participantPublicId: string,
  requestId: string,
) {
  taskPublicIdSchema.parse(taskPublicId);
  participantPublicIdSchema.parse(participantPublicId);
  const db = database();
  return await db.begin(async (transaction) => {
    const [plan] = await transaction<{
      id: string;
      participantPublicId: string;
      dueAt: Date;
      preferredDevicePublicId: string | null;
    }[]>`
      select
        plan.id,
        participant.public_id as participant_public_id,
        plan.due_at,
        device.public_id as preferred_device_public_id
      from egocapture.task_participant_plans plan
      join egocapture.tasks task on task.id = plan.task_id
      join egocapture.participants participant on participant.id = plan.participant_id
      left join egocapture.devices device on device.id = plan.preferred_device_id
      where task.public_id = ${taskPublicId}
        and participant.public_id = ${participantPublicId}
        and plan.removed_at is null
        and plan.assignment_id is null
      for update of plan
    `;
    if (!plan) throw new DomainError("NOT_FOUND", "草稿发布名单中没有该参与者", 404);
    await transaction`
      update egocapture.task_participant_plans
      set removed_at = now(), removed_by = ${viewer.profileId}::uuid, updated_at = now()
      where id = ${plan.id}::uuid
    `;
    await writeAudit(transaction, {
      actorProfileId: viewer.profileId,
      actorAuthUserId: viewer.authUserId,
      action: "task.participant_unplanned",
      entityType: "task",
      entityPublicId: taskPublicId,
      requestId,
      beforeValues: {
        participantPublicId: plan.participantPublicId,
        dueAt: plan.dueAt.toISOString(),
        preferredDevicePublicId: plan.preferredDevicePublicId,
        state: "planned",
      },
      afterValues: { participantPublicId: plan.participantPublicId, state: "removed" },
    });
    return { taskPublicId, participantPublicId, status: "removed" as const };
  });
}

export async function replaceTaskParticipant(
  viewer: Viewer,
  assignmentPublicId: string,
  input: z.infer<typeof replaceTaskParticipantSchema>,
  idempotencyKey: string,
  requestId: string,
) {
  assignmentPublicIdSchema.parse(assignmentPublicId);
  const dueAt = new Date(input.dueAt);
  if (dueAt <= new Date()) throw new DomainError("DUE_AT_IN_PAST", "替代参与者的截止时间必须晚于当前时间", 422);
  const db = database();
  return await db.begin(async (transaction) => await withIdempotency(transaction, {
    actorAuthUserId: viewer.authUserId,
    commandName: "assignment.replace",
    idempotencyKey,
    input: { assignmentPublicId, ...input },
    execute: async () => {
      const [original] = await transaction<{
        id: string;
        publicId: string;
        participantId: string;
        participantPublicId: string;
        status: AssignmentStatus;
        taskId: string;
        taskPublicId: string;
        taskVersion: number;
        note: string | null;
      }[]>`
        select assignment.id, assignment.public_id, assignment.participant_id,
          participant.public_id as participant_public_id, assignment.status,
          assignment.task_id, task.public_id as task_public_id,
          version.version as task_version, assignment.note
        from egocapture.assignments assignment
        join egocapture.participants participant on participant.id = assignment.participant_id
        join egocapture.tasks task on task.id = assignment.task_id
        join egocapture.task_versions version on version.id = assignment.task_version_id
        where assignment.public_id = ${assignmentPublicId}
        for update of assignment
      `;
      if (!original) throw new DomainError("NOT_FOUND", "任务参与记录不存在", 404);
      if (["accepted", "canceled"].includes(original.status)) {
        throw new DomainError("INVALID_ASSIGNMENT_STATE", "已完成或已停止的参与者不能替换", 409);
      }
      if (original.participantPublicId === input.participantPublicId) {
        throw new DomainError("SAME_PARTICIPANT", "请选择另一名参与者", 422);
      }

      const [replacement] = await transaction<{
        id: string;
        publicId: string;
        status: string;
        consentStatus: string;
        locale: string;
      }[]>`
        select id, public_id, status, consent_status, locale
        from egocapture.participants
        where public_id = ${input.participantPublicId}
        for update
      `;
      if (!replacement) throw new DomainError("NOT_FOUND", "替代参与者不存在", 404);
      if (replacement.status !== "active" || replacement.consentStatus !== "valid") {
        throw new DomainError("PARTICIPANT_NOT_ELIGIBLE", "替代参与者必须处于启用状态且授权有效", 422);
      }
      const [current] = await transaction<{ publicId: string }[]>`
        select public_id from egocapture.assignments
        where participant_id = ${replacement.id}::uuid
          and task_id = ${original.taskId}::uuid
          and status <> 'canceled'
        limit 1
      `;
      if (current) throw new DomainError("CURRENT_ASSIGNMENT_EXISTS", "替代参与者已经在当前任务中", 409);

      const versionNumber = input.taskVersion ?? original.taskVersion;
      const [taskVersion] = await transaction<{ id: string }[]>`
        select id from egocapture.task_versions
        where task_id = ${original.taskId}::uuid and version = ${versionNumber}
        limit 1
      `;
      if (!taskVersion) throw new DomainError("NOT_FOUND", "所选任务版本不存在", 404);
      const preferredDeviceId = await resolvePreferredDevice(transaction, replacement.id, input.preferredDevicePublicId);
      if (input.preferredDevicePublicId && !preferredDeviceId) {
        throw new DomainError("DEVICE_NOT_AVAILABLE", "首选设备不可用于替代参与者", 422);
      }

      await transaction`
        update egocapture.assignments
        set status = 'canceled', canceled_at = now()
        where id = ${original.id}::uuid
      `;
      const closedSessions = await transaction`
        update egocapture.recording_sessions
        set status = 'closed', closed_at = now(), close_reason = ${input.reason}
        where assignment_id = ${original.id}::uuid and status = 'open'
        returning id
      `;
      const newAssignmentPublicId = createPublicId("AS");
      await transaction`
        insert into egocapture.assignments (
          public_id, participant_id, task_id, task_version_id, preferred_device_id,
          due_at, locale, note, replaces_assignment_id, created_by
        ) values (
          ${newAssignmentPublicId}, ${replacement.id}::uuid, ${original.taskId}::uuid,
          ${taskVersion.id}::uuid, ${preferredDeviceId}::uuid, ${dueAt},
          ${replacement.locale}, ${original.note}, ${original.id}::uuid, ${viewer.profileId}::uuid
        )
      `;
      await writeAudit(transaction, {
        actorProfileId: viewer.profileId,
        actorAuthUserId: viewer.authUserId,
        action: "assignment.replaced",
        entityType: "assignment",
        entityPublicId: original.publicId,
        reason: input.reason,
        requestId,
        beforeValues: { participantPublicId: original.participantPublicId, status: original.status },
        afterValues: {
          status: "canceled",
          replacementParticipantPublicId: replacement.publicId,
          replacementAssignmentPublicId: newAssignmentPublicId,
          closedSessionCount: closedSessions.length,
          taskPublicId: original.taskPublicId,
          taskVersion: versionNumber,
        },
      });
      await writeAudit(transaction, {
        actorProfileId: viewer.profileId,
        actorAuthUserId: viewer.authUserId,
        action: "assignment.created",
        entityType: "assignment",
        entityPublicId: newAssignmentPublicId,
        requestId,
        afterValues: {
          participantPublicId: replacement.publicId,
          taskPublicId: original.taskPublicId,
          taskVersion: versionNumber,
          dueAt: dueAt.toISOString(),
          replacesAssignmentPublicId: original.publicId,
          source: "task_roster_replacement",
        },
      });
      return {
        taskPublicId: original.taskPublicId,
        previousAssignmentPublicId: original.publicId,
        assignmentPublicId: newAssignmentPublicId,
      };
    },
  }));
}

export async function listParticipantAssignments(viewer: Viewer) {
  const db = database();
  const assignments = await db<{
    publicId: string;
    status: AssignmentStatus;
    dueAt: Date;
    taskPublicId: string;
    taskTitle: string;
    taskVersion: number;
    contentHash: string;
    instructions: TaskInstructions;
    preferredDevicePublicId: string | null;
    acknowledgedAt: Date | null;
  }[]>`
    select
      assignment.public_id,
      assignment.status,
      assignment.due_at,
      task.public_id as task_public_id,
      version.instructions ->> 'title' as task_title,
      version.version as task_version,
      version.content_hash,
      version.instructions,
      device.public_id as preferred_device_public_id,
      assignment.acknowledged_at
    from egocapture.assignments assignment
    join egocapture.participants participant on participant.id = assignment.participant_id
    join egocapture.task_versions version on version.id = assignment.task_version_id
    join egocapture.tasks task on task.id = version.task_id
    left join egocapture.devices device on device.id = assignment.preferred_device_id
    where participant.auth_user_id = ${viewer.authUserId}::uuid
    order by assignment.due_at, assignment.public_id
  `;
  return assignments.map((assignment) => ({
    ...assignment,
    instructions: taskInstructionsSchema.parse(assignment.instructions),
  }));
}

export async function getParticipantAssignment(viewer: Viewer, assignmentPublicId: string) {
  const assignments = await listParticipantAssignments(viewer);
  const assignment = assignments.find((item) => item.publicId === assignmentPublicId);
  if (!assignment) throw new DomainError("NOT_FOUND", "Assignment 或资源不存在", 404);
  return { ...assignment, instructions: taskInstructionsSchema.parse(assignment.instructions) };
}

export async function acknowledgeAssignment(
  viewer: Viewer,
  assignmentPublicId: string,
  input: z.infer<typeof acknowledgeAssignmentSchema>,
  requestId: string,
) {
  const db = database();
  return await db.begin(async (transaction) => {
    const [assignment] = await transaction<{
      id: string;
      publicId: string;
      status: AssignmentStatus;
      contentHash: string;
      acknowledgedContentHash: string | null;
      participantStatus: string;
      consentStatus: string;
    }[]>`
      select
        assignment.id,
        assignment.public_id,
        assignment.status,
        version.content_hash,
        assignment.acknowledged_content_hash,
        participant.status as participant_status,
        participant.consent_status
      from egocapture.assignments assignment
      join egocapture.participants participant on participant.id = assignment.participant_id
      join egocapture.task_versions version on version.id = assignment.task_version_id
      where assignment.public_id = ${assignmentPublicId}
        and participant.auth_user_id = ${viewer.authUserId}::uuid
      for update of assignment, participant
    `;
    if (!assignment) throw new DomainError("NOT_FOUND", "Assignment 或资源不存在", 404);
    if (assignment.participantStatus !== "active" || assignment.consentStatus !== "valid") {
      throw new DomainError("PARTICIPANT_NOT_ELIGIBLE", "当前账号不能确认任务", 403);
    }
    if (input.contentHash !== assignment.contentHash) {
      throw new DomainError("CONTENT_HASH_MISMATCH", "任务内容已不一致，无法确认", 409);
    }
    if (assignment.status === "acknowledged" && assignment.acknowledgedContentHash === input.contentHash) {
      return { assignmentPublicId, status: "acknowledged" as const, contentHash: input.contentHash };
    }
    if (!canAcknowledgeAssignment(assignment.status)) {
      throw new DomainError("INVALID_ASSIGNMENT_STATE", "当前 Assignment 状态不能确认", 409);
    }
    await transaction`
      update egocapture.assignments
      set status = 'acknowledged', acknowledged_at = now(), acknowledged_content_hash = ${input.contentHash}
      where id = ${assignment.id}::uuid
    `;
    await writeAudit(transaction, {
      actorProfileId: viewer.profileId,
      actorAuthUserId: viewer.authUserId,
      action: "assignment.acknowledged",
      entityType: "assignment",
      entityPublicId: assignment.publicId,
      requestId,
      beforeValues: { status: assignment.status },
      afterValues: { status: "acknowledged", contentHash: input.contentHash },
    });
    return { assignmentPublicId, status: "acknowledged" as const, contentHash: input.contentHash };
  });
}

async function assignmentForAdmin(
  db: postgres.Sql | postgres.TransactionSql,
  _viewer: Viewer,
  assignmentPublicId: string,
  forUpdate = false,
) {
  const [assignment] = await db<{
    id: string;
    publicId: string;
    status: AssignmentStatus;
    dueAt: Date;
    acknowledgedAt: Date | null;
    taskId: string;
    taskPublicId: string;
  }[]>`
    select assignment.id, assignment.public_id, assignment.status,
           assignment.due_at, assignment.acknowledged_at,
           assignment.task_id, task.public_id as task_public_id
    from egocapture.assignments assignment
    join egocapture.tasks task on task.id = assignment.task_id
    where assignment.public_id = ${assignmentPublicId}
    limit 1
    ${forUpdate ? db`for update of assignment` : db``}
  `;
  if (!assignment) throw new DomainError("NOT_FOUND", "Assignment 或资源不存在", 404);
  return assignment;
}

export async function cancelAssignment(
  viewer: Viewer,
  assignmentPublicId: string,
  reason: string,
  requestId: string,
) {
  const db = database();
  return await db.begin(async (transaction) => {
    const assignment = await assignmentForAdmin(transaction, viewer, assignmentPublicId, true);
    if (!canCancelAssignment(assignment.status)) {
      throw new DomainError("INVALID_ASSIGNMENT_STATE", "当前 Assignment 状态不能取消", 409);
    }
    await transaction`
      select id from egocapture.tasks
      where id = ${assignment.taskId}::uuid
      for update
    `;
    const [roster] = await transaction<{ currentCount: number }[]>`
      select count(*)::integer as current_count
      from egocapture.assignments
      where task_id = ${assignment.taskId}::uuid and status <> 'canceled'
    `;
    if ((roster?.currentCount ?? 0) <= 1) {
      throw new DomainError("TASK_REQUIRES_PARTICIPANT", "任务必须至少保留一名参与者；请使用替换操作", 409);
    }
    await transaction`
      update egocapture.assignments
      set status = 'canceled', canceled_at = now()
      where id = ${assignment.id}::uuid
    `;
    const closedSessions = await transaction`
      update egocapture.recording_sessions
      set status = 'closed', closed_at = now(), close_reason = ${reason}
      where assignment_id = ${assignment.id}::uuid and status = 'open'
      returning id
    `;
    await writeAudit(transaction, {
      actorProfileId: viewer.profileId,
      actorAuthUserId: viewer.authUserId,
      action: "assignment.canceled",
      entityType: "assignment",
      entityPublicId: assignment.publicId,
      reason,
      requestId,
      beforeValues: { status: assignment.status },
      afterValues: { status: "canceled", closedSessionCount: closedSessions.length },
    });
    return { assignmentPublicId, status: "canceled" as const };
  });
}

export async function extendAssignment(
  viewer: Viewer,
  assignmentPublicId: string,
  input: z.infer<typeof extendAssignmentSchema>,
  requestId: string,
) {
  const dueAt = new Date(input.dueAt);
  if (dueAt <= new Date()) throw new DomainError("DUE_AT_IN_PAST", "Due At 必须晚于当前时间", 422);
  const db = database();
  return await db.begin(async (transaction) => {
    const assignment = await assignmentForAdmin(transaction, viewer, assignmentPublicId, true);
    if (["accepted", "canceled"].includes(assignment.status)) {
      throw new DomainError("INVALID_ASSIGNMENT_STATE", "当前 Assignment 状态不能延期", 409);
    }
    const nextStatus = statusAfterExtension(assignment.status, assignment.acknowledgedAt);
    await transaction`
      update egocapture.assignments
      set due_at = ${dueAt}, status = ${nextStatus}
      where id = ${assignment.id}::uuid
    `;
    await writeAudit(transaction, {
      actorProfileId: viewer.profileId,
      actorAuthUserId: viewer.authUserId,
      action: "assignment.extended",
      entityType: "assignment",
      entityPublicId: assignment.publicId,
      reason: input.reason,
      requestId,
      beforeValues: { dueAt: assignment.dueAt.toISOString(), status: assignment.status },
      afterValues: { dueAt: dueAt.toISOString(), status: nextStatus },
    });
    return { assignmentPublicId, status: nextStatus, dueAt: dueAt.toISOString() };
  });
}
