# State Management

> How state is managed in this project.

---

## Overview

<!--
Document your project's state management conventions here.

Questions to answer:
- What state management solution do you use?
- How is local vs global state decided?
- How do you handle server state?
- What are the patterns for derived state?
-->

(To be filled by the team)

---

## State Categories

<!-- Local state, global state, server state, URL state -->

(To be filled by the team)

---

## When to Use Global State

<!-- Criteria for promoting state to global -->

(To be filled by the team)

---

## Server State

<!-- How server data is cached and synchronized -->

(To be filled by the team)

---

## Common Mistakes

<!-- State management mistakes your team has made -->

(To be filled by the team)

---

## Scenario: URL-Locked Recording Session Upload

### 1. Scope / Trigger

Use this contract whenever an upload route is opened from a specific Recording Session. The route context controls the identity assigned to newly selected and resumable files, so changing that context must reset all client queue state. This prevents an existing file selected under Session A from being silently rebound after navigation to Session B.

### 2. Signatures

- Route: `GET /uploads?session=<RS-public-id>`
- Resolver: `resolveUploadSessionContext(requestedSession, participantSessions)`
- Client boundary: `<UploadQueue key={contextKey} lockedSessionPublicId={sessionPublicId} />`
- UploadIntent field: `claimedSessionPublicId: string | null`

### 3. Contracts

- No `session` query produces the generic queue, which keeps manual Session selection and `Unable to Determine`.
- Exactly one string matching an authenticated participant-owned `open` Session produces a locked queue.
- A locked queue must:
  - render the Session as non-editable context;
  - initialize every new file with that Session;
  - reject persisted upload state belonging to another Session;
  - send the locked Session as `claimedSessionPublicId` and `unableToDetermine: false`.
- The React `key` must distinguish generic context and every locked Session so route transitions remount the queue.
- The UploadIntent service remains the authority and must independently verify participant ownership and `open` status before persisting `claimed_session_id`.

### 4. Validation & Error Matrix

| Condition | Required behavior |
| --- | --- |
| Missing query | Render the generic queue |
| Empty query, repeated query array, unknown Session, closed Session, or unowned Session | Do not render the queue; show the invalid-context recovery message |
| Persisted upload belongs to another Session or is `Unable to Determine` | Reject restore and do not create an UploadIntent |
| Session closes after page render | Let the UploadIntent service reject it as unavailable |

### 5. Good / Base / Bad Cases

- Good: `/uploads?session=RS-OPEN` resolves from the current participant's Session list, renders a locked label, and posts `claimedSessionPublicId: "RS-OPEN"`.
- Base: `/uploads` renders the existing selector and preserves `Unable to Determine`.
- Bad: `/uploads?session=RS-OTHER` trusts the query directly or restores a file previously bound to a different Session.

### 6. Tests Required

- Unit-test generic, locked, invalid, closed, unowned, and repeated query inputs.
- Component-test the absence of the Session selector in locked mode and assert the UploadIntent request body.
- Component-test rejection of cross-Session persisted uploads and assert that no API request is sent.
- Browser-test the Session card QR, the query-bearing upload link, and the locked Session message after navigation.
- Integration-test that the server rejects Sessions outside the authenticated participant or not in `open` state.

### 7. Wrong vs Correct

#### Wrong

```tsx
<UploadQueue lockedSessionPublicId={session.publicId} sessions={sessions} />
```

React may preserve queue state when only the prop changes.

#### Correct

```tsx
<UploadQueue
  key={`locked:${session.publicId}`}
  lockedSessionPublicId={session.publicId}
  sessions={sessions}
/>
```

The context-specific key remounts the queue before any file can inherit a different locked Session.
