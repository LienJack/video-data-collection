import { pageNumberSchema } from "@egocapture/core/pagination";

export type PaginationQuery = Record<string, string | number | boolean | null | undefined>;
export const TABLE_PAGE_SIZES = [10, 20, 50] as const;

export function parsePageParam(value: string | string[] | undefined) {
  return pageNumberSchema.parse(typeof value === "string" ? value : undefined);
}

export function parsePageSizeParam(value: string | string[] | undefined, fallback: 20 | 50 = 20) {
  if (typeof value !== "string") return fallback;
  const pageSize = Number(value);
  return TABLE_PAGE_SIZES.some((option) => option === pageSize) ? pageSize : fallback;
}

export function filterQueryEntries(query: PaginationQuery) {
  return Object.entries(query)
    .filter(([key, value]) => key !== "page" && key !== "pageSize" && value !== undefined && value !== null && value !== "")
    .map(([key, value]): [string, string] => [key, String(value)]);
}

export function paginationQueryEntries(query: PaginationQuery) {
  return Object.entries(query)
    .filter(([key, value]) => key !== "page" && value !== undefined && value !== null && value !== "")
    .map(([key, value]): [string, string] => [key, String(value)]);
}

export function buildPageHref(pathname: string, query: PaginationQuery, page: number) {
  const params = new URLSearchParams(paginationQueryEntries(query));
  if (page > 1) params.set("page", String(page));
  const search = params.toString();
  return search ? `${pathname}?${search}` : pathname;
}
