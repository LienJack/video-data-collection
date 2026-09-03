# Quality Guidelines

> Code quality standards for frontend development.

---

## Overview

<!--
Document your project's quality standards here.

Questions to answer:
- What patterns are forbidden?
- What linting rules do you enforce?
- What are your testing requirements?
- What code review standards apply?
-->

(To be filled by the team)

---

## Forbidden Patterns

<!-- Patterns that should never be used and why -->

(To be filled by the team)

---

## Required Patterns

<!-- Patterns that must always be used -->

(To be filled by the team)

---

## Testing Requirements

<!-- What level of testing is expected -->

(To be filled by the team)

---

## Code Review Checklist

<!-- What reviewers should check -->

(To be filled by the team)

## Scenario: Same-origin static HTML embedded by Admin pages

### 1. Scope / Trigger

- Trigger: an authenticated Admin route embeds committed HTML from `apps/admin-web/public` in an iframe.
- The default Admin response policy remains `X-Frame-Options: DENY` and CSP `frame-ancestors 'none'`; never weaken it for all routes to make one iframe work.

### 2. Signatures

```typescript
// apps/admin-web/next.config.ts
async headers(): Promise<Array<{
  source: string;
  headers: Array<{ key: string; value: string }>;
}>>
```

The diagram rule must target an exact static-asset namespace such as `/system-guide/diagrams/:path*.html`.

### 3. Contracts

- Global Admin pages: `X-Frame-Options: DENY`; CSP contains `frame-ancestors 'none'`.
- Approved committed diagram HTML: `X-Frame-Options: SAMEORIGIN`; CSP contains `frame-ancestors 'self'`.
- Put the more specific rule after the global rule. Next.js applies the last matching value for duplicate response-header keys.
- The static-document CSP must explicitly restrict scripts/styles/fonts/images and keep `connect-src`, forms, and objects closed unless the exact artifact requires a reviewed exception.
- The iframe `src` must be same-origin, the `title` must be descriptive, and the page must offer a normal new-tab link as a fallback.

### 4. Validation & Error Matrix

| Condition | Required result |
|---|---|
| Anonymous user opens the parent route | Existing Admin auth redirects to login |
| Non-approved Admin route is framed | Browser blocks it with global DENY / `frame-ancestors 'none'` |
| Approved diagram HTML is loaded by the same Admin origin | Response is 200 with SAMEORIGIN / `frame-ancestors 'self'` |
| Diagram path is missing or renamed | E2E fails on the exact iframe response instead of accepting an empty frame |
| Diagram requests an undeclared external capability | CSP blocks it; review the artifact before widening only the required directive |

### 5. Good/Base/Bad Cases

- Good: a specific static HTML namespace receives the narrow override and every iframe response is tested.
- Base: a normal Admin route keeps the global anti-framing headers.
- Bad: change the global policy to SAMEORIGIN, use a broad `/**/*.html` exception, or assert only that an iframe element exists.

### 6. Tests Required

- E2E: direct anonymous access to the parent route redirects to Admin login.
- E2E: fetch every iframe `src`; assert HTTP success, `X-Frame-Options: SAMEORIGIN`, and CSP `frame-ancestors 'self'`.
- E2E: assert each iframe document body becomes visible.
- Regression: keep a separate assertion or config review proving the global Admin policy is still DENY / `frame-ancestors 'none'`.

### 7. Wrong vs Correct

```typescript
// Wrong: weakens the entire Admin application.
{ source: "/(.*)", headers: [{ key: "X-Frame-Options", value: "SAMEORIGIN" }] }

// Correct: global denial first, narrow committed-artifact override last.
{ source: "/(.*)", headers: [{ key: "X-Frame-Options", value: "DENY" }] },
{ source: "/system-guide/diagrams/:path*.html", headers: [
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
] }
```
