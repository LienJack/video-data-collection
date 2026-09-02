# Deterministic Demo Data Refresh Contract

## Scenario: Rebuild a dedicated EgoCapture demo environment

### 1. Scope / Trigger

Use this contract when changing the deterministic demo catalog, clearing demo data, preparing an interview environment, or adding a new dedicated cloud demo project.

The refresh crosses PostgreSQL, Supabase Auth, Supabase Storage, lifecycle-state metadata, and both web applications. It is intentionally destructive only after proving the exact target. It must never be generalized into a database-wide, organization-wide, Docker-wide, or bucket-wide cleanup command.

### 2. Signatures

The supported command signatures are:

```bash
# Read-only inspection is the default.
pnpm db:demo:refresh -- --inspect

# Destructive refresh of an already reviewed target.
pnpm db:demo:refresh -- --execute --confirm <environment-id> --anchor <ISO-date-time>

# Verify the deterministic graph without changing it.
pnpm db:test:seed
```

The parser accepts one optional leading standalone `--`, then only `--inspect`, `--execute`, `--confirm <value>`, and `--anchor <ISO-date-time>`. `--inspect` and `--execute` are mutually exclusive.

The implementation boundary is:

```ts
type DemoRefreshOptions = {
  mode: "inspect" | "execute";
  confirm?: string;
  anchor?: string;
};

function assertConfiguredTargetEndpoints(
  environmentId: string,
  endpoints: {
    databaseHostname: string;
    databasePort: string;
    databaseUsername: string;
    databaseName: string;
    apiUrl: string;
    storageTusUrl: string;
  },
): void;

async function orchestrateDemoRefresh(
  options: DemoRefreshOptions,
  environmentId: string,
  resetAllowedMarker: string | undefined,
  runtime: DemoRefreshRuntime,
): Promise<DemoRefreshResult>;
```

The database purge is limited to the explicit `EGOCAPTURE_BUSINESS_TABLES` manifest. It preserves `egocapture.schema_migrations` and `egocapture.state_machine_transitions`.

### 3. Contracts

Required integration environment keys:

| Key | Contract |
| --- | --- |
| `EGOCAPTURE_DEV_PROFILE` | Selects `.runtime/<profile>/app.env`; use `nas` for the supervised NAS tunnel. |
| `EGOCAPTURE_ENVIRONMENT_ID` | Exact target identity. The reviewed NAS value is `egocapture-nas-interview`; a cloud value is `egocapture-demo-<supabase-project-ref>`. |
| `EGOCAPTURE_DEMO_RESET_ALLOWED` | Execute-only marker equal to `ALLOW-DEMO-RESET:<environment-id>`. |
| `DEMO_SEED_ANCHOR` | Optional ISO date-time used for deterministic chronology. The command `--anchor` overrides it. |
| `DATABASE_URL` | Must resolve to the same reviewed Supabase project as the API endpoint. |
| `NEXT_PUBLIC_SUPABASE_URL` | Root API URL for the exact Supabase project. |
| `NEXT_PUBLIC_STORAGE_TUS_ENDPOINT` | Same origin as the API URL and exact path `/storage/v1/upload/resumable`. |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-only credential used for scoped Auth and Storage administration; never print or expose it. |
| `DEMO_ADMIN_*`, `DEMO_PARTICIPANT_PASSWORD` | Runtime-only fixture credentials; never commit their values. |

Target identity rules:

- NAS: database `127.0.0.1:56522/postgres`, API origin `http://127.0.0.1:56521`, and environment id `egocapture-nas-interview` must all match.
- Cloud: API must be `https://<ref>.supabase.co`; the environment id must be `egocapture-demo-<ref>`; the direct database host must be `db.<ref>.supabase.co`, or the pooler username must be `postgres.<ref>`.
- Both targets require the exact migration frontier `0001` through `0024`, the exact reviewed schema manifest, and a private bucket whose id and name are both `egocapture-raw`.

Execution order is fixed:

1. Inspect and print redacted identity/count evidence.
2. Delete only the object names captured from the inspected `egocapture-raw` bucket.
3. Truncate only the explicit business-table manifest in one transaction while holding the demo-refresh advisory lock.
4. Delete only the Auth user ids captured from the dedicated target; already-absent users are retry-safe.
5. Re-inspect and require zero business rows, zero Auth users, zero linked Auth ids, and zero bucket objects.
6. Seed from the deterministic catalog and the selected anchor.
7. Run `db:test:seed` and `db:test:rls` with the same anchor.

The catalog is the single source of fixture identity. Stable keys derive UUIDs/public ids and cover 18 fictional participants (six each for CN, US, and JP), three locale-specific participant logins, one demo admin, realistic device models, localized tasks, and the reviewed scenario set. User-authored task content remains in its authored language when the UI locale changes.

### 4. Validation & Error Matrix

| Condition | Required result |
| --- | --- |
| No mode supplied or `--inspect` supplied | Print target/table/Auth/Storage counts and perform zero writes. |
| `--inspect` combined with `--execute` | `HOLD: --inspect and --execute are mutually exclusive`. |
| Unknown, duplicate, or valueless argument | `HOLD` before any target mutation. |
| `--anchor` is not an ISO date-time | `HOLD: --anchor must be an ISO date-time`. |
| Environment id is unknown, shared, Text2SQL, local/default, or not a reviewed pattern | `HOLD` before purge planning. |
| `--confirm` differs from `EGOCAPTURE_ENVIRONMENT_ID` | `HOLD` before mutation. |
| Reset marker is absent or bound to another id | `HOLD` before mutation. |
| Database, API, TUS endpoint, or cloud project ref disagree | `HOLD` before mutation. |
| Schema manifest or migration frontier differs | `HOLD`; review and update the manifest in code before retrying. |
| Bucket is absent, public, or not exactly `egocapture-raw` | `HOLD` before mutation. |
| Auth returns duplicate/invalid ids or omits a linked user | `HOLD` before mutation. |
| Storage deletion or table transaction fails | Stop; rerun the same exact reviewed command after fixing connectivity. |
| Auth user is already absent during a retry | Treat as success and continue. |
| Any business/Auth/Storage data remains after purge | `HOLD`; do not seed over the partial purge. |
| Seed target is non-empty or fixture identity collides | `HOLD`; use the guarded refresh rather than an upsert/overwrite. |
| Seed digest, state distribution, FK, RLS, Auth, or bucket proof differs | Fail verification and do not claim the environment is ready. |

All surfaced errors must pass through `redactSensitiveText`; database passwords, JWTs, query secrets, and signed URLs must not appear in logs or task evidence.

### 5. Good / Base / Bad Cases

Good:

```bash
EGOCAPTURE_DEV_PROFILE=nas \
EGOCAPTURE_ENVIRONMENT_ID=egocapture-nas-interview \
EGOCAPTURE_DEMO_RESET_ALLOWED=ALLOW-DEMO-RESET:egocapture-nas-interview \
pnpm db:demo:refresh -- --execute \
  --confirm egocapture-nas-interview \
  --anchor 2026-09-01T00:00:00.000Z
```

Base:

```bash
EGOCAPTURE_DEV_PROFILE=nas \
EGOCAPTURE_ENVIRONMENT_ID=egocapture-nas-interview \
pnpm db:demo:refresh -- --inspect
```

Bad:

```bash
# Missing the exact target proof and attempts an unreviewed destructive action.
pnpm db:demo:refresh -- --execute --confirm production
```

### 6. Tests Required

- Unit: parser defaults to inspect, accepts one leading `--`, rejects conflicting/duplicate/unknown arguments, and normalizes the anchor.
- Unit: NAS and cloud endpoint binding rejects wrong ports, wrong origins, loopback cloud URLs, mismatched project refs, and forbidden environment ids.
- Unit: authorization requires both exact confirmation and exact reset marker before any operation is invoked.
- Unit: purge order is Storage, PostgreSQL, then Auth; partial failures are retry-safe and never escape the captured object/user/table sets.
- Unit: the catalog contains exactly the reviewed regional/login/scenario coverage; all persisted states validate against shared lifecycle metadata.
- Unit: Playwright global setup exits after a successful deterministic verification, falls back in `seed -> verify` order only after a failed verification, and stops immediately when the empty-graph seed guard holds.
- Integration: two guarded refreshes with the same anchor produce identical counts, state distributions, stable identities, task hashes, and snapshot digest.
- Integration: `db:test:seed` proves FK integrity, one current MatchDecision, exact Auth users, private empty fixture bucket, state distributions, and RLS.
- E2E: run write-producing main flow separately, restore the deterministic baseline, then verify records, task workbench, locale/system guide, and Chromium/WebKit isolation/upload paths.
- Repository: `pnpm test`, `pnpm typecheck`, `pnpm lint`, `pnpm build`, `pnpm repo:safety`, and `git diff --check` must pass.

E2E global setup first runs `db:test:seed`. If the deterministic graph is already valid, it does not seed again. If verification fails, `db:seed` may initialize an empty database, but a non-empty mismatched graph remains a safety HOLD and requires the guarded refresh.

### 7. Wrong vs Correct

#### Wrong

```ts
// Random data cannot be reviewed or reproduced, and upsert can overwrite a collision.
await db`insert into egocapture.participants (...) values (${crypto.randomUUID()}, ${faker.person.fullName()})
         on conflict (...) do update set display_alias = excluded.display_alias`;
```

#### Correct

```ts
const person = DEMO_CATALOG.people.find((candidate) => candidate.key === "cn-lin-xiaoyu")!;
// Stable identity and content are inserted only after the exact target is proven empty.
await assertBusinessGraphIsEmpty(db);
await insertReviewedParticipantFixture(db, person, anchor);
```

The same rule applies to lifecycle state. A refresh creates the reviewed snapshot after a clean boundary; it must not force an existing row backward through the state graph.
