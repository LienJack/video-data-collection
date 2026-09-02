# State Inventory

## Observed Persistent Fields

`database/migrations/0001_core.sql` 定义了以下生命周期列：participants.status / consent_status、participant_invitations.status、consent_records.status、devices.status、tasks.lifecycle、assignments.status、recording_sessions.status、upload_batches.status、upload_intents.transfer_status / metadata_status、upload_attempts.status、video_assets.status、metadata_attempts.status、review_cases.status。

值域已有 CHECK，但旧值→新值普遍没有数据库约束。Participant 在 `packages/core/src/domain/participant.ts` 有局部 transition map；Assignment 在 `packages/core/src/domain/assignment.ts` 只有 acknowledge/cancel/extend 谓词。

## Observed Write Clusters

- Participant/Invitation/Consent/Device: `packages/core/src/server/services/participants.ts`
- Task/Assignment: `packages/core/src/server/services/tasks.ts`
- RecordingSession: `packages/core/src/server/services/sessions.ts`
- Batch/Intent/Attempt: `packages/core/src/server/services/uploads.ts`
- Metadata lifecycle: `packages/core/src/server/services/metadata.ts`
- Asset/Assignment/Session/Review compound resolution: `packages/core/src/server/services/review.ts`
- Expiry, retention and fixture rewind: `packages/core/src/server/services/maintenance.ts`

The services currently contain direct state SQL updates and scattered `includes`/equality guards. Several commands update multiple entities in one transaction, so state machine adoption must preserve compound atomicity.

## Non-Machines

- MatchDecision is an append-only/superseding decision chain.
- ParticipantCredentialStatus, device consistency and capture confidence are derived classifications.
- HTTP response status and guide display status are not domain lifecycles.
- `QueueStatus` in `apps/participant-web/app/(portal)/uploads/upload-queue.tsx` is a real transient workflow and should be a client machine.

## Cross-Layer Risk

Database registry, TypeScript transition metadata, service SQL and UI actions are four consumers of the same contract. A conformance test is required so adding a state or edge cannot update only one layer.
