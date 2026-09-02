# Technical Design

## Target Topology

```text
Global Vercel CDN
  -> Participant Next.js / sfo1 ----\
                                      -> Supabase us-west-1
  -> Admin Next.js / sfo1 ----------/    Auth + Postgres + private Storage

Participant browser --------------------> signed TUS Storage endpoint
```

Static assets are served from the global CDN. Dynamic Node Functions run in `sfo1`, close to the `us-west-1` database. Video bytes continue directly from the Participant browser to Supabase Storage.

## Resource Identity

- Supabase project display name `egocapture-demo`; record returned project ref and org id in a secret-free receipt.
- Vercel projects `egocapture-participant` and `egocapture-admin`; root directories and production URLs are explicit.
- A local deployment receipt maps resource ids to this Trellis task. Resume checks that mapping before any create call.

## Secret Flow

Secrets are generated in-memory and piped directly to CLI/API consumers without printing. Vercel environment keys are added separately per project and verified by names only. Local `.env` remains gitignored; no service role key, database password, private JWK, demo password or Cron secret is persisted in task documents.

If a CLI requires a value in process arguments, use the shortest-lived process possible and never enable shell tracing. Any ambiguous exposure triggers rotation before acceptance.

## Provision Sequence

1. Read-only auth/team/org/project/plan preflight.
2. Create dedicated Supabase project in `us-west-1`, wait for ACTIVE, link exact ref.
3. Apply migrations with stop-on-error; verify ledger/schema/RLS/bucket.
4. Configure official signed Storage and run deterministic demo refresh.
5. Create/link the two Vercel projects, set root/build/Node 24/`sfo1` and environment keys.
6. Deploy Participant first, then Admin with final mutual site URLs; redeploy if the first URL was needed for variables.
7. Run public smoke and write acceptance receipt.

## Rollback and Failure Boundaries

- Build/deploy failure: retain project and inspect logs; promote previous deployment if one exists.
- Migration failure: stop before seed/deploy, report exact migration; do not partially claim success.
- Smoke failure: keep URLs but mark public acceptance failed; rotate credentials if auth boundaries are uncertain.
- Never delete cloud projects automatically. Resource deletion needs a separate explicit user request.
- No automatic plan upgrade or purchase.
