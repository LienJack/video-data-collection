# Implementation Plan

## Preflight

- [x] Confirm prerequisite child commits and clean owned paths.
- [x] Re-run `vercel whoami`, team/project listing, `supabase projects list`, org listing and local link inspection.
- [x] Confirm names absent, target regions `us-west-1`/`sfo1`, account plan allows creation without payment, and no unrelated target is selected.

## Configuration

- [x] Add Vercel region configuration for both apps and environment identity/example keys.
- [x] Add a secret-safe deployment/preflight script or runbook that can resume by project ref/id.
- [x] Make Playwright/public smoke accept explicit Participant/Admin base URLs without embedding credentials.

## Provision

- [x] Generate secrets without output; create Supabase project and wait for ACTIVE.
- [x] Link exact Supabase ref, migrate, verify schema/RLS/private bucket and run cloud demo refresh.
- [x] Create/link the two Vercel projects; configure key presence, site URLs, cookie names, Node 24 and `sfo1`.
- [x] Deploy Participant and Admin to production; capture deployment ids/URLs without secrets.

## Public Verification

- [x] Health and route isolation checks.
- [x] Admin and three Participant locales login/switch/persistence checks.
- [x] Invitation/task/session/upload/reconcile/metadata/review smoke using generated small valid MP4.
- [x] Inspect Vercel function logs and Supabase state for errors, orphan objects and audit continuity.
- [x] Run `pnpm repo:safety` and secret-name-only environment audit.

## Evidence and Commit

- [x] Write `docs/acceptance/<date>-public-deployment.md` with commit, project refs/ids, regions, URLs and observed checks.
- [x] Mark unavailable US-side independent latency observation as SKIP rather than inferred PASS; record China-side measurement from the current host.
- [x] Commit only deployment config, smoke tooling, docs and child task artifacts; never stage `.env`, `.vercel`, Supabase secret files or video fixtures.

## Final-review redeploy (`a69858e`)

- [x] Deploy both applications from fresh detached worktrees at exact commit `a69858e33a5a027331e7c55b274d96e00142b93f` and restore the production aliases to those clean deployments.
- [x] Verify both health endpoints, cross-app route isolation, all four serialized server-rendered pages, and the healthy-cn closed-session task regression.
- [x] Run the complete public Chromium matrix: `4 passed (1.3m)`, including three locales, isolated cookies, signed direct-Storage TUS, genuine MP4 Range metadata, review correction and Activity audit readback.
- [x] Run final guarded refresh and verify digest `11aa5520a737325f0fc3c290346eebe7dee16e7d033ba7c87edcad81d9f6ad80`, migrations `0001`–`0024`, RLS static/dynamic scopes, private bucket and Storage object count `0`.
- [x] Rotate both demo passwords and invalidate old Auth users/sessions; remove the one-time refresh variable/route deployments and confirm the clean route is `404`.
- [x] Inspect exact final deployment logs with secrets redacted: `0` 5xx and no DB/WASM/marker failure; retain the known Node `TimeoutNegativeWarning` as an explicit runtime follow-up.
- [ ] Rotate the dedicated database password. **HOLD:** official management credentials are not readable on this host and Supabase `supautils` rejects `ALTER ROLE postgres` with SQLSTATE `42501`; use the project Dashboard or an account-owner-provided Management API token.

## HOLD Rules

- Any purchase/upgrade prompt, missing organization permission, quota denial or name collision requiring a scope decision → `WAITING_EXTERNAL`.
- Any target identity mismatch or reference to the Text2SQL project → immediate stop before write.
- No public completion claim until both deployment and business-flow smoke pass on one commit snapshot.
