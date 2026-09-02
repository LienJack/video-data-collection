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
    isFixture: boolean;
    updatedAt: Date;
  }[]>`
    select distinct
      task.public_id,
      task.title,
      task.lifecycle,
      latest.version as latest_version,
      latest.content_hash as latest_content_hash,
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
    where (${input.search ?? null}::text is null
        or task.public_id ilike '%' || ${input.search ?? ""} || '%'
        or task.title ilike '%' || ${input.search ?? ""} || '%')
      and (${input.lifecycle ?? null}::text is null or task.lifecycle = ${input.lifecycle ?? ""})
      and (${input.cursor ?? null}::text is null or task.public_id > ${input.cursor ?? ""})
    order by task.public_id
    limit ${input.limit + 1}
  `;
  const hasNext = rows.length > input.limit;
  const items = rows.slice(0, input.limit);
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
        afterValues: { title: input.instructions.title, lifecycle: "draft", schemaVersion: "ego-task/1" },
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
      afterValues: { title: input.instructions.title, schemaVersion: "ego-task/1" },
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
      await transaction`
        insert into egocapture.task_versions (
          task_id, version, instructions, content_hash, published_by
        ) values (
          ${task.id}::uuid, ${next.version},
          ${transaction.json(instructions)}, ${contentHash}, ${viewer.profileId}::uuid
        )
      `;
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
        afterValues: { version: next.version, contentHash, schemaVersion: "ego-task/1" },
      });
      return {
        taskPublicId,
        version: next.version,
        contentHash,
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
        taskVersionId: string;
        taskTitle: string;
      }[]>`
        select
          participant.id as participant_id,
          participant.status as participant_status,
          participant.consent_status,
          participant.locale,
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
          public_id, participant_id, task_version_id, preferred_device_id,
          due_at, locale, note, created_by
        ) values (
          ${publicId}, ${authority.participantId}::uuid,
          ${authority.taskVersionId}::uuid, ${preferredDeviceId}::uuid,
          ${dueAt}, ${input.locale ?? authority.locale}, ${input.note ?? null}, ${viewer.profileId}::uuid
        )
        on conflict (participant_id, task_version_id)
          where status not in ('accepted', 'expired', 'canceled')
        do nothing
        returning public_id
      `;
      const assignment = assignments[0];
      if (!assignment) {
        throw new DomainError("ACTIVE_ASSIGNMENT_EXISTS", "相同 Participant 和 TaskVersion 已有未终结 Assignment", 409);
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
  }[]>`
    select assignment.id, assignment.public_id, assignment.status,
           assignment.due_at, assignment.acknowledged_at
    from egocapture.assignments assignment
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
