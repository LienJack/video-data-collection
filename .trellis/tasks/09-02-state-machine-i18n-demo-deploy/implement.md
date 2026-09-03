# Implementation Plan

## 0. Protect Existing Work

- [x] Classify `09-02-participant-view-edit-drawer` as incomplete parallel work and preserve its owned files without staging or modification.
- [x] Re-run `git status --short`; record all remaining unrelated paths and never stage them.

## 1. Unified State Machines

- [x] Start and execute `09-02-unified-state-machines`.
- [x] Run focused unit, database integration, upload, review and concurrency checks.
- [x] Commit `ef8c38e` and archive the child before continuing.

## 1.1 State-machine Registry RLS

- [x] Execute `09-03-state-machine-registry-rls` after the state-machine migration review.
- [x] Verify anonymous access is denied while Admin/Participant database scopes retain the required read boundary.
- [x] Commit `c2228c9` and archive the child before continuing.

## 2. zh-CN / en / ja i18n

- [x] Start and execute `09-02-zh-en-ja-i18n` against the committed state-machine snapshot.
- [x] Run translation completeness, unit, build and three-locale browser checks.
- [x] Commit `0145783` and archive the child before continuing.

## 3. Deterministic Demo Data

- [x] Start and execute `09-02-deterministic-demo-data`.
- [x] Dry-run the reset against the exact local environment id, then use the user's authorization to remove current EgoCapture business data and rebuild fixtures.
- [x] Run seed idempotency, integrity and UI coverage checks.
- [x] Commit `070462c` and archive the child before continuing.

## 4. US West Cloud Deployment

- [x] Start and execute `09-02-vercel-supabase-production`.
- [x] Re-run read-only auth/quota/name preflight; stop on any purchase prompt.
- [x] Create only the dedicated EgoCapture resources, migrate, seed, configure secrets and deploy both apps.
- [x] Run public health, route isolation, auth, locale and core-flow smoke checks on fixed commit `a69858e`.
- [x] Commit deployment configuration/acceptance evidence through `98ee875` without secrets and archive the child.

## 5. Parent Integration Gate

- [x] Run `pnpm repo:safety`, `pnpm check`, database verification, seed check and the required Playwright suites on the final commit snapshot.
- [x] Verify `git diff --check` and explicit staged paths.
- [x] Record child commits, cloud project refs, public URLs and observed acceptance status.
- [x] Mark the parent complete after all five children are archived and the scoped database-password rotation HOLD is recorded without blocking the deployed application GO.
