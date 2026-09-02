# Internationalization Contract

## Scenario: Shared Admin and Participant localization

### 1. Scope / Trigger

Use this contract whenever user-visible copy, locale selection, page metadata, status/error presentation, dates, numbers, regions, languages, or System Guide content changes. The supported UI locales are exactly `zh-CN`, `en`, and `ja`; persistent business state keys and user-authored content remain untranslated.

### 2. Signatures

The shared core surface is:

```ts
type UiLocale = "zh-CN" | "en" | "ja";

resolveUiLocale(input: {
  cookie?: string | null;
  profile?: string | null;
  acceptLanguage?: string | null;
}): UiLocale;

createTranslator(locale): {
  t(key, values?): string;
  plural(key, count, values?): string;
  state(machineId, value): string;
  action(machineId, event): string;
  label(group, value): string;
  error(code, values?): string;
  date(value, options?): string;
  number(value, options?): string;
  relativeTime(value, unit): string;
  bytes(value): string;
};

requestLocale(profileLocale?): Promise<UiLocale>;
POST /api/locale { locale: UiLocale };
```

### 3. Contracts

- Resolution order is valid explicit `egocapture-locale` cookie, mapped Participant profile locale, weighted `Accept-Language`, then `zh-CN`.
- An invalid cookie is ignored; it must not block a valid profile or request-header locale.
- Locale mapping normalizes `zh-*` to `zh-CN`, `en-*` to `en`, and `ja-*` to `ja`. Unsupported values fall back to Chinese.
- The locale route accepts only the three supported keys, rejects untrusted origins, returns `cache-control: no-store`, and writes a host-only, HttpOnly, SameSite=Lax, one-year cookie. `Secure` is enabled on HTTPS.
- Root layouts resolve locale asynchronously with Next.js `cookies()`/`headers()`, set `<html lang>`, create localized metadata, and provide the matching catalog to Client Components.
- Catalogs share one nested key structure and placeholder contract. Missing messages throw during development/tests instead of silently mixing languages.
- `state.<machine>.<state>`, `stateAction.<machine>.<event>`, stable error codes, and label groups are presentation mappings only. Database values, public IDs, object keys, audit payload keys, and ISO evidence remain unchanged.
- Dates, numbers, relative time, byte counts, region names, and language names use `Intl` through the shared translator. Invalid historical region/language values remain visible as raw values rather than crashing a page.
- Administrator instructions and participant free text are never machine-translated.
- System Guide runtime content and its four iframe diagrams each have real `zh-CN`, `en`, and `ja` variants. Stable URLs outside the locale-specific asset directory do not change.

### 4. Validation & Error Matrix

| Condition | Required result |
|---|---|
| Locale route origin is not trusted | `403 ORIGIN_REJECTED` |
| Body is malformed or locale unsupported | `422 VALIDATION_FAILED` |
| Valid locale is selected | Return `{ data: { locale }, requestId }`, set cookie, then client refreshes the same URL |
| Catalog key or placeholder differs across locales | `pnpm i18n:check` or unit test fails |
| Known Domain/API error code is rendered | Use the selected catalog's localized error |
| Unknown error code is rendered | Use localized `UNKNOWN`; do not display a raw exception |
| State/label mapping is unknown | Preserve a safe readable/raw value; do not mutate persistence |
| Historical region/language code is invalid | Display the original value; do not throw `RangeError` |
| User-facing hardcoded copy is added to app code | AST/source scan fails unless it is a narrowly documented protocol/product identifier |

### 5. Good / Base / Bad Cases

- Good: `en-US` profile locale resolves to UI locale `en`, while the original profile value remains available for business formatting where needed.
- Base: no preference signals resolves to `zh-CN` and keeps the current pathname and query parameters.
- Bad: translating `assignment.status = "needs_review"` before saving it to PostgreSQL.
- Good: render `translator.state("assignment.status", assignment.status)` at the UI boundary.
- Bad: catch an upload exception and render `error.message` directly to the participant.
- Good: map a stable error code through `translator.error(code)` with a localized unknown fallback.

### 6. Tests Required

- Unit: locale mapping, weighted `Accept-Language`, invalid-cookie fallback, catalog key parity, placeholder parity, interpolation, pluralization, state/action/error/label mapping, and invalid `Intl.DisplayNames` input.
- Static: `pnpm i18n:check` scans both applications for user-facing literals and validates all twelve localized System Guide HTML assets for language, title, and distinct content.
- Component: language switcher, regional preference fields, forms, upload queue errors, and Participants table/drawer in all three locales.
- Build: both Next.js applications must complete production builds with localized root layouts and metadata.
- E2E: explicit locale selection persists through refresh/navigation; first request respects `Accept-Language`; `<html lang>` and page copy agree; current query parameters survive switching.
- E2E: Admin-to-Participant main flow and all System Guide routes pass in the NAS development topology.

### 7. Wrong vs Correct

#### Wrong

```tsx
<span>{assignment.status}</span>
<button onClick={save}>保存</button>
```

This leaks a persistence key and embeds one language in a component.

#### Correct

```tsx
const i18n = useI18n();

<span>{i18n.state("assignment.status", assignment.status)}</span>
<button onClick={save}>{i18n.t("common.save")}</button>
```

The component consumes the shared contract while the database value remains stable.
