# i18n Inventory

## Current Evidence

- Both apps use Next.js 16.3.4 App Router and have root `app/layout.tsx` files with fixed language assumptions.
- User-facing Chinese and mixed English strings exist throughout pages, client components, service errors and Zod validators.
- `apps/admin-web/app/_components/regional-preferences-fields.tsx` currently hard-codes `zh-CN` for `Intl.DisplayNames`, Collator and validation text.
- `participants.locale` supports canonical BCP 47 values, so UI-supported locale and participant preference must not be conflated.
- System Guide contains React prose plus committed iframe HTML/PNG artifacts with language-bearing labels.

## Next.js 16 Constraints

Local package documentation: `node_modules/next/dist/docs/01-app/02-guides/internationalization.md` and `node_modules/next/dist/docs/01-app/03-api-reference/04-functions/cookies.md`.

- Next recommends locale-aware routing but localization itself can use server-loaded dictionaries.
- `cookies()` is async and makes the route request-time dynamic.
- Writing cookies must happen in a Route Handler or Server Function.
- The existing apps already depend heavily on request-time auth/data, so cookie locale resolution does not introduce a new static-rendering promise.

## Chosen Boundary

Stable URLs plus host-only locale cookie are preferred over moving every route under `[lang]`. This avoids breaking signed invitations, QR/session links, uploads and existing E2E selectors while still giving explicit language switching and correct `html lang`.
