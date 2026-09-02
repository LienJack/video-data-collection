import "server-only";

import type postgres from "postgres";

type AuditInput = {
  studyId: string | null;
  actorProfileId: string | null;
  actorAuthUserId: string | null;
  action: string;
  entityType: string;
  entityPublicId?: string | null;
  reason?: string | null;
  requestId: string;
  beforeValues?: Record<string, unknown> | null;
  afterValues?: Record<string, unknown> | null;
  metadata?: Record<string, unknown>;
};

export async function writeAudit(db: postgres.Sql | postgres.TransactionSql, input: AuditInput) {
  await db`
    insert into egocapture.audit_events (
      study_id,
      actor_profile_id,
      actor_auth_user_id,
      action,
      entity_type,
      entity_public_id,
      reason,
      request_id,
      before_values,
      after_values,
      metadata
    ) values (
      ${input.studyId}::uuid,
      ${input.actorProfileId}::uuid,
      ${input.actorAuthUserId}::uuid,
      ${input.action},
      ${input.entityType},
      ${input.entityPublicId ?? null},
      ${input.reason ?? null},
      ${input.requestId}::uuid,
      ${input.beforeValues ? db.json(input.beforeValues as postgres.JSONValue) : null},
      ${input.afterValues ? db.json(input.afterValues as postgres.JSONValue) : null},
      ${db.json((input.metadata ?? {}) as postgres.JSONValue)}
    )
  `;
}
