# Implementation Plan

## 0. Protect Existing Work

- [ ] Re-open `09-02-participant-view-edit-drawer`, run its required checks, and commit only its owned files if it is complete.
- [ ] Re-run `git status --short`; record all remaining unrelated paths and never stage them.

## 1. Unified State Machines

- [ ] Start and execute `09-02-unified-state-machines`.
- [ ] Run focused unit, database integration, upload, review and concurrency checks.
- [ ] Commit and archive the child before continuing.

## 2. zh-CN / en / ja i18n

- [ ] Start and execute `09-02-zh-en-ja-i18n` against the committed state-machine snapshot.
- [ ] Run translation completeness, unit, build and three-locale browser checks.
- [ ] Commit and archive the child before continuing.

## 3. Deterministic Demo Data

- [ ] Start and execute `09-02-deterministic-demo-data`.
- [ ] Dry-run the reset against the exact local environment id, then use the user's authorization to remove current EgoCapture business data and rebuild fixtures.
- [ ] Run seed idempotency, integrity and UI coverage checks.
- [ ] Commit and archive the child before continuing.

## 4. US West Cloud Deployment

- [ ] Start and execute `09-02-vercel-supabase-production`.
- [ ] Re-run read-only auth/quota/name preflight; stop on any purchase prompt.
- [ ] Create or resume only the dedicated EgoCapture resources, migrate, seed, configure secrets and deploy both apps.
- [ ] Run public health, route isolation, auth, locale and core-flow smoke checks.
- [ ] Commit deployment configuration/acceptance evidence without secrets and archive the child.

## 5. Parent Integration Gate

- [ ] Run `pnpm repo:safety`, `pnpm check`, database verification, seed check and the required Playwright suites on one commit snapshot.
- [ ] Verify `git diff --check` and explicit staged paths.
- [ ] Record child commits, cloud project refs, public URLs and observed acceptance status.
- [ ] Mark the parent complete only when all four children are archived or an exact `WAITING_EXTERNAL` boundary is recorded for deployment.
