# Demo Data Inventory

## Current Seed

`scripts/seed.ts` currently creates one participant (`Participant Demo`), one device (`Synthetic / Demo Phone`), four Chinese tasks, four assignments, one session, two upload paths and seven open review fixtures. Country is `Demo Region`; ids are fixed.

`scripts/seed-check.ts` is tightly coupled to those ids and counts. Several E2E files assert the literal `Participant Demo`, so tests must move to stable public ids or catalog keys.

## Current Reset

`scripts/reset-task-data.ts` requires `RESET-EGOCAPTURE-TASK-DATA` but only truncates tasks and upload batches with cascade. It preserves participants, consent, devices, profiles, Auth users and Storage bytes, so it cannot satisfy a full clean rebuild.

## Existing Safety Signals

- Fixture ownership uses `is_fixture` plus fixed ids/public ids.
- Auth fixture users carry `egocapture_fixture` and `egocapture_role` metadata.
- Demo credentials come from environment variables.
- The raw Storage bucket is dedicated by constant but its bytes are not cleared by the current reset.

## Recommended Dataset Shape

Use a curated deterministic factory rather than random names: six CN, six US and six JP identities, with stable scenario keys. This follows Mock/Faker's factory separation while keeping screenshots and integration assertions reproducible and avoiding accidental real contact data.
