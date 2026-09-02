# Repository evidence for system documentation

Snapshot: branch `codex/egocapture-mvp`, inspected 2026-09-02. These notes are an implementation aid; live source remains authoritative.

## Admin route and navigation boundary

- `apps/admin-web/app/(console)/layout.tsx:9-10` calls `requireAdmin()` once for the shared console layout. A `/system-guide` page inside this route group inherits the existing Admin authentication/role boundary.
- `apps/admin-web/app/(console)/layout.tsx:13-21` owns the current mobile header and right-side “全部功能” details menu.
- `apps/admin-web/app/(console)/layout.tsx:23-32` owns the desktop sidebar and the content column. A global utility link must not overlap child page headers.
- `apps/admin-web/app/(console)/console-navigation.tsx:13-19` defines five primary operational destinations. “系统说明” is a utility destination, not a sixth operational queue.
- `apps/admin-web/app/(console)/console-navigation.tsx:64-72` owns the mobile all-features menu and can expose a secondary docs entry if direct header placement becomes crowded.
- Parallel Trellis task directories and `需求.md` remain excluded from staging.

## Current architecture truth

- `README.md` defines two Next.js applications: Admin Web and Participant Web. They share `packages/core` for domain/server/upload behavior and `packages/ui` for visual primitives.
- `database/migrations/0001_core.sql` defines the authoritative chain around participants, task versions, assignments, recording sessions, uploads/attempts, stored objects, video assets, validation runs, match decisions, review cases, and audit events.
- The current product runs the business/control plane through Next.js route handlers and PostgreSQL, while video bytes go from Participant browser to private storage through TUS. The documentation must not turn local acceptance into public deployment evidence.
- The current capture flow uses a signed Recording Session marker but manual Session selection during upload. QR recognition/automatic classification remains out of scope.

## Current TUS implementation evidence

- `packages/core/src/upload/tus.ts:24-58` builds a `tus-js-client` upload with bounded retries, signed/scoped auth, `x-upsert=false`, server-chosen object key, configurable chunk size, stable business fingerprint, progress callbacks, and explicit 404/410 expiry detection.
- `packages/core/src/upload/tus.ts:61-83` finds previous uploads and resumes the first match. After choosing a previous resource it clears the create endpoint so a failed resume cannot silently create a replacement resource under the old UploadAttempt.
- `packages/core/src/upload/persistence.ts:3-20` persists upload/attempt IDs, object key, file identity, source SHA-256, Session claim, accepted bytes, recoverable state, and attempt expiry.
- `packages/core/src/upload/persistence.ts:35-46` uses versioned browser `localStorage` keys for the application resume record. Do not describe the current implementation as IndexedDB.
- `packages/core/src/upload/persistence.ts:48-67` validates persisted records before use; `:150-162` makes accepted byte progress monotonic.
- `packages/core/src/upload/fingerprint.ts:8-33` performs fingerprint work in a Web Worker.
- `packages/core/src/upload/fingerprint.worker.ts:7-20` computes a sampled v1 fingerprint from file size + first/last 1 MiB and a full source SHA-256. This is real code but its memory/performance behavior on production-size files is not production capacity proof.

## Multipart evolution reservation

- `database/migrations/0013_multipart_evolution_reservation.sql:1-4` adds optional storage region, part manifest, and completion receipt fields to UploadAttempt.
- `database/migrations/0013_multipart_evolution_reservation.sql:18-29` creates a restricted `multipart_upload_parts` table keyed by UploadAttempt + part number, with size, ETag/checksum, and completion time.
- This schema reservation is not an enabled S3 Multipart runtime. Documentation may use it to explain a compatible migration path only.

## Installed Next.js contract

- Installed version is Next.js `16.3.4`; AGENTS requires reading the matching local docs before edits.
- `apps/admin-web/node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/public-folder.md` confirms committed files under `public/` are served from base-relative URLs and may include static HTML.
- `apps/admin-web/node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/route-groups.md` confirms `(console)` is organizational and omitted from the URL.
- `apps/admin-web/node_modules/next/dist/docs/01-app/01-getting-started/04-linking-and-navigating.md` confirms `Link` client navigation and anchor scroll behavior, including sticky-header scroll-offset considerations.
