# Implementation Plan

## Preflight

- [ ] Confirm prerequisite child commits and clean owned paths.
- [ ] Re-run `vercel whoami`, team/project listing, `supabase projects list`, org listing and local link inspection.
- [ ] Confirm names absent, target regions `us-west-1`/`sfo1`, account plan allows creation without payment, and no unrelated target is selected.

## Configuration

- [ ] Add Vercel region configuration for both apps and environment identity/example keys.
- [ ] Add a secret-safe deployment/preflight script or runbook that can resume by project ref/id.
- [ ] Make Playwright/public smoke accept explicit Participant/Admin base URLs without embedding credentials.

## Provision

- [ ] Generate secrets without output; create Supabase project and wait for ACTIVE.
- [ ] Link exact Supabase ref, migrate, verify schema/RLS/private bucket and run cloud demo refresh.
- [ ] Create/link the two Vercel projects; configure key presence, site URLs, cookie names, Node 24 and `sfo1`.
- [ ] Deploy Participant and Admin to production; capture deployment ids/URLs without secrets.

## Public Verification

- [ ] Health and route isolation checks.
- [ ] Admin and three Participant locales login/switch/persistence checks.
- [ ] Invitation/task/session/upload/reconcile/metadata/review smoke using generated small valid MP4.
- [ ] Inspect Vercel function logs and Supabase state for errors, orphan objects and audit continuity.
- [ ] Run `pnpm repo:safety` and secret-name-only environment audit.

## Evidence and Commit

- [ ] Write `docs/acceptance/<date>-public-deployment.md` with commit, project refs/ids, regions, URLs and observed checks.
- [ ] Mark unavailable US-side independent latency observation as SKIP rather than inferred PASS; record China-side measurement from the current host.
- [ ] Commit only deployment config, smoke tooling, docs and child task artifacts; never stage `.env`, `.vercel`, Supabase secret files or video fixtures.

## HOLD Rules

- Any purchase/upgrade prompt, missing organization permission, quota denial or name collision requiring a scope decision → `WAITING_EXTERNAL`.
- Any target identity mismatch or reference to the Text2SQL project → immediate stop before write.
- No public completion claim until both deployment and business-flow smoke pass on one commit snapshot.
