import { createHash, randomBytes, randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";
import { createClient } from "@supabase/supabase-js";
import postgres from "postgres";

function parseEnv(text: string): Record<string, string> {
  return Object.fromEntries(text.split(/\r?\n/).filter((line) => line && !line.startsWith("#")).map((line) => {
    const separator = line.indexOf("=");
    return [line.slice(0, separator), line.slice(separator + 1)];
  }));
}

function readEnv(file: string) {
  try { return parseEnv(readFileSync(file, "utf8")); } catch { return {}; }
}

function environment() {
  const root = process.cwd();
  const local = readEnv(path.join(root, ".env.development.local"));
  const profile = local.EGOCAPTURE_DEV_PROFILE || "local";
  const merged = { ...readEnv(path.join(root, ".runtime", profile, "app.env")), ...process.env };
  for (const key of [
    "DATABASE_URL", "NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY",
    "PARTICIPANT_SITE_URL", "ADMIN_SITE_URL", "DEMO_ADMIN_USERNAME", "DEMO_ADMIN_PASSWORD",
  ]) {
    if (!merged[key]) throw new Error(`缺少 ${key}`);
  }
  return {
    databaseUrl: merged.DATABASE_URL!,
    supabaseUrl: merged.NEXT_PUBLIC_SUPABASE_URL!,
    serviceRoleKey: merged.SUPABASE_SERVICE_ROLE_KEY!,
    participantSiteUrl: merged.PARTICIPANT_SITE_URL!,
    adminSiteUrl: merged.ADMIN_SITE_URL!,
    demoAdminUsername: merged.DEMO_ADMIN_USERNAME!,
    demoAdminPassword: merged.DEMO_ADMIN_PASSWORD!,
  };
}

class CookieJar {
  private readonly values = new Map<string, string>();
  absorb(response: Response) {
    for (const header of response.headers.getSetCookie()) {
      const pair = header.slice(0, header.indexOf(";"));
      const separator = pair.indexOf("=");
      const name = pair.slice(0, separator);
      const value = pair.slice(separator + 1);
      if (/max-age=0/i.test(header) || !value) this.values.delete(name);
      else this.values.set(name, value);
    }
  }
  header() { return [...this.values].map(([name, value]) => `${name}=${value}`).join("; "); }
}

async function api<T>(
  siteUrl: string,
  route: string,
  options: RequestInit & { jar?: CookieJar } = {},
): Promise<{ response: Response; payload: T }> {
  const headers = new Headers(options.headers);
  headers.set("origin", new URL(siteUrl).origin);
  if (options.jar?.header()) headers.set("cookie", options.jar.header());
  const response = await fetch(`${siteUrl}${route}`, { ...options, headers, redirect: "manual" });
  options.jar?.absorb(response);
  const payload = await response.json() as T;
  return { response, payload };
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

async function main() {
  const env = environment();
  const db = postgres(env.databaseUrl, {
    max: 1,
    prepare: false,
    connect_timeout: 8,
    transform: postgres.camel,
  });
  const supabase = createClient(env.supabaseUrl, env.serviceRoleKey, {
    auth: { autoRefreshToken: false, detectSessionInUrl: false, persistSession: false },
  });
  const suffix = randomUUID();
  const adminEmail = `participant-check-${suffix}@demo.invalid`;
  const adminPassword = randomBytes(24).toString("base64url");
  let participantPassword = "";
  const adminJar = new CookieJar();
  const demoAdminJar = new CookieJar();
  const participantJar = new CookieJar();
  let adminUserId: string | undefined;
  let participantPublicId: string | undefined;
  let revokedParticipantPublicId: string | undefined;
  try {
    const { data: adminUser, error: adminError } = await supabase.auth.admin.createUser({
      email: adminEmail, password: adminPassword, email_confirm: true,
    });
    if (adminError || !adminUser.user) throw adminError || new Error("Admin test user creation failed");
    adminUserId = adminUser.user.id;
    await db`
      insert into egocapture.profiles (auth_user_id, role, display_name)
      values (${adminUserId}::uuid, 'admin', 'Participant Check Admin')
    `;

    const login = await api<{ data?: { redirectTo: string } }>(env.adminSiteUrl, "/api/auth/admin-login", {
      method: "POST", jar: adminJar, headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: adminEmail, password: adminPassword }),
    });
    assert(login.response.ok && login.payload.data?.redirectTo === "/dashboard", "Admin API login failed");
    assert(adminJar.header(), "Admin login did not set SSR cookies");
    const demoLogin = await api<{ data?: { redirectTo: string } }>(env.adminSiteUrl, "/api/auth/admin-login", {
      method: "POST", jar: demoAdminJar, headers: { "content-type": "application/json" },
      body: JSON.stringify({ identity: env.demoAdminUsername, password: env.demoAdminPassword }),
    });
    assert(demoLogin.response.ok && demoAdminJar.header(), "Demo Admin login failed");

    const participantBody = {
      displayAlias: "Participant Check", managementEmail: null,
      locale: "zh-CN", timezone: "Asia/Shanghai", countryRegion: "CN",
      notes: "Synthetic participant integration check",
    };
    const participantKey = randomUUID();
    const created = await api<{ data?: { participantPublicId: string } }>(env.adminSiteUrl, "/api/admin/participants", {
      method: "POST", jar: adminJar,
      headers: { "content-type": "application/json", "idempotency-key": participantKey },
      body: JSON.stringify(participantBody),
    });
    assert(created.response.status === 201 && created.payload.data?.participantPublicId, "Participant creation failed");
    participantPublicId = created.payload.data.participantPublicId;
    await db`
      update egocapture.participants
      set is_fixture = true
      where public_id = ${participantPublicId}
    `;
    const replay = await api<{ data?: { participantPublicId: string } }>(env.adminSiteUrl, "/api/admin/participants", {
      method: "POST", jar: adminJar,
      headers: { "content-type": "application/json", "idempotency-key": participantKey },
      body: JSON.stringify(participantBody),
    });
    assert(replay.payload.data?.participantPublicId === participantPublicId, "Participant idempotency replay diverged");
    const participantDetail = await api<{ data?: {
      updatedAt: string;
      loginCredential: {
        username: string;
        password: string | null;
        version: number;
        status: string;
        canLogin: boolean;
      };
    } }>(
      env.adminSiteUrl,
      `/api/admin/participants/${participantPublicId}`,
      { method: "GET", jar: adminJar },
    );
    assert(participantDetail.response.ok && participantDetail.payload.data?.updatedAt, "Participant detail lookup failed");
    assert(
      participantDetail.response.headers.get("cache-control")?.includes("no-store"),
      "Participant credential detail response must disable caching",
    );
    assert(
      participantDetail.payload.data.loginCredential.username === participantPublicId &&
        participantDetail.payload.data.loginCredential.password &&
        participantDetail.payload.data.loginCredential.version === 1 &&
        participantDetail.payload.data.loginCredential.status === "pending_activation" &&
        !participantDetail.payload.data.loginCredential.canLogin,
      "New Participant credential was not pending activation",
    );
    participantPassword = participantDetail.payload.data.loginCredential.password;
    const anonymousDetail = await api<{ error?: { code: string } }>(
      env.adminSiteUrl,
      `/api/admin/participants/${participantPublicId}`,
      { method: "GET" },
    );
    assert(
      anonymousDetail.response.status === 401 && anonymousDetail.payload.error?.code === "AUTH_REQUIRED",
      "Anonymous request could read Participant credentials",
    );
    const fixtureReset = await api<{ error?: { code: string } }>(
      env.adminSiteUrl,
      `/api/admin/participants/${participantPublicId}/credentials/reset`,
      { method: "POST", jar: demoAdminJar, headers: { "idempotency-key": randomUUID() } },
    );
    assert(
      fixtureReset.response.status === 403 && fixtureReset.payload.error?.code === "FIXTURE_PROTECTED",
      "Demo Admin changed a protected Fixture credential",
    );
    const participantList = await api<Record<string, unknown>>(
      env.adminSiteUrl,
      `/api/admin/participants?search=${encodeURIComponent(participantPublicId)}`,
      { method: "GET", jar: adminJar },
    );
    assert(
      participantList.response.ok &&
        !JSON.stringify(participantList.payload).includes(participantPassword) &&
        !JSON.stringify(participantList.payload).includes("loginCredential"),
      "Participant list exposed login credentials",
    );
    const participantUpdatedAt = participantDetail.payload.data.updatedAt;
    const participantUpdate = await api<{ data?: { updatedAt: string } }>(
      env.adminSiteUrl,
      `/api/admin/participants/${participantPublicId}`,
      {
        method: "PATCH", jar: adminJar, headers: { "content-type": "application/json" },
        body: JSON.stringify({
          displayAlias: "Participant Check Updated",
          managementEmail: "synthetic-participant@demo.invalid",
          notes: "Synthetic participant profile update without PII",
          expectedUpdatedAt: participantUpdatedAt,
        }),
      },
    );
    assert(participantUpdate.response.ok && participantUpdate.payload.data?.updatedAt, "Participant profile update failed");
    const staleParticipantUpdate = await api<{ error?: { code: string } }>(
      env.adminSiteUrl,
      `/api/admin/participants/${participantPublicId}`,
      {
        method: "PATCH", jar: adminJar, headers: { "content-type": "application/json" },
        body: JSON.stringify({ notes: "This stale write must be rejected", expectedUpdatedAt: participantUpdatedAt }),
      },
    );
    assert(
      staleParticipantUpdate.response.status === 409 && staleParticipantUpdate.payload.error?.code === "STALE_WRITE",
      "Stale Participant profile update was not rejected",
    );

    const revokedParticipant = await api<{ data?: { participantPublicId: string } }>(
      env.adminSiteUrl,
      "/api/admin/participants",
      {
        method: "POST",
        jar: adminJar,
        headers: { "content-type": "application/json", "idempotency-key": randomUUID() },
        body: JSON.stringify({ ...participantBody, displayAlias: "Revoked Invitation Check" }),
      },
    );
    assert(
      revokedParticipant.response.status === 201 && revokedParticipant.payload.data?.participantPublicId,
      "Revocation fixture Participant creation failed",
    );
    revokedParticipantPublicId = revokedParticipant.payload.data.participantPublicId;
    await db`
      update egocapture.participants
      set is_fixture = true
      where public_id = ${revokedParticipantPublicId}
    `;
    const revokedInvitation = await api<{ data?: { invitationUrl: string } }>(
      env.adminSiteUrl,
      `/api/admin/participants/${revokedParticipantPublicId}/invitations`,
      { method: "POST", jar: adminJar, headers: { "idempotency-key": randomUUID() } },
    );
    assert(
      revokedInvitation.response.status === 201 && revokedInvitation.payload.data?.invitationUrl,
      "Revocation fixture Invitation generation failed",
    );
    const revokedToken = revokedInvitation.payload.data.invitationUrl.split("/").at(-1)!;
    const revoked = await api<{ data?: { status: string; invitationStatus: string } }>(
      env.adminSiteUrl,
      `/api/admin/participants/${revokedParticipantPublicId}/invitations/revoke`,
      {
        method: "POST",
        jar: adminJar,
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ reason: "Integration check explicit invitation revocation" }),
      },
    );
    assert(
      revoked.response.ok && revoked.payload.data?.status === "expired" && revoked.payload.data.invitationStatus === "revoked",
      "Invitation revocation failed",
    );
    const rejectedRevokedToken = await api<{ error?: { code: string } }>(
      env.participantSiteUrl,
      `/api/invitations/${revokedToken}/accept`,
      {
        method: "POST",
      },
    );
    assert(
      rejectedRevokedToken.response.status === 400 &&
        rejectedRevokedToken.payload.error?.code === "INVITATION_INVALID_OR_EXPIRED",
      "Revoked Invitation error was not safely unified",
    );

    const invitation = await api<{ data?: { invitationUrl: string } }>(
      env.adminSiteUrl,
      `/api/admin/participants/${participantPublicId}/invitations`,
      { method: "POST", jar: adminJar, headers: { "idempotency-key": randomUUID() } },
    );
    assert(invitation.response.status === 201 && invitation.payload.data?.invitationUrl, "Invitation generation failed");
    const invitationUrl = invitation.payload.data.invitationUrl;
    const token = invitationUrl.split("/").at(-1)!;
    assert(!invitationUrl.includes(participantPublicId), "Invitation URL leaked Participant ID");
    const invitePage = await fetch(invitationUrl);
    assert(invitePage.ok, "Invitation open page failed");

    const accepted = await api<{ data?: { participantPublicId: string; redirectTo: string } }>(
      env.participantSiteUrl,
      `/api/invitations/${token}/accept`,
      { method: "POST", jar: participantJar },
    );
    assert(accepted.response.ok && accepted.payload.data?.redirectTo === "/tasks", "Invitation acceptance failed");
    assert(
      !JSON.stringify(accepted.payload).includes(participantPassword) &&
        !JSON.stringify(accepted.payload).includes("loginPassword"),
      "Invitation acceptance response exposed the Participant password",
    );
    assert(participantJar.header(), "Invitation acceptance did not establish Participant session");
    const participantCredentialRead = await api<{ error?: { code: string } }>(
      env.adminSiteUrl,
      `/api/admin/participants/${participantPublicId}`,
      { method: "GET", jar: participantJar },
    );
    assert(
      [401, 403].includes(participantCredentialRead.response.status) &&
        ["AUTH_REQUIRED", "FORBIDDEN"].includes(participantCredentialRead.payload.error?.code || ""),
      `Participant credential detail denial mismatch (${participantCredentialRead.response.status} ${participantCredentialRead.payload.error?.code || "unknown"})`,
    );

    const tasksResponse = await fetch(`${env.participantSiteUrl}/tasks`, { headers: { cookie: participantJar.header() } });
    assert(tasksResponse.ok && (await tasksResponse.text()).includes("Participant Check"), "Participant SSR authorization failed");

    const participantLoginJar = new CookieJar();
    const participantLogin = await api<{ data?: { redirectTo: string } }>(env.participantSiteUrl, "/api/auth/participant-login", {
      method: "POST", jar: participantLoginJar, headers: { "content-type": "application/json" },
      body: JSON.stringify({ participantPublicId, password: participantPassword }),
    });
    assert(participantLogin.response.ok && participantLogin.payload.data?.redirectTo === "/tasks", "Participant Public ID login failed");

    await db`
      update egocapture.participant_login_credentials credential
      set synced_at = null
      from egocapture.participants participant
      where credential.participant_id = participant.id
        and participant.public_id = ${participantPublicId}
    `;
    const pendingSyncDetail = await api<{ data?: {
      loginCredential: { password: string | null; version: number; status: string; canLogin: boolean };
    } }>(env.adminSiteUrl, `/api/admin/participants/${participantPublicId}`, {
      method: "GET",
      jar: adminJar,
    });
    assert(
      pendingSyncDetail.response.ok &&
        pendingSyncDetail.payload.data?.loginCredential.password === participantPassword &&
        pendingSyncDetail.payload.data.loginCredential.version === 1 &&
        pendingSyncDetail.payload.data.loginCredential.status === "pending_sync" &&
        !pendingSyncDetail.payload.data.loginCredential.canLogin,
      "Persisted pending credential state was not visible",
    );
    const resumedSync = await api<{ data?: {
      loginCredential: { password: string | null; version: number; status: string; canLogin: boolean };
    } }>(env.adminSiteUrl, `/api/admin/participants/${participantPublicId}/credentials/reset`, {
      method: "POST",
      jar: adminJar,
      headers: { "idempotency-key": randomUUID() },
    });
    assert(
      resumedSync.response.ok &&
        resumedSync.payload.data?.loginCredential.password === participantPassword &&
        resumedSync.payload.data.loginCredential.version === 1 &&
        resumedSync.payload.data.loginCredential.status === "ready" &&
        resumedSync.payload.data.loginCredential.canLogin,
      "Pending credential retry did not reuse and synchronize the existing password",
    );

    const missingKeyReset = await api<{ error?: { code: string } }>(
      env.adminSiteUrl,
      `/api/admin/participants/${participantPublicId}/credentials/reset`,
      { method: "POST", jar: adminJar },
    );
    assert(
      missingKeyReset.response.status === 422 && missingKeyReset.payload.error?.code === "IDEMPOTENCY_KEY_REQUIRED",
      "Credential reset accepted a missing Idempotency-Key",
    );
    const untrustedResetResponse = await fetch(
      `${env.adminSiteUrl}/api/admin/participants/${participantPublicId}/credentials/reset`,
      {
        method: "POST",
        headers: {
          origin: "https://untrusted.invalid",
          cookie: adminJar.header(),
          "idempotency-key": randomUUID(),
        },
      },
    );
    const untrustedResetPayload = await untrustedResetResponse.json() as { error?: { code: string } };
    assert(
      untrustedResetResponse.status === 403 && untrustedResetPayload.error?.code === "ORIGIN_REJECTED" &&
        !JSON.stringify(untrustedResetPayload).includes(participantPassword),
      "Credential reset Trusted Origin rejection mismatch",
    );
    const participantReset = await api<{ error?: { code: string } }>(
      env.adminSiteUrl,
      `/api/admin/participants/${participantPublicId}/credentials/reset`,
      { method: "POST", jar: participantJar, headers: { "idempotency-key": randomUUID() } },
    );
    assert(
      [401, 403].includes(participantReset.response.status) &&
        !JSON.stringify(participantReset.payload).includes(participantPassword),
      "Participant role could reset or read another credential",
    );

    const previousPassword = participantPassword;
    const resetKey = randomUUID();
    const reset = await api<{ data?: {
      updatedAt: string;
      loginCredential: { password: string | null; version: number; status: string; canLogin: boolean };
    } }>(env.adminSiteUrl, `/api/admin/participants/${participantPublicId}/credentials/reset`, {
      method: "POST",
      jar: adminJar,
      headers: { "idempotency-key": resetKey },
    });
    assert(
      reset.response.ok && reset.payload.data?.loginCredential.password &&
        reset.payload.data.loginCredential.password !== previousPassword &&
        reset.payload.data.loginCredential.version === 2 &&
        reset.payload.data.loginCredential.status === "ready" &&
        reset.payload.data.loginCredential.canLogin && reset.payload.data.updatedAt,
      "Participant credential reset did not return a synchronized replacement",
    );
    participantPassword = reset.payload.data.loginCredential.password;
    const resetReplay = await api<{ data?: {
      loginCredential: { password: string | null; version: number };
    } }>(env.adminSiteUrl, `/api/admin/participants/${participantPublicId}/credentials/reset`, {
      method: "POST",
      jar: adminJar,
      headers: { "idempotency-key": resetKey },
    });
    assert(
      resetReplay.response.ok &&
        resetReplay.payload.data?.loginCredential.password === participantPassword &&
        resetReplay.payload.data.loginCredential.version === 2,
      "Credential reset idempotency replay changed the password",
    );
    const oldPasswordLogin = await api<{ error?: { code: string } }>(env.participantSiteUrl, "/api/auth/participant-login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ participantPublicId, password: previousPassword }),
    });
    assert(
      oldPasswordLogin.response.status === 401 && oldPasswordLogin.payload.error?.code === "INVALID_CREDENTIALS",
      "Old Participant password remained valid after reset",
    );
    const newPasswordLogin = await api<{ data?: { redirectTo: string } }>(env.participantSiteUrl, "/api/auth/participant-login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ participantPublicId, password: participantPassword }),
    });
    assert(newPasswordLogin.response.ok, "New Participant password was not usable after reset");

    const serial = `RAW-SERIAL-${suffix}`;
    const device = await api<{ data?: { devicePublicId: string } }>(
      env.adminSiteUrl,
      `/api/admin/participants/${participantPublicId}/devices`,
      {
        method: "POST", jar: adminJar,
        headers: { "content-type": "application/json", "idempotency-key": randomUUID() },
        body: JSON.stringify({
          manufacturer: "Synthetic", model: "Check Cam", deviceType: "action_camera",
          serial, firmwareVersion: "1.0.0", status: "active", setAsDefault: true,
        }),
      },
    );
    assert(device.response.status === 201 && device.payload.data?.devicePublicId, "Device registration failed");
    const devices = await api<{ data?: Array<{ publicId: string; updatedAt: string }> }>(
      env.adminSiteUrl,
      `/api/admin/participants/${participantPublicId}/devices`,
      { method: "GET", jar: adminJar },
    );
    const createdDevice = devices.payload.data?.find((candidate) => candidate.publicId === device.payload.data?.devicePublicId);
    assert(devices.response.ok && createdDevice?.updatedAt, "Device detail lookup failed");
    const deviceUpdate = await api<{ data?: { status: string; updatedAt: string } }>(
      env.adminSiteUrl,
      `/api/admin/devices/${device.payload.data.devicePublicId}`,
      {
        method: "PATCH", jar: adminJar, headers: { "content-type": "application/json" },
        body: JSON.stringify({
          firmwareVersion: "1.0.1",
          status: "shared",
          reason: "Integration check updates firmware and sharing status",
          expectedUpdatedAt: createdDevice.updatedAt,
        }),
      },
    );
    assert(deviceUpdate.response.ok && deviceUpdate.payload.data?.status === "shared", "Device update failed");
    const staleDeviceUpdate = await api<{ error?: { code: string } }>(
      env.adminSiteUrl,
      `/api/admin/devices/${device.payload.data.devicePublicId}`,
      {
        method: "PATCH", jar: adminJar, headers: { "content-type": "application/json" },
        body: JSON.stringify({
          status: "active",
          reason: "Integration check rejects stale device update",
          expectedUpdatedAt: createdDevice.updatedAt,
        }),
      },
    );
    assert(
      staleDeviceUpdate.response.status === 409 && staleDeviceUpdate.payload.error?.code === "STALE_WRITE",
      "Stale Device update was not rejected",
    );
    await db`
      update egocapture.devices
      set is_fixture = true
      where public_id = ${device.payload.data.devicePublicId}
    `;

    for (const action of ["suspend", "reactivate"] as const) {
      const result = await api<{ data?: { status: string } }>(
        env.adminSiteUrl,
        `/api/admin/participants/${participantPublicId}/${action}`,
        { method: "POST", jar: adminJar, headers: { "content-type": "application/json" }, body: JSON.stringify({ reason: `Integration check ${action} transition` }) },
      );
      assert(result.response.ok, `Participant ${action} failed`);
      const statusDetail = await api<{ data?: { loginCredential: { canLogin: boolean } } }>(
        env.adminSiteUrl,
        `/api/admin/participants/${participantPublicId}`,
        { method: "GET", jar: adminJar },
      );
      assert(
        statusDetail.response.ok && statusDetail.payload.data?.loginCredential.canLogin === (action === "reactivate"),
        `Participant ${action} credential availability mismatch`,
      );
    }

    const [databaseEvidence] = await db<{
      status: string;
      consentStatus: string;
      invitationStatus: string;
      tokenHash: Buffer;
      authUserId: string;
      serialHmac: string;
      deviceStatus: string;
      firmwareVersion: string;
      auditCount: number;
      credentialVersion: number;
      credentialSyncedAt: Date;
      credentialLeakCount: number;
      receiptLeakCount: number;
    }[]>`
      select
        participant.status,
        participant.consent_status,
        invitation.status as invitation_status,
        invitation.token_hash,
        participant.auth_user_id,
        device.serial_hmac,
        device.status as device_status,
        device.firmware_version,
        credential.version::integer as credential_version,
        credential.synced_at as credential_synced_at,
        (select count(*)::integer from egocapture.audit_events audit where audit.entity_public_id in (participant.public_id, device.public_id)) as audit_count,
        (select count(*)::integer
         from egocapture.audit_events audit
         where audit.entity_public_id = participant.public_id
           and (
             concat(audit.before_values, audit.after_values, audit.metadata) like '%' || credential.password || '%'
             or concat(audit.before_values, audit.after_values, audit.metadata) like '%' || ${previousPassword} || '%'
           )) as credential_leak_count,
        (select count(*)::integer
         from egocapture.command_receipts receipt
         where receipt.command_name = 'participant.credentials.reset'
           and (
             receipt.response_body::text like '%' || credential.password || '%'
             or receipt.response_body::text like '%' || ${previousPassword} || '%'
           )) as receipt_leak_count
      from egocapture.participants participant
      join egocapture.participant_invitations invitation on invitation.participant_id = participant.id
      join egocapture.devices device on device.id = participant.default_device_id
      join egocapture.participant_login_credentials credential on credential.participant_id = participant.id
      where participant.public_id = ${participantPublicId}
    `;
    assert(databaseEvidence.status === "active" && databaseEvidence.consentStatus === "valid", "Participant lifecycle result mismatch");
    assert(databaseEvidence.invitationStatus === "accepted", "Invitation did not become single-use accepted");
    assert(databaseEvidence.tokenHash.equals(createHash("sha256").update(token).digest()), "Invitation hash evidence mismatch");
    assert(databaseEvidence.serialHmac !== serial && /^[a-f0-9]{64}$/.test(databaseEvidence.serialHmac), "Raw device serial was persisted");
    assert(databaseEvidence.deviceStatus === "shared" && databaseEvidence.firmwareVersion === "1.0.1", "Device update evidence mismatch");
    assert(databaseEvidence.credentialVersion === 2 && databaseEvidence.credentialSyncedAt, "Credential synchronization evidence mismatch");
    assert(databaseEvidence.credentialLeakCount === 0, "Participant password leaked into audit payloads");
    assert(databaseEvidence.receiptLeakCount === 0, "Participant password leaked into idempotency receipts");
    assert(databaseEvidence.auditCount >= 8, "Participant flow audit evidence incomplete");
    const [revocationEvidence] = await db<{
      status: string;
      invitationStatus: string;
      auditCount: number;
    }[]>`
      select
        participant.status,
        invitation.status as invitation_status,
        (select count(*)::integer from egocapture.audit_events audit
          where audit.entity_public_id = participant.public_id
            and audit.action = 'participant.invitation_revoked') as audit_count
      from egocapture.participants participant
      join egocapture.participant_invitations invitation on invitation.participant_id = participant.id
      where participant.public_id = ${revokedParticipantPublicId}
    `;
    assert(
      revocationEvidence.status === "expired" &&
        revocationEvidence.invitationStatus === "revoked" &&
        revocationEvidence.auditCount === 1,
      "Invitation revocation database or audit evidence mismatch",
    );
  } finally {
    try {
      if (participantPublicId || revokedParticipantPublicId) {
        await db`
          update egocapture.participants set is_fixture = true
          where public_id in (${participantPublicId ?? ""}, ${revokedParticipantPublicId ?? ""})
        `;
      }
    } finally {
      await db.end({ timeout: 2 });
    }
  }
  console.log(
    `Participant create/update, invitation, consent, login, device create/update, optimistic locking, lifecycle and audit API checks passed; retained Demo Fixture ${participantPublicId}`,
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? `EgoCapture Participant: ${error.message}` : error);
  process.exitCode = 1;
});
