# Implementation Evidence

## Changes

- Added `0024_enable_state_machine_registry_rls.sql` after the immutable `0019`–`0023` migration history.
- Enabled RLS on `egocapture.state_machine_transitions` without FORCE RLS, policies, grants, or state-machine graph changes.
- Extended the database contract test to require RLS hardening for every `egocapture` business table created by migrations and to pin the additive registry migration boundary.

## NAS Evidence

- Pre-migration registry: 14 machines, 133 edges, digest `02c2c6884fdfc5a5f77037959402792e`, `rls=false`, `force_rls=false`.
- `pnpm dev:nas:migrate`: backed up the schema to `/vol1/1000/work/video-data-collection/backups/20260902T194527Z.sql.gz`, applied migration checksum `c8a18f0e79b64d99e5af8b55072b204a74650f7fea72954793063e86fb22f098`, and verified 14 machines / 133 edges / 15 triggers.
- `pnpm dev:nas:check`: database frontier, lifecycle guards, global RLS checks, participant ownership, Assignment scope, direct-write denial, immutability, GoTrue, JWT propagation, PostgREST, and Profile RLS all passed.
- Post-migration registry: 14 machines, 133 edges, the same digest `02c2c6884fdfc5a5f77037959402792e`, `rls=true`, `force_rls=false`, zero policies, and zero `anon`/`authenticated` grants.
- Both supervised tunnel runs exited cleanly; Mac ports `56521` and `56522` had no listeners afterward.

## Static Evidence

- `pnpm test -- tests/unit/state-machine-database-contract.test.ts`: 27 files / 114 tests passed; database lifecycle contract 4/4 passed.
- `pnpm typecheck`: passed, including both Next.js route type generations.
- `pnpm lint`: passed.
- `python3 ./.trellis/scripts/task.py validate .trellis/tasks/09-03-state-machine-registry-rls`: passed.
- `git diff --check`: passed.
