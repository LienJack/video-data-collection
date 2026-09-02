# Admin Table Pagination Contract

## 1. Scope / Trigger

Use this contract when an admin list supports previous, next, or direct page navigation. It covers the shared core page result, service queries, admin URL state, semantic table pagination, and regression tests.

## 2. Signatures

```ts
type PageInput = { page: number; pageSize: number };

type PageResult<T> = PageInput & {
  items: T[];
  totalItems: number;
  totalPages: number;
};

resolvePage(totalItems: number, requestedPage: number, pageSize: number): {
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
  offset: number;
};

buildPageHref(pathname: string, query: PaginationQuery, page: number): string;
```

List endpoints and services accept `page` and `pageSize` plus their existing filters. They return `PageResult<T>` rather than cursor metadata.

## 3. Contracts

- `page` is a positive integer. Missing, array-valued, fractional, negative, or non-numeric URL input resolves to page 1.
- `pageSize` is a positive bounded integer. Admin defaults are 25 for participants, tasks, and assignments, and 50 for review, videos, sessions, and activity.
- Empty results return `items: []`, `page: 1`, `totalItems: 0`, and `totalPages: 1`.
- A requested page above `totalPages` resolves to the final page before calculating `OFFSET`.
- The count query and items query must use the same filter fragment. Count values must be returned as numbers, for example `count(*)::integer`.
- Ordering must include a unique tie-breaker: `public_id` for business records or `id` for audit events.
- Pagination URLs preserve active filters and the records `tab`, but never preserve stale `page` or client-controlled `pageSize`. Page 1 is represented without a `page` parameter.
- Filter forms omit `page`, so changing a filter restarts at page 1.
- The shared `TablePagination` renders total count, current/total pages, previous/next states, and a bounded direct-page form. Lists use the shared semantic `Table` and retain their existing actions and links.

## 4. Validation & Error Matrix

| Input or state | Required result |
|---|---|
| Missing or invalid `page` | Normalize to page 1 |
| `page < 1` or fractional page | Normalize to page 1 |
| `page > totalPages` | Normalize to the final page |
| Empty filtered result | Stable page 1 of 1 with zero items |
| Invalid `pageSize` | Reject through the service schema; `resolvePage` throws for a non-positive unsafe size |
| Count/items filters differ | Treat as a correctness defect; share one SQL filter fragment |
| Sort column can tie | Add the unique business ID or primary key as the final sort key |

## 5. Good / Base / Bad Cases

- Good: 27 filtered participants at page size 25 return 25 rows on page 1 and 2 rows on page 2; browser back and forward restore the corresponding URL and rows.
- Base: one page of results shows the count and page state without active previous/next links.
- Bad: a page builds `?page=2` manually and drops `search` or `tab`; the refreshed view no longer represents the user's filtered dataset.
- Bad: count omits a join or filter used by items; the UI advertises pages that cannot return rows.

## 6. Tests Required

- Unit: invalid, empty, exact-division, non-exact-division, and out-of-range `resolvePage` cases.
- Unit: URL helpers preserve filters/tab, remove `page` and `pageSize`, and omit page 1.
- Component: first/last page disabled states, direct-page bounds, hidden filter inputs, and zero-result rendering.
- Integration or E2E: create a uniquely marked dataset larger than one page; assert total count, row count, stable ordering, direct navigation, previous/next, browser back/forward, filter reset, out-of-range normalization, and zero test residue.
- Regression: existing task, assignment, review, session, audit, and detail actions must remain reachable after table migration.

## 7. Wrong vs Correct

### Wrong

```ts
const totalItems = await countAllRows();
const items = await listFilteredRows({ cursor, limit: 25 });
```

The total does not describe the filtered rows, and cursor history cannot support an arbitrary page number.

### Correct

```ts
const filter = buildSharedFilter(input);
const totalItems = await countRows(filter);
const pagination = resolvePage(totalItems, input.page, input.pageSize);
const items = await listRows(filter, pagination.pageSize, pagination.offset);
return createPageResult(items, pagination);
```

The count and page rows share the same authority, and every URL page has deterministic metadata.
