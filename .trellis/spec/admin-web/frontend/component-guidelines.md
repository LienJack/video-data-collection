# Component Guidelines

> How components are built in this project.

---

## Overview

<!--
Document your project's component conventions here.

Questions to answer:
- What component patterns do you use?
- How are props defined?
- How do you handle composition?
- What accessibility standards apply?
-->

(To be filled by the team)

---

## Component Structure

<!-- Standard structure of a component file -->

(To be filled by the team)

---

## Props Conventions

<!-- How props should be defined and typed -->

(To be filled by the team)

---

## Styling Patterns

<!-- How styles are applied (CSS modules, styled-components, Tailwind, etc.) -->

(To be filled by the team)

---

## Accessibility

<!-- A11y requirements and patterns -->

(To be filled by the team)

---

## Common Mistakes

<!-- Component-related mistakes your team has made -->

(To be filled by the team)

## Scenario: Sensitive admin detail drawer

### Scope and boundary

- Keep the list page as a Server Component and pass only non-sensitive row summary data to the row action Client Component.
- Fetch sensitive or complete detail data only after the admin opens the drawer. Use the authorized single-record endpoint with `cache: "no-store"`; never add credentials to list results, URLs, logs, analytics, or browser persistence.
- Keep the canonical detail-page link available. A drawer covers fast viewing and low-risk edits, not every management action.

### Native dialog contract

- Use `showModal()` and an `aria-labelledby` title. Record the exact trigger and restore its focus after every close path.
- Route close button, `Escape`, and backdrop clicks through one cleanup function. Preserve and restore the pre-existing `body.style.overflow` value.
- Do not assume native dialog focus containment is sufficient in every supported browser. Implement and test explicit `Tab` and `Shift+Tab` wrapping when the UI requires a strict modal boundary.
- Put right-side positioning overrides in the owning app stylesheet. Do not change the shared `.apple-dialog` behavior for an app-specific drawer.

### Async and sensitive-state contract

- Assign a generation token to each open drawer session. GET, mutation, and clipboard continuations may update state only when their captured token still identifies the currently open session.
- Closing or unmounting invalidates the generation, aborts abortable requests, clears detail and credential state, clears confirmation and copy feedback, and releases mutation guards.
- A reset response that returns a new credential and record `updatedAt` must merge both values atomically. Later profile edits must use the refreshed `updatedAt` for optimistic locking.
- Retain an idempotency key for retries of the same uncertain credential operation, but clear it when that operation succeeds, is explicitly cancelled, or the drawer closes.

### Required tests

- Component tests: lazy fetch, GET error retry, approved PATCH fields, stale-write reload, fixture protection, clipboard primary/fallback paths, idempotent reset retry, and late GET/reset/PATCH responses after close or reopen.
- Browser tests: modal title, `Tab`/`Shift+Tab` containment, `Escape`, backdrop, focus restoration, exact scroll-lock restoration, current query-string preservation, and 320/390px viewport bounds.
