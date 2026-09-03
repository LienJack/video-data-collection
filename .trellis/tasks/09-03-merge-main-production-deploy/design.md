# Design: PR integration and exact-commit production release

## Release topology

```text
codex/egocapture-mvp (clean commit snapshot)
  -> GitHub PR to main
  -> required GitHub Actions
  -> merge commit on origin/main
  -> detached clean worktree at merge SHA
       -> Vercel egocapture-participant (root apps/participant-web)
       -> Vercel egocapture-admin       (root apps/admin-web)
  -> shared dedicated Supabase egocapture-demo
  -> public acceptance + guarded demo refresh
```

The working checkout is not a release input because it contains unrelated uncommitted work. Git commits, PR checks, and detached worktrees are the authority boundary.

## Git and PR strategy

- Push the current feature branch without force.
- Use one PR targeting `main` and a merge commit. The branch contains 83 intentionally separated implementation, verification, documentation, and Trellis lifecycle commits; preserving them retains the existing audit trail.
- The PR is not mergeable for this task until the three CI jobs complete successfully on the exact PR head.
- Small release-blocker fixes discovered by clean validation are committed separately and explicitly staged with this task's owned files only.

## Deployment strategy

- Fetch the post-merge `origin/main` and create a temporary detached worktree at its exact SHA.
- Install frozen dependencies in that worktree. Link one exact Vercel project at a time from the repository root, deploy with `--prod`, capture the deployment URL/ID, and verify the production alias.
- Do not provision or migrate Supabase. Production already reports migration count 24, matching the current code contract.
- Local `.env.production.admin.local` and `.env.production.participant.local` stay in the original ignored checkout with mode `0600`. Validation commands load them without echoing values; no secret files are copied into Git or task artifacts.

## Acceptance data flow

1. Read-only health and route-isolation probes confirm both aliases serve the new deployment and the shared database is ready.
2. Public Playwright acceptance uses the production aliases and ignored production configuration. The business-flow test creates only synthetic fixture-tagged records and a small decodable MP4.
3. The guarded refresh validates exact Supabase environment identity/ref, migration frontier, private bucket, and reset marker before deleting test data; it then restores deterministic demo fixtures and reruns seed/RLS checks.
4. Vercel log scans target only the two new deployment IDs and redact any provider/application errors before recording summaries.

## Failure and rollback

- Validation failure before push: no remote mutation; repair only scoped release blockers and rerun the full clean suite.
- CI failure: do not merge; inspect the failing job, make a scoped commit, and wait for the new exact-head CI run.
- Project/ref mismatch, payment/upgrade request, or missing required permission: HOLD before provider mutation.
- One-app deployment failure: do not declare partial success. Keep the healthy prior alias or explicitly restore both aliases to the recorded previous deployments.
- Post-deploy acceptance failure: restore both aliases to the previous deployment pair, then report the exact failing stage. Do not use the successful old acceptance receipt as proof for the new SHA.

## Evidence boundary

- GitHub PR and Actions are the integration proof.
- Vercel deployment IDs plus alias inspection are the publication proof.
- Public Playwright, guarded refresh, and redacted log scans are the runtime proof.
- `docs/acceptance/2026-09-03-public-deployment.md` remains immutable historical evidence for `a69858e`; the new release evidence is attached to the merged PR and final task report so it cannot falsely claim that a pre-deployment documentation commit was the deployed code snapshot.
