# Public Vercel and Supabase Deployment Contract

## Scenario: Deploy the interview demo to dedicated public infrastructure

### 1. Scope / Trigger

Use this contract when provisioning, redeploying, or diagnosing the public EgoCapture demo. It covers the two Vercel applications, the dedicated Supabase project, server database connectivity, browser authentication cookies, signed Storage uploads, and public acceptance evidence.

The current deployment consists of:

- Supabase project `egocapture-demo` (`phchhsatgoxlqqhpnnfk`) in `us-west-1`.
- Vercel project `egocapture-participant` rooted at `apps/participant-web`.
- Vercel project `egocapture-admin` rooted at `apps/admin-web`.
- Dynamic functions for both Vercel projects pinned to `sfo1`.

Never reuse, restore, mutate, or delete another Supabase project merely because it belongs to the same organization. A purchase, plan upgrade, custom domain, or multi-region replica is outside the unattended deployment authority.

### 2. Signatures

The runtime boundaries are:

```ts
function database(): postgres.Sql;

function authCookieOptions(): {
  name: string;
  httpOnly: true;
  path: "/";
  sameSite: "lax";
  secure: boolean;
};
```

The repository-level public acceptance command is:

```bash
PUBLIC_ACCEPTANCE=1 pnpm exec playwright test \
  --project=chromium \
  tests/e2e/public-deployment.spec.ts \
  tests/e2e/main-flow.spec.ts
```

Deploy each application from a clean worktree at the exact reviewed commit. The Vercel project root remains configured in Vercel; invoke the deployment from the repository root so the root directory is not applied twice.

### 3. Contracts

#### Resource and region ownership

- Participant and Admin are separate Vercel projects and production origins. They share PostgreSQL, Supabase Auth, and private Storage, but do not share page routes or authentication-cookie names.
- Both `vercel.json` files set `regions` to `sfo1`. Supabase stays in `us-west-1` so server compute, database, Auth, and Storage remain in the same US-west locality.
- Default Vercel production domains are sufficient for acceptance. A custom domain is not required.

#### Environment and secret handling

- Both projects require the reviewed keys from `.env.example`; Admin-only cron configuration stays on the Admin project.
- `DATABASE_URL` must use the dedicated Supabase transaction pooler on port `6543`. Serverless functions must not use the direct database endpoint or the session pooler.
- `database()` uses `max: 1` in production because every Vercel function instance owns its own postgres.js pool. Local development may use `max: 2`.
- Public uploads require `STORAGE_UPLOAD_AUTH_MODE=official_signed`. The NAS-only scoped-JWT workaround must never enter Vercel.
- Secret values may be written only to encrypted provider configuration or ignored local runtime files. Logs, task artifacts, Git, and acceptance receipts record key names and presence only.

#### Authentication-cookie isolation

- Participant and Admin set different `AUTH_COOKIE_NAME` values.
- Supabase SSR clients in Route Handlers and Proxy must both consume `authCookieOptions()`; neither layer may reconstruct a partial option object.
- Production auth cookies are `HttpOnly`, `Secure`, `SameSite=Lax`, `Path=/`, and host-only. Do not set `Domain`.
- Development keeps the same contract except `Secure=false` so local HTTP remains usable.

#### Deployment evidence

- A resource being created, a local build passing, or a Vercel deployment reaching `Ready` is not public acceptance.
- The receipt records exact source commit, deployment ids, public URLs, provider project ids/refs, regions, UTC time, and observed PASS/SKIP/WAITING_EXTERNAL results without secrets.
- Write-producing public smoke tests must restore the deterministic cloud demo baseline before the environment is handed off.

### 4. Validation & Error Matrix

| Condition | Required result |
| --- | --- |
| Provider asks for payment, upgrade, or expanded permissions | Stop with `WAITING_EXTERNAL`; do not purchase or broaden authority. |
| Existing project identity does not match the recorded ref/id | `HOLD`; inspect the provider account and never guess by display name. |
| Vercel deploy is started inside an app subdirectory while Root Directory is configured | Stop and redeploy from a clean repository-root worktree. |
| `DATABASE_URL` uses port `5432` or session-pooler port while running on Vercel | Reject configuration; use the dedicated transaction pooler on `6543`. |
| Database reports connection-slot exhaustion | Verify project identity, transaction-pooler URL, and production `max: 1`; do not increase quotas without approval. |
| Auth cookie lacks `Secure` or `HttpOnly` in production | Fail public acceptance and redeploy after fixing the shared cookie options. |
| Participant cookie is accepted by Admin, or vice versa | Fail route/cookie isolation acceptance. |
| Upload passes API creation but the MP4 cannot be decoded | Fail the business flow; use a genuinely decodable fixture and do not treat arbitrary bytes as video proof. |
| Signed TUS, reconciliation, metadata extraction, or review fails | Record the exact stage as failed; local evidence cannot replace the public observation. |
| Logs or repository checks expose a secret-shaped value | Revoke/rotate the affected value, remove the exposure safely, and rerun the audit before claiming completion. |

Provider and application errors written to evidence must be redacted. Never print environment values to prove their presence.

### 5. Good / Base / Bad Cases

Good:

```ts
const sql = postgres(environment.DATABASE_URL, {
  max: process.env.NODE_ENV === "production" ? 1 : 2,
  prepare: false,
});
```

Base:

```ts
const options = authCookieOptions();
// Local HTTP: Secure=false. All other isolation and browser-safety attributes remain.
```

Bad:

```ts
createServerClient(url, key, {
  cookieOptions: { name: authCookieName() }, // Drops production safety attributes.
});
```

### 6. Tests Required

- Unit: production and development auth-cookie attributes, including distinct configured names.
- Unit/integration: environment parsing rejects missing public deployment keys and forbids the NAS upload mode in the cloud profile.
- Repository: `pnpm test`, `pnpm typecheck`, `pnpm lint`, `pnpm build`, `pnpm repo:safety`, and `git diff --check`.
- Public discovery: both health endpoints, anonymous redirects, route isolation, cross-origin invitation host, and key-name-only environment audit.
- Public locale: `zh-CN`, `en`, and `ja` selection, persistence, and matching `<html lang>` on both applications.
- Public authentication: Participant and Admin logins set distinct host-only `Secure`, `HttpOnly`, `SameSite=Lax` cookies.
- Public business flow: Participant assignment and Session, signed TUS upload of a decodable MP4, reconciliation, metadata extraction, Admin review decision, and audit evidence.
- Provider inspection: exact deployment commit/id/region, Supabase project/ref/region, redacted logs, migration frontier, RLS, private bucket, and final deterministic seed digest.

### 7. Wrong vs Correct

#### Wrong

```bash
# Uploads the current dirty checkout and can accidentally include another task.
vercel deploy --prod
```

#### Correct

```bash
# Conceptual sequence: create an isolated worktree at the reviewed hash, link the
# exact provider project there, then deploy from that repository root.
git worktree add <temporary-path> <reviewed-commit>
cd <temporary-path>
vercel link --project <exact-project-name>
vercel deploy --prod
```

The same exact-identity rule applies to Supabase migrations and demo refreshes: inspect the project ref and target binding first, then mutate only the dedicated EgoCapture project.
