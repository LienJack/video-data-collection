# Upload and live-stream evidence synthesis

Research snapshot: 2026-09-01 fixed local evidence under `/Users/lienli/Documents/work/深度调研/research/egocentric-video-data-collection-mvp/`. This synthesis is the portable context for this task. It is design evidence, not implemented or deployed proof.

## Resumable upload

### Current TUS boundary

- TUS uses `HEAD`/server `Upload-Offset` as resume truth; a local record only helps locate the remote resource. Offset disagreement is a protocol conflict, not permission to skip bytes. Official reference: [TUS resumable upload protocol](https://tus.io/protocols/resumable-upload).
- Supabase Storage supports resumable TUS upload, but the research snapshot records an upload URL lifetime of about 24 hours. Current product copy must describe pause/refresh/limited recovery, not guaranteed multi-day continuation. Official reference: [Supabase resumable uploads](https://supabase.com/docs/guides/storage/uploads/resumable-uploads).
- Current repository code detects 404/410 as an expired resource. Expiry requires a new provider resource/re-upload path while preserving business/audit history; it is not a continuation from the old offset.

### Future S3 Multipart path

- `CreateMultipartUpload` yields the provider `uploadId`. The application must persist that ID and the checksum contract on the existing business UploadAttempt.
- Each part receives a short-lived presigned URL. Parts can upload independently/concurrently; success receipts persist `partNumber`, size, ETag and/or checksum. Reissuing a URL for the same missing part must not create a new multipart session.
- On pause/refresh/device reconnect, the user reselects the file and verifies its stable fingerprint. The server reconciles the application manifest with provider `ListParts`, then signs only absent/unconfirmed parts.
- `CompleteMultipartUpload` uses the application-owned ordered part manifest. Provider listing is reconciliation evidence, not a replacement for the receipts the application accepted.
- Completion is not final business truth until `HeadObject`/provider receipt, object size/checksum, object key and UploadAttempt are reconciled. Multipart ETag must not be presented as a stable full-object content hash.
- Abandoned uploads require explicit Abort and an `AbortIncompleteMultipartUpload` lifecycle policy; incomplete parts otherwise incur storage cost.
- Official references: [S3 Multipart overview](https://docs.aws.amazon.com/AmazonS3/latest/userguide/mpuoverview.html), [S3 object integrity](https://docs.aws.amazon.com/AmazonS3/latest/userguide/checking-object-integrity-upload.html), [CompleteMultipartUpload](https://docs.aws.amazon.com/AmazonS3/latest/API/API_CompleteMultipartUpload.html).

## Future live-stream reference path

### Vendor-neutral authority boundary

- `LiveCapture`/RecordingSession, participant/task/device binding, retention, deletion and AuditEvent remain internal Postgres authority.
- A provider channel/input/recording ID is only an external reference. Provider callbacks are at-least-once operational evidence and must be authenticated, deduplicated, ordered/reconciled, and mapped back to the internal record.
- Provider selection remains deferred. The article uses AWS IVS as a concrete reference because it supports browser broadcast and automatic recording to a system-controlled S3 bucket. Cloudflare Stream and Mux remain replaceable adapters, not equal-contract claims.

### AWS IVS reference flow

- Browser/mobile capture can use the Amazon IVS Web Broadcast SDK; external cameras/encoders can use an ingest endpoint such as RTMPS. The control plane issues short-lived/scope-limited broadcast authorization and never exposes long-lived AWS credentials. Official reference: [IVS Web Broadcast SDK guide](https://docs.aws.amazon.com/ivs/latest/LowLatencyUserGuide/broadcast-web.html).
- Auto-record to S3 writes HLS manifests, segments and recording metadata under a provider-generated S3 prefix. Management does not download the player stream and upload it again; it observes and reconciles automatic server-side recording. Official reference: [IVS auto-record to S3](https://docs.aws.amazon.com/ivs/latest/LowLatencyUserGuide/record-to-s3.html).
- Recording state-change/EventBridge events include the bucket/prefix and recording status. Consumers should upsert an event inbox by provider/event ID, then read provider metadata after Recording End/Failed before registering VideoAsset/ValidationRun.
- IVS recording metadata, not a hard-coded rendition path, determines available HLS playlists and renditions. Recorded objects are private by default; Admin playback should use a controlled CDN/signed delivery path rather than direct public S3 objects.
- Reconnect windows can merge short interruptions into one recording prefix, but the exact provider limits and failure semantics require a production POC. Documentation must mark them as future operational design.

### Safety and deferred validation

- Rotate/revoke broadcast keys and end inputs when a LiveCapture closes; never place secrets in diagrams or documentation HTML.
- Admin sees internal capture/recording states and uses a short-lived playback grant. Reads, exports, deletion and retention actions are audited.
- Before adoption, independently validate data residency/DPA, source codec compatibility, recording gaps, callback delay/ordering, original-media export, deletion receipts, cost, and provider exit.
