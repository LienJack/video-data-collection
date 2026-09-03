# Release preflight — 2026-09-03

## GitHub

- Repository: `LienJack/video-data-collection`
- Default/base branch: `main`
- Candidate branch: `codex/egocapture-mvp`
- Observed candidate before planning artifacts: `e0c2d85`
- Observed base: `origin/main=bde3b9b`
- Divergence: `0 behind / 83 ahead`
- Existing PR for candidate branch: none
- GitHub CLI authentication: active as `LienJack`
- Merge methods: merge, rebase, and squash enabled
- Branch protection: absent
- CI on pull requests: `quality`, `repository-safety`, `browser-acceptance`

## Working-tree isolation

The main checkout contains pre-existing uncommitted participant UI, CSS, unit/E2E test, Trellis task, and `需求.md` paths. They are not release input. All checks/deploys must use committed snapshots in temporary worktrees, and staging must name owned paths explicitly.

## Vercel

- Authenticated account: `lienjoe96-9694`
- Team scope: `lienjoe96-gmailcoms-projects`
- Participant project: `egocapture-participant`, `prj_7d3CY9Ufac7mElPp8zFcj9XdrABq`, root `apps/participant-web`, Node 24
- Admin project: `egocapture-admin`, `prj_uTBUH1q87MwrtdOpdiab7Wf7Jo4T`, root `apps/admin-web`, Node 24
- Previous verified Participant deployment: `dpl_2PN54Lc91sVmdTKTTSt39JHPbJKF`
- Previous verified Admin deployment: `dpl_6FX2VsXRuwUFQfzKdqp4qSpoAHV9`
- Both production aliases were `READY` during preflight.

## Supabase and public runtime

- Dedicated project: `egocapture-demo`, ref `phchhsatgoxlqqhpnnfk`, region `us-west-1`, status `ACTIVE_HEALTHY`
- Unrelated `text2sql Platform Design` is inactive and out of scope.
- Participant/Admin `/api/health`: HTTP 200, database `true`, migration count `24`.
- Ignored production env files exist locally, both mode `0600`; their values were not printed.

## Known release blocker

`git diff --check origin/main...HEAD` initially reported trailing/newline whitespace in four committed paths. Commit `86388c6` corrected only those paths and added the reviewed release task artifacts. A detached worktree at exact commit `86388c6b26509127f7feae726b7a937df8140f10` then passed:

- `pnpm install --frozen-lockfile`
- `git diff --check origin/main...HEAD`
- `pnpm check`: lint, strict TypeScript, 36 Vitest files / 152 tests, Participant build, Admin build
- `pnpm repo:safety`: no large tracked media or obvious committed secrets

The original working checkout's pre-existing uncommitted paths remained outside the release worktree and commit.

## Independent final check

The required Trellis full-scope check reviewed the committed diff across `admin-web`, `participant-web`, `core`, and `ui` on the same detached snapshot. It found no verified release-blocking defect and made no changes. In addition to rerunning the local gates, it spot-checked `sfo1` configuration, production database pool size, serialized server queries, shared auth-cookie options, cloud NAS-mode rejection, signed TUS headers, and guarded exact-ref refresh. Verdict: **GO** to push and create the PR; GitHub CI and post-merge public acceptance remain mandatory later gates.
