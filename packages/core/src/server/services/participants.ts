import "server-only";

import { createHash, createHmac, randomUUID } from "node:crypto";
import { z } from "zod";
import { DomainError } from "@egocapture/core/domain/errors";
import {
  consentProjectionMachine,
  deviceMachine,
  invitationMachine,
  participantMachine,
} from "@egocapture/core/domain/lifecycle-machines";
import {
  createInvitationToken,
  hashInvitationToken,
  internalParticipantEmail,
  invitationExpiresAt,
} from "@egocapture/core/domain/invitation";
import type { ParticipantStatus } from "@egocapture/core/domain/participant";
import {
  createParticipantPassword,
  participantCredentialCanLogin,
  participantCredentialStatus,
  type ParticipantLoginCredential,
} from "@egocapture/core/domain/participant-credential";
import { createPublicId } from "@egocapture/core/domain/public-id";
import { createPageResult, pageNumberSchema, pageSizeSchema, resolvePage } from "@egocapture/core/pagination";
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
import {
  assertServiceTransitionSet,
  resolveServiceTransition,
} from "@egocapture/core/server/state-transition";
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
  page: pageNumberSchema,
  pageSize: pageSizeSchema(25, 50),
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
  consentStatus: "pending" | "valid" | "expired" | "withdrawn";
  displayAlias: string;
  isFixture: boolean;
};

type ParticipantCredentialRow = ParticipantRow & {
  authUserId: string | null;
  loginPassword: string | null;
  loginCredentialVersion: number;
  loginPasswordUpdatedAt: Date | null;
  loginPasswordSyncedAt: Date | null;
};

const credentialResetCommandName = "participant.credentials.reset";

function credentialRequestHash(participantPublicId: string) {
  return createHash("sha256").update(JSON.stringify({ participantPublicId })).digest("hex");
}

function toLoginCredential(participant: ParticipantCredentialRow): ParticipantLoginCredential {
  const status = participantCredentialStatus({
    password: participant.loginPassword,
    authUserId: participant.authUserId,
    updatedAt: participant.loginPasswordUpdatedAt,
    syncedAt: participant.loginPasswordSyncedAt,
  });
  return {
    username: participant.publicId,
    password: participant.loginPassword,
    loginUrl: `${serverEnvironment().PARTICIPANT_SITE_URL.replace(/\/$/, "")}/login`,
    version: participant.loginCredentialVersion,
    status,
    canLogin: participantCredentialCanLogin({
      credentialStatus: status,
      participantStatus: participant.status,
      consentStatus: participant.consentStatus,
    }),
    updatedAt: participant.loginPasswordUpdatedAt?.toISOString() ?? null,
    syncedAt: participant.loginPasswordSyncedAt?.toISOString() ?? null,
  };
}

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
  const filters = db`
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
  `;
  const [count] = await db<{ totalItems: number }[]>`
    select count(*)::integer as total_items
    from egocapture.participants participant
    ${filters}
  `;
  const pagination = resolvePage(count?.totalItems ?? 0, input.page, input.pageSize);
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
    ${filters}
    order by participant.public_id
    limit ${pagination.pageSize}
    offset ${pagination.offset}
  `;
  return createPageResult(rows, pagination);
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
    authUserId: string | null;
    loginPassword: string | null;
    loginCredentialVersion: number;
    loginPasswordUpdatedAt: Date | null;
    loginPasswordSyncedAt: Date | null;
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
      participant.updated_at,
      participant.auth_user_id,
      credential.password as login_password,
      coalesce(credential.version, 0)::integer as login_credential_version,
      credential.updated_at as login_password_updated_at,
      credential.synced_at as login_password_synced_at
    from egocapture.participants participant
    left join egocapture.participant_login_credentials credential
      on credential.participant_id = participant.id
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
  const {
    authUserId,
    loginPassword,
    loginCredentialVersion,
    loginPasswordUpdatedAt,
    loginPasswordSyncedAt,
    ...publicDetail
  } = detail;
  return {
    ...publicDetail,
    loginCredential: toLoginCredential({
      ...participant,
      authUserId,
      loginPassword,
      loginCredentialVersion,
      loginPasswordUpdatedAt,
      loginPasswordSyncedAt,
    }),
  };
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
      const loginPassword = createParticipantPassword();
      const loginPasswordUpdatedAt = new Date();
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
      await transaction`
        insert into egocapture.participant_login_credentials (
          participant_id, password, version, updated_at
        ) values (
          ${participant.id}::uuid, ${loginPassword}, 1, ${loginPasswordUpdatedAt}
        )
      `;
      await writeAudit(transaction, {
        actorProfileId: viewer.profileId,
        actorAuthUserId: viewer.authUserId,
        action: "participant.created",
        entityType: "participant",
        entityPublicId: participant.publicId,
        requestId,
        afterValues: {
          publicId: participant.publicId,
          status: "draft",
          consentStatus: "pending",
          credentialVersion: 1,
          credentialStatus: "pending_activation",
        },
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
      assertServiceTransitionSet(
        invitationMachine,
        ["generated", "opened"],
        "revoke",
        "INVALID_INVITATION_STATE",
      );
      const revokedInvitationStatus = resolveServiceTransition(
        invitationMachine,
        "generated",
        "revoke",
        "INVALID_INVITATION_STATE",
      );
      await transaction`
        update egocapture.participant_invitations
        set status = ${revokedInvitationStatus}, revoked_at = now()
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
        const nextStatus = resolveServiceTransition(
          participantMachine,
          participant.status,
          "invite",
          "INVALID_PARTICIPANT_STATE",
        );
        await transaction`
          update egocapture.participants set status = ${nextStatus}
          where id = ${participant.id}::uuid and status = ${participant.status}
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
      status: "generated" | "opened";
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
      const expiredInvitationStatus = resolveServiceTransition(
        invitationMachine,
        invitation.status,
        "expire",
        "INVALID_INVITATION_STATE",
      );
      await transaction`
        update egocapture.participant_invitations
        set status = ${expiredInvitationStatus}
        where id = ${invitation.id}::uuid and status = ${invitation.status}
      `;
      if (invitation.participantStatus === "invited") {
        const expiredParticipantStatus = resolveServiceTransition(
          participantMachine,
          invitation.participantStatus,
          "expireInvitation",
          "INVALID_PARTICIPANT_STATE",
        );
        await transaction`
          update egocapture.participants set status = ${expiredParticipantStatus}
          where id = ${invitation.participantId}::uuid and status = ${invitation.participantStatus}
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
    const openedStatus = invitation.status === "generated"
      ? resolveServiceTransition(invitationMachine, invitation.status, "open", "INVALID_INVITATION_STATE")
      : invitation.status;
    await transaction`
      update egocapture.participant_invitations
      set opened_at = coalesce(opened_at, now()), status = ${openedStatus}
      where id = ${invitation.id}::uuid and status = ${invitation.status}
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
    assertServiceTransitionSet(
      invitationMachine,
      ["generated", "opened"],
      "revoke",
      "INVALID_INVITATION_STATE",
    );
    const revokedInvitationStatus = resolveServiceTransition(
      invitationMachine,
      "generated",
      "revoke",
      "INVALID_INVITATION_STATE",
    );
    const revoked = await transaction`
      update egocapture.participant_invitations
      set status = ${revokedInvitationStatus}, revoked_at = now()
      where participant_id = ${participant.id}::uuid and status in ('generated', 'opened')
      returning id
    `;
    if (revoked.length === 0) {
      throw new DomainError("INVITATION_NOT_ACTIVE", "没有可撤销的有效邀请", 409);
    }
    const nextStatus = participant.status === "invited" ? "expired" : participant.status;
    if (nextStatus !== participant.status) {
      resolveServiceTransition(
        participantMachine,
        participant.status,
        "expireInvitation",
        "INVALID_PARTICIPANT_STATE",
      );
      await transaction`
        update egocapture.participants set status = ${nextStatus}
        where id = ${participant.id}::uuid and status = ${participant.status}
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

export async function acceptInvitation(token: string, requestId: string) {
  if (!/^[A-Za-z0-9_-]{43}$/.test(token)) {
    throw new DomainError("INVITATION_INVALID_OR_EXPIRED", "邀请无效或已过期", 400);
  }
  const db = database();
  const supabase = createSupabaseAdminClient();
  let createdAuthUserId: string | undefined;
  try {
    return await db.begin(async (transaction) => {
      const [invitation] = await transaction<(ParticipantRow & {
        invitationStatus: "generated" | "opened";
      })[]>`
        select
          participant.id, participant.public_id, participant.status,
          participant.consent_status, participant.display_alias,
          participant.is_fixture, invitation.status as invitation_status
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
      const activeStatus = resolveServiceTransition(
        participantMachine,
        invitation.status,
        "acceptInvitation",
        "INVALID_PARTICIPANT_STATE",
      );
      const validConsentStatus = resolveServiceTransition(
        consentProjectionMachine,
        invitation.consentStatus,
        "accept",
        "INVALID_CONSENT_STATE",
      );
      const acceptedInvitationStatus = resolveServiceTransition(
        invitationMachine,
        invitation.invitationStatus,
        "accept",
        "INVALID_INVITATION_STATE",
      );
      const [storedCredential] = await transaction<{
        loginPassword: string;
        loginCredentialVersion: number;
        loginPasswordUpdatedAt: Date;
      }[]>`
        select
          password as login_password,
          version::integer as login_credential_version,
          updated_at as login_password_updated_at
        from egocapture.participant_login_credentials
        where participant_id = ${invitation.id}::uuid
        for update
      `;
      const loginPassword = storedCredential?.loginPassword ?? createParticipantPassword();
      const loginCredentialVersion = storedCredential?.loginCredentialVersion ?? 1;
      const loginPasswordUpdatedAt = storedCredential?.loginPasswordUpdatedAt ?? new Date();
      const email = internalParticipantEmail(invitation.publicId);
      const { data, error } = await supabase.auth.admin.createUser({
        email,
        password: loginPassword,
        email_confirm: true,
      });
      if (error || !data.user) throw new DomainError("INVITATION_ACCEPT_FAILED", "暂时无法接受邀请", 503);
      createdAuthUserId = data.user.id;
      const loginPasswordSyncedAt = new Date();
      const [profile] = await transaction<{ id: string }[]>`
        insert into egocapture.profiles (auth_user_id, role, display_name)
        values (${createdAuthUserId}::uuid, 'participant', ${invitation.displayAlias})
        returning id
      `;
      await transaction`
        update egocapture.participants
        set auth_user_id = ${createdAuthUserId}::uuid,
            status = ${activeStatus},
            consent_status = ${validConsentStatus}
        where id = ${invitation.id}::uuid and status = ${invitation.status}
      `;
      await transaction`
        insert into egocapture.participant_login_credentials (
          participant_id, password, version, updated_at, synced_at
        ) values (
          ${invitation.id}::uuid, ${loginPassword}, ${loginCredentialVersion},
          ${loginPasswordUpdatedAt}, ${loginPasswordSyncedAt}
        )
        on conflict (participant_id) do update set
          password = excluded.password,
          version = excluded.version,
          updated_at = excluded.updated_at,
          synced_at = excluded.synced_at
      `;
      await transaction`
        update egocapture.participant_invitations
        set status = ${acceptedInvitationStatus}, accepted_at = now(), opened_at = coalesce(opened_at, now())
        where token_hash = ${hashInvitationToken(token)} and status = ${invitation.invitationStatus}
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
        afterValues: {
          status: "active",
          consentStatus: "valid",
          credentialVersion: loginCredentialVersion,
          credentialStatus: "ready",
        },
      });
      return { participantPublicId: invitation.publicId, loginPassword };
    });
  } catch (error) {
    if (createdAuthUserId) await supabase.auth.admin.deleteUser(createdAuthUserId);
    throw error;
  }
}

export async function resetParticipantCredential(
  viewer: Viewer,
  participantPublicId: string,
  idempotencyKey: string,
  requestId: string,
): Promise<{ loginCredential: ParticipantLoginCredential; updatedAt: string }> {
  const db = database();
  const requestHash = credentialRequestHash(participantPublicId);
  const lockKey = `${viewer.authUserId}:${credentialResetCommandName}:${idempotencyKey}`;
  const prepared = await db.begin(async (transaction) => {
    await transaction`select pg_advisory_xact_lock(hashtext(${lockKey}))`;
    const [receipt] = await transaction<{ requestHash: string; expiresAt: Date }[]>`
      select request_hash, expires_at
      from egocapture.command_receipts
      where actor_auth_user_id = ${viewer.authUserId}::uuid
        and command_name = ${credentialResetCommandName}
        and idempotency_key = ${idempotencyKey}
      limit 1
    `;
    if (receipt && receipt.expiresAt > new Date()) {
      if (receipt.requestHash !== requestHash) {
        throw new DomainError("IDEMPOTENCY_KEY_REUSED", "该 Idempotency-Key 已用于不同请求", 409);
      }
      return { replay: true as const };
    }
    if (receipt) {
      await transaction`
        delete from egocapture.command_receipts
        where actor_auth_user_id = ${viewer.authUserId}::uuid
          and command_name = ${credentialResetCommandName}
          and idempotency_key = ${idempotencyKey}
      `;
    }

    const [participantBase] = await transaction<(ParticipantRow & { authUserId: string | null })[]>`
      select
        participant.id, participant.public_id, participant.status,
        participant.consent_status, participant.display_alias,
        participant.is_fixture, participant.auth_user_id
      from egocapture.participants participant
      where participant.public_id = ${participantPublicId}
      for update of participant
    `;
    if (!participantBase) throw new DomainError("NOT_FOUND", "Participant 或资源不存在", 404);
    const [storedCredential] = await transaction<{
      loginPassword: string;
      loginCredentialVersion: number;
      loginPasswordUpdatedAt: Date;
      loginPasswordSyncedAt: Date | null;
    }[]>`
      select
        password as login_password,
        version::integer as login_credential_version,
        updated_at as login_password_updated_at,
        synced_at as login_password_synced_at
      from egocapture.participant_login_credentials
      where participant_id = ${participantBase.id}::uuid
      for update
    `;
    const participant: ParticipantCredentialRow = {
      ...participantBase,
      loginPassword: storedCredential?.loginPassword ?? null,
      loginCredentialVersion: storedCredential?.loginCredentialVersion ?? 0,
      loginPasswordUpdatedAt: storedCredential?.loginPasswordUpdatedAt ?? null,
      loginPasswordSyncedAt: storedCredential?.loginPasswordSyncedAt ?? null,
    };
    protectFixture(viewer, participant);

    const currentStatus = participantCredentialStatus({
      password: participant.loginPassword,
      authUserId: participant.authUserId,
      updatedAt: participant.loginPasswordUpdatedAt,
      syncedAt: participant.loginPasswordSyncedAt,
    });
    const isPendingSync = currentStatus === "pending_sync";
    const loginPassword = isPendingSync && participant.loginPassword
      ? participant.loginPassword
      : createParticipantPassword();
    const loginCredentialVersion = isPendingSync
      ? participant.loginCredentialVersion
      : participant.loginCredentialVersion + 1;
    const loginPasswordUpdatedAt = isPendingSync && participant.loginPasswordUpdatedAt
      ? participant.loginPasswordUpdatedAt
      : new Date();

    if (!isPendingSync) {
      await transaction`
        insert into egocapture.participant_login_credentials (
          participant_id, password, version, updated_at, synced_at
        ) values (
          ${participant.id}::uuid, ${loginPassword}, ${loginCredentialVersion},
          ${loginPasswordUpdatedAt}, null
        )
        on conflict (participant_id) do update set
          password = excluded.password,
          version = excluded.version,
          updated_at = excluded.updated_at,
          synced_at = null
      `;
      await writeAudit(transaction, {
        actorProfileId: viewer.profileId,
        actorAuthUserId: viewer.authUserId,
        action: "participant.login_credential_prepared",
        entityType: "participant",
        entityPublicId: participant.publicId,
        requestId,
        beforeValues: {
          credentialVersion: participant.loginCredentialVersion,
          credentialStatus: currentStatus,
        },
        afterValues: {
          credentialVersion: loginCredentialVersion,
          credentialStatus: participant.authUserId ? "pending_sync" : "pending_activation",
        },
      });
    }

    const nextParticipant: ParticipantCredentialRow = {
      ...participant,
      loginPassword,
      loginCredentialVersion,
      loginPasswordUpdatedAt,
      loginPasswordSyncedAt: null,
    };
    let participantUpdatedAt: Date | null = null;
    if (!isPendingSync) {
      const [updatedParticipant] = await transaction<{ updatedAt: Date }[]>`
        update egocapture.participants
        set updated_at = now()
        where id = ${participant.id}::uuid
        returning updated_at
      `;
      participantUpdatedAt = updatedParticipant.updatedAt;
    }
    if (!participant.authUserId) {
      await transaction`
        insert into egocapture.command_receipts (
          actor_auth_user_id, command_name, idempotency_key,
          request_hash, response_status, response_body
        ) values (
          ${viewer.authUserId}::uuid, ${credentialResetCommandName}, ${idempotencyKey},
          ${requestHash}, 200,
          ${transaction.json({
            participantPublicId,
            credentialVersion: loginCredentialVersion,
            credentialStatus: "pending_activation",
          })}
        )
      `;
      return {
        replay: false as const,
        participant: nextParticipant,
        participantUpdatedAt: participantUpdatedAt!,
      };
    }
    return { replay: false as const, participant: nextParticipant, participantUpdatedAt };
  });

  if (prepared.replay) {
    const current = await getParticipant(viewer, participantPublicId);
    return {
      loginCredential: current.loginCredential,
      updatedAt: current.updatedAt.toISOString(),
    };
  }
  if (!prepared.participant.authUserId) {
    return {
      loginCredential: toLoginCredential(prepared.participant),
      updatedAt: prepared.participantUpdatedAt!.toISOString(),
    };
  }

  const supabase = createSupabaseAdminClient();
  const { error } = await supabase.auth.admin.updateUserById(prepared.participant.authUserId, {
    password: prepared.participant.loginPassword!,
  });
  if (error) {
    throw new DomainError(
      "PARTICIPANT_CREDENTIAL_SYNC_FAILED",
      "登录密码暂未同步，请重试该操作后再交付凭据",
      503,
    );
  }

  return await db.begin(async (transaction) => {
    await transaction`select pg_advisory_xact_lock(hashtext(${lockKey}))`;
    const [participantBase] = await transaction<(ParticipantRow & { authUserId: string | null })[]>`
      select
        participant.id, participant.public_id, participant.status,
        participant.consent_status, participant.display_alias,
        participant.is_fixture, participant.auth_user_id
      from egocapture.participants participant
      where participant.public_id = ${participantPublicId}
      for update of participant
    `;
    const [storedCredential] = participantBase
      ? await transaction<{
          loginPassword: string;
          loginCredentialVersion: number;
          loginPasswordUpdatedAt: Date;
          loginPasswordSyncedAt: Date | null;
        }[]>`
          select
            password as login_password,
            version::integer as login_credential_version,
            updated_at as login_password_updated_at,
            synced_at as login_password_synced_at
          from egocapture.participant_login_credentials
          where participant_id = ${participantBase.id}::uuid
          for update
        `
      : [];
    const participant: ParticipantCredentialRow | null = participantBase && storedCredential
      ? { ...participantBase, ...storedCredential }
      : null;
    if (!participant || participant.loginCredentialVersion !== prepared.participant.loginCredentialVersion) {
      throw new DomainError(
        "PARTICIPANT_CREDENTIAL_CHANGED",
        "登录凭据已发生变化，请重新读取 Participant 详情",
        409,
      );
    }
    if (participant.authUserId !== prepared.participant.authUserId) {
      throw new DomainError(
        "PARTICIPANT_CREDENTIAL_CHANGED",
        "登录账号已发生变化，请重新读取 Participant 详情",
        409,
      );
    }

    let finalized = participant;
    const status = participantCredentialStatus({
      password: participant.loginPassword,
      authUserId: participant.authUserId,
      updatedAt: participant.loginPasswordUpdatedAt,
      syncedAt: participant.loginPasswordSyncedAt,
    });
    if (status !== "ready") {
      const [updated] = await transaction<{ loginPasswordSyncedAt: Date }[]>`
        update egocapture.participant_login_credentials
        set synced_at = now()
        where participant_id = ${participant.id}::uuid
          and version = ${participant.loginCredentialVersion}
        returning synced_at as login_password_synced_at
      `;
      finalized = { ...participant, loginPasswordSyncedAt: updated.loginPasswordSyncedAt };
      await writeAudit(transaction, {
        actorProfileId: viewer.profileId,
        actorAuthUserId: viewer.authUserId,
        action: "participant.login_credential_synced",
        entityType: "participant",
        entityPublicId: participant.publicId,
        requestId,
        afterValues: {
          credentialVersion: participant.loginCredentialVersion,
          credentialStatus: "ready",
        },
      });
    }
    await transaction`
      insert into egocapture.command_receipts (
        actor_auth_user_id, command_name, idempotency_key,
        request_hash, response_status, response_body
      ) values (
        ${viewer.authUserId}::uuid, ${credentialResetCommandName}, ${idempotencyKey},
        ${requestHash}, 200,
        ${transaction.json({
          participantPublicId,
          credentialVersion: participant.loginCredentialVersion,
          credentialStatus: "ready",
        })}
      )
      on conflict (actor_auth_user_id, command_name, idempotency_key)
      do update set
        request_hash = excluded.request_hash,
        response_status = excluded.response_status,
        response_body = excluded.response_body,
        created_at = now(),
        expires_at = now() + interval '24 hours'
    `;
    const [updatedParticipant] = await transaction<{ updatedAt: Date }[]>`
      update egocapture.participants
      set updated_at = now()
      where id = ${participant.id}::uuid
      returning updated_at
    `;
    return {
      loginCredential: toLoginCredential(finalized),
      updatedAt: updatedParticipant.updatedAt.toISOString(),
    };
  });
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
    if (targetStatus === "active" && participant.consentStatus !== "valid") {
      throw new DomainError("CONSENT_REQUIRED", "Consent 无效，不能恢复 Participant", 422);
    }
    const event = targetStatus === "suspended" ? "suspend"
      : targetStatus === "active" ? "resume"
        : "withdraw";
    const nextStatus = resolveServiceTransition(
      participantMachine,
      participant.status,
      event,
      "INVALID_PARTICIPANT_STATE",
    );
    const nextConsentStatus = targetStatus === "withdrawn"
      ? resolveServiceTransition(
          consentProjectionMachine,
          participant.consentStatus,
          "withdraw",
          "INVALID_CONSENT_STATE",
        )
      : participant.consentStatus;
    await transaction`
      update egocapture.participants
      set status = ${nextStatus},
          consent_status = ${nextConsentStatus},
          withdrawn_at = case when ${targetStatus} = 'withdrawn' then now() else null end
      where id = ${participant.id}::uuid and status = ${participant.status}
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
        status: nextStatus,
        consentStatus: nextConsentStatus,
      },
    });
    return { participantPublicId: participant.publicId, status: nextStatus };
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
    if (nextStatus !== device.status) {
      const event = nextStatus === "active" ? "activate"
        : nextStatus === "lost" ? "markLost"
          : nextStatus === "shared" ? "share"
            : "retire";
      resolveServiceTransition(deviceMachine, device.status, event, "INVALID_DEVICE_STATE");
    }
    const nextFirmware = input.firmwareVersion === undefined ? device.firmwareVersion : input.firmwareVersion;
    const [updated] = await transaction<{ updatedAt: Date }[]>`
      update egocapture.devices
      set status = ${nextStatus},
          firmware_version = ${nextFirmware},
          retired_at = case when ${nextStatus} = 'retired' then coalesce(retired_at, now()) else null end
      where id = ${device.id}::uuid and status = ${device.status}
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
