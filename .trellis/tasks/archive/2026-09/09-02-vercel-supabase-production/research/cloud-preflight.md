# Cloud Preflight — 2026-09-02

## Live Read-Only Results

- Vercel CLI: 53.1.0; authenticated user `lienjoe96-9694`.
- Vercel team: `lienjoe96-gmailcoms-projects`; seven visible projects, none named EgoCapture.
- Supabase CLI: 2.116.0; authenticated organization `lien`.
- One visible Supabase project: `text2sql Platform Design`, region `ap-northeast-1`, status `INACTIVE`, not linked. It is unrelated and prohibited from all writes.
- No root/admin/participant `.vercel/project.json`; no Supabase project link/config in this repository.

No secret values were inspected or recorded.

## Region Decision

User chose an American node to prioritize the US Leader while keeping China as usable as possible. Shared-provider placement:

- Supabase: North California `us-west-1`.
- Vercel: San Francisco `sfo1`.

Official references:

- https://supabase.com/docs/guides/platform/regions
- https://vercel.com/docs/regions

Vercel documents that Functions should run in the same region as, or close to, the data source. `sfo1` and `us-west-1` are the matching west-US placement. Static delivery remains global; this decision primarily controls dynamic/database/storage paths.

## External Unknowns

- The organization plan/quota response for creating another Supabase project is not known until the create flow.
- Project name availability is only confirmed at creation time.
- A US-side independent latency probe is not available from the current China host; do not claim it without observation.
