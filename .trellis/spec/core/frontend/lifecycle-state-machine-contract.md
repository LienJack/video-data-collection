# Lifecycle State Machine Contract

## Scenario: Persisted lifecycle transitions and client upload actors

### 1. Scope / Trigger

Use this contract whenever code adds or changes a lifecycle state, transition event, service command that changes state, database guard, or Participant upload-queue state. Pure classifications such as device consistency and capture confidence remain exhaustive functions, not mutable machines.

XState v5 is the application transition engine. PostgreSQL is still the persistence and concurrency authority. An in-memory actor mailbox must never be treated as a cross-request or cross-instance lock.

### 2. Signatures

The shared domain adapter exposes:

```ts
defineLifecycleMachine(definition): LifecycleMachine
transitionLifecycle(machine, from, event): nextState
canTransitionLifecycle(machine, from, event): boolean
lifecycleCapabilities(machine, from): event[]
lifecycleEdges(machine): { machine; event; from; to }[]

resolveServiceTransition(machine, from, event, errorCode): nextState
```

Persistent transitions use the SQL shape:

```sql
update egocapture.<table>
set <state_column> = :next_state
where id = :id and <state_column> = :expected_old
returning id;
```

The database contract is `egocapture.state_machine_transitions(machine, from_state, to_state)` plus row-level `BEFORE UPDATE` triggers using `egocapture.enforce_state_machine_transition()`.

Registry access hardening is an additive migration signature:

```sql
alter table egocapture.state_machine_transitions enable row level security;
```

### 3. Contracts

- Machine identifiers and English state/event keys are stable application data. Localize labels only at the UI boundary.
- Domain machines live in `@egocapture/core` and depend on `xstate`, not React.
- Server commands resolve a pure transition from facts read or locked inside the same transaction. They do not keep actors alive across requests.
- Every lifecycle update either locks the row first or uses an expected-old-state condition and checks the returned row count.
- Compound commands keep state writes, `AuditEvent`, and idempotency receipts in one database transaction.
- The PostgreSQL registry is an additive migration snapshot. Never edit an already-applied migration; add a new migration for graph changes.
- Every `egocapture` business table, including internal registries, has RLS enabled in the migration chain. An internal registry has no browser-facing policy or grant unless a separate reviewed contract requires one; trusted owner/service-role database paths remain the only access path.
- `db:verify` compares every live registry edge with `allLifecycleEdges`, verifies all registered triggers, probes an illegal transition, and rejects fixture bypass functions/settings.
- Participant upload actors may own runtime resources, but persisted upload DTOs must not contain `File`, TUS clients, `AbortController`, database handles, or opaque XState snapshots.
- Local database checks use the NAS profile and its supervised SSH tunnel. Do not start a local database Docker stack for acceptance.

### 4. Validation & Error Matrix

| Condition | Required result |
|---|---|
| Event has no edge from the current state | Domain-specific `DomainError`, HTTP 409 |
| Conditional update returns zero rows | Stable stale/conflict error; no audit or success response |
| Database receives an undeclared old-to-new edge | Trigger raises `check_violation` with `INVALID_STATE_TRANSITION` |
| TypeScript and live PostgreSQL edge sets differ | `db:verify` fails with missing/unexpected edges |
| Duplicate idempotent command already has a receipt | Return the recorded result without repeating side effects |
| Upload callback arrives after pause, cancel, replacement, or unmount | Ignore it or compensate on the server; do not advance the stale actor |
| Storage reports a complete TUS object while the attempt is paused | Reconciliation may use the declared `complete` event; the explicit `paused -> completed` edge is required |
| Fixture tooling attempts an illegal reverse transition | Reject it; refresh must delete and reseed instead of bypassing guards |
| A migration creates an `egocapture` business table without enabling RLS | Static database contract and live `dev:nas:check` fail |
| Registry hardening adds a policy, grant, or FORCE RLS | Reject the migration; it changes the reviewed trusted-server access boundary |

### 5. Good / Base / Bad Cases

- Good: lock the UploadAttempt, derive the event from its actual state, resolve the machine transition, conditionally update it, and write the audit in one transaction.
- Base: a repeated completion command finds an already-completed receipt and returns the same result without another transition.
- Bad: read `status` before a transaction, update with a stale assumption, ignore an empty `RETURNING`, then write an audit claiming success.
- Good: keep every non-canceled Assignment-to-accepted Review correction edge explicit because the Review command historically supports that contract.
- Bad: add a hidden session setting that disables lifecycle triggers for demo rows.
- Good: add a later migration that enables RLS on an existing internal registry while preserving its rows, digest, triggers, and zero-policy access boundary.
- Bad: edit the historical table-creation migration or add a permissive `authenticated` read policy merely to make an RLS check pass.

### 6. Tests Required

- Unit: every declared edge succeeds; undeclared edges and terminal-state events fail with the expected machine/error code.
- Unit: `lifecycleEdges` and capability selectors expose the same graph used by transition execution.
- Unit/UI: two upload items evolve independently; pause/resume/cancel work; late credentials and TUS callbacks after cancel/unmount cannot restart or mutate an item.
- Database: live registry and `allLifecycleEdges` have identical edge sets; exactly one trigger exists for every controlled column; a direct illegal SQL update is rejected.
- Database/security: the migration snapshot enables RLS for every created `egocapture` business table; live registry reports `relrowsecurity = true`, `relforcerowsecurity = false`, zero policies, and no `public`/`anon`/`authenticated` table privileges.
- Concurrency: two commands using the same expected old state produce one success, one stale result, and one set of audit/effect records.
- Integration: Participant, Task, Session, Upload, Review, and Cron checks run against the NAS database profile.
- E2E: the Admin-to-Participant upload and immutable Review correction flow passes on one database migration frontier.

### 7. Wrong vs Correct

#### Wrong

```ts
const row = await db`select status from egocapture.upload_attempts where id = ${id}`;
await db`update egocapture.upload_attempts set status = 'completed' where id = ${id}`;
await writeAudit(db, { action: "upload.completed" });
```

This can use a stale read and record a success after another request changed the row.

#### Correct

```ts
await db.begin(async (tx) => {
  const [current] = await tx`
    select status from egocapture.upload_attempts
    where id = ${id}::uuid for update
  `;
  const next = resolveServiceTransition(
    uploadAttemptMachine,
    current.status,
    "complete",
    "INVALID_UPLOAD_STATE",
  );
  const updated = await tx`
    update egocapture.upload_attempts set status = ${next}
    where id = ${id}::uuid and status = ${current.status}
    returning id
  `;
  if (updated.length === 0) {
    throw new DomainError("STALE_UPLOAD_STATE", "Upload state changed", 409);
  }
  await writeAudit(tx, { action: "upload.completed" });
});
```

The row state, transition decision, conditional write, and audit share one transaction boundary.

For registry hardening, do not rewrite an applied migration or grant browser access:

```sql
-- Wrong: mutates history and broadens the surface.
grant select on egocapture.state_machine_transitions to authenticated;
create policy registry_read on egocapture.state_machine_transitions for select using (true);

-- Correct: a new sequential migration preserves the trusted-server boundary.
alter table egocapture.state_machine_transitions enable row level security;
```
