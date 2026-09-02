# Participant Login Credential Contract

## 1. Scope / Trigger

Use this contract for participant account creation, invitation acceptance, admin credential detail/reset, Supabase Auth synchronization, or seed changes. It applies only to low-privilege `participant` accounts. Admin passwords remain solely in Supabase Auth.

Participant passwords are intentionally stored as repeatably readable plaintext for authorized admin operations. This product decision does not authorize bulk responses, browser-role database access, logs, errors, audits, receipts, URLs, or client persistence to contain the password.

## 2. Signatures

```ts
type ParticipantCredentialStatus =
  | "missing"
  | "pending_activation"
  | "pending_sync"
  | "ready";

type ParticipantLoginCredential = {
  username: string;
  password: string | null;
  loginUrl: string;
  version: number;
  status: ParticipantCredentialStatus;
  canLogin: boolean;
  updatedAt: string | null;
  syncedAt: string | null;
};

createParticipantPassword(length?: number): string;
resetParticipantCredential(
  viewer: Viewer,
  participantPublicId: string,
  idempotencyKey: string,
  requestId: string,
): Promise<{ loginCredential: ParticipantLoginCredential; updatedAt: string }>;
```

Admin reset endpoint:

```http
POST /api/admin/participants/:participantPublicId/credentials/reset
Origin: <trusted admin origin>
Idempotency-Key: <required>
```

Invitation acceptance no longer accepts a password field. The public response is an explicit allowlist containing the participant ID and redirect target only.

## 3. Contracts

- `egocapture.participant_login_credentials` is a one-to-one table keyed by `participant_id` with `ON DELETE RESTRICT`.
- The table stores `password`, positive `version`, `updated_at`, and nullable `synced_at`; `synced_at` cannot predate `updated_at`.
- Revoke all table privileges from `public`, `anon`, and `authenticated`; only the server-side service role receives CRUD privileges. Do not add this table to participant-facing PostgREST access.
- Passwords are 12–128 characters. The default generator emits 16 characters from the unambiguous alphabet `23456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz` using Node cryptographic randomness.
- A missing credential row means `missing`. No `auth_user_id` means `pending_activation`. Missing/stale `synced_at` with an Auth user means `pending_sync`. A current sync timestamp means `ready`.
- `canLogin` is true only when the credential is `ready`, the participant is `active`, and Consent is `valid`.
- New participants receive version 1 in the same database transaction, but the create response and idempotency receipt contain only the participant ID.
- Single-participant admin detail includes `loginCredential` and uses `Cache-Control: no-store`. Bulk participant lists never include credential fields.
- Invitation acceptance uses the stored password, creates the participant Auth user, records active/valid state, and marks the credential synced. The route may use the password internally for automatic sign-in but must explicitly construct a password-free public response.
- `DEMO_PARTICIPANT_PASSWORD` must satisfy the same 12–128 limit. Seed synchronizes the fixture Auth password and credential row. Demo admin may read the fixture but may not reset it.

## 4. Validation & Error Matrix

| Condition | Required result |
|---|---|
| Anonymous request | `401 AUTH_REQUIRED` |
| Non-admin authenticated request | Refuse access; `401` or `403` may occur at the app-cookie boundary |
| Untrusted Origin | `403 ORIGIN_REJECTED` |
| Missing `Idempotency-Key` | Validation error; do not prepare a password |
| Protected fixture reset | `FIXTURE_PROTECTED` |
| Existing participant has no credential/Auth user | Create version 1 and return `pending_activation`; do not alter lifecycle or Consent |
| Existing Auth user reset | Prepare pending version, update Supabase, finalize `synced_at`, invalidate the old password |
| Supabase update fails | Return `503 PARTICIPANT_CREDENTIAL_SYNC_FAILED`; keep the same pending password/version for retry |
| Auth update succeeds but DB finalize fails | Retry the same pending password against Auth, then finalize |
| Prepared version or Auth user changes before finalize | Return `409 PARTICIPANT_CREDENTIAL_CHANGED`; never finalize stale state |
| Reused idempotency key with a different participant | `409 IDEMPOTENCY_KEY_REUSED` |

## 5. Good / Base / Bad Cases

- Good: an invited participant is created with version 1, accepts without choosing a password, and can log in with the admin-visible Participant ID and generated password.
- Base: an existing participant with no credential keeps the original Supabase password until an admin explicitly initializes/reset it.
- Good recovery: a reset remains `pending_sync` after a 503; retry returns the same password/version and completes synchronization.
- Bad: return `{ ...serviceResult }` from invitation acceptance. The internal password can escape into the participant-facing response.
- Bad: store the reset response directly in `command_receipts`. The plaintext password becomes durable outside the credential table.

## 6. Tests Required

- Unit: generator length, alphabet, invalid lengths, and non-determinism; status and `canLogin` lifecycle matrix.
- Migration/RLS: schema checksum, constraints, service-role access, and no table privilege for anon/authenticated.
- Seed: fixture Auth password, credential password/version/timestamps, and env bounds agree.
- Participant integration: create pending credential, repeated admin detail, bulk non-disclosure, invitation accept without password input, automatic login, reset, old-password invalidation, pending retry reuse, fixture guard, trusted origin, idempotency, `no-store`, and receipt/audit/error non-disclosure.
- E2E: admin creates a participant, accepts the invitation without entering a password, and completes participant login/workflow using the generated credential.

## 7. Wrong vs Correct

### Wrong

```ts
return await withIdempotency(transaction, {
  execute: () => ({ participantPublicId, password }),
});
```

The generic receipt persists the full response, including the password.

### Correct

```ts
// Tx1 commits the pending password/version and stores only non-sensitive receipt data.
const prepared = await prepareCredentialReset();
await supabase.auth.admin.updateUserById(prepared.authUserId, {
  password: prepared.password,
});
// Tx2 verifies version/auth-user identity and finalizes the sync timestamp.
const current = await finalizeCredentialReset(prepared);
return { loginCredential: current, updatedAt };
```

Only the credential table and the authorized single-detail response contain the plaintext password.
