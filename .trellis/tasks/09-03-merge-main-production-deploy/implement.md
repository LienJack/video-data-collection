# Implementation Plan

## 1. Freeze and prepare the release snapshot

- [x] Record the current PR head candidate and re-check `origin/main...HEAD` divergence.
- [x] Fix only the whitespace errors reported by `git diff --check origin/main...HEAD`.
- [x] Commit this task's planning/context files and scoped release fixes without staging pre-existing dirty paths.
- [x] Create a temporary detached worktree at the resulting candidate SHA.

## 2. Validate before remote mutation

- [x] In the clean worktree run `pnpm install --frozen-lockfile`.
- [x] Run `git diff --check origin/main...HEAD`.
- [x] Run `pnpm check` (lint, strict typecheck, unit tests, both production builds).
- [x] Run `pnpm repo:safety`.
- [x] Inspect the final staged/committed path set and confirm no ignored env/media or pre-existing dirty paths are included.

## 3. Push, create PR, and pass CI

- [ ] Push `codex/egocapture-mvp` without force.
- [ ] Create a non-Draft PR to `main` with scope, validation, provider identity, rollback, and deployment plan.
- [ ] Wait for `quality`, `repository-safety`, and `browser-acceptance` on the exact PR head.
- [ ] If CI fails, fix only evidence-backed blockers, rerun local checks, push, and wait for the replacement run.

## 4. Merge and fix the deployment authority SHA

- [ ] Reconfirm mergeability, exact PR head SHA, and all required checks.
- [ ] Merge with a merge commit and fetch `origin/main`.
- [ ] Verify the merge commit contains the exact PR head and record the merge SHA.
- [ ] Create a fresh detached worktree at the merge SHA; never deploy the dirty working checkout.

## 5. Deploy both existing Vercel projects

- [ ] Reconfirm Vercel account, exact project IDs/root directories, previous deployment IDs, and Supabase ref/status.
- [ ] Link and deploy `egocapture-participant` from the clean repository-root worktree to Production; record ID/URL and wait for `READY`.
- [ ] Relink the same worktree to `egocapture-admin`, deploy to Production, record ID/URL, and wait for `READY`.
- [ ] Verify both default production aliases point to the new deployments and the deployment source metadata matches the merge SHA.

## 6. Public acceptance and baseline restoration

- [ ] Probe both health endpoints and cross-app 404 isolation.
- [ ] Load ignored production configuration without printing values and run `pnpm test:e2e:public` against the aliases.
- [ ] Run the guarded refresh only after exact environment identity inspection; restore deterministic fixtures and validate seed/RLS/private Storage/object count.
- [ ] Scan new deployment logs for 5xx and known critical DB/WASM/marker/upload failures with secret redaction.
- [ ] On any failure, restore both aliases to the recorded previous deployment pair and report HOLD/FAIL precisely.

## 7. Close out

- [ ] Update the merged PR with merge SHA, deployment IDs, alias URLs, public acceptance results, and rollback status.
- [ ] Run the Trellis final check and finish/archive the task without staging unrelated dirty work.
- [ ] Report the PR URL, merge SHA, production URLs, deployment IDs, CI/public verification results, and preserved dirty-worktree boundary.
