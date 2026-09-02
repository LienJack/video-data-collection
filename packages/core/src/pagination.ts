import { z } from "zod";

export const pageNumberSchema = z.coerce.number().int().positive().default(1).catch(1);

export function pageSizeSchema(defaultPageSize: number, maxPageSize = 100) {
  return z.coerce.number().int().min(1).max(maxPageSize).default(defaultPageSize);
}

export type PageInput = {
  page: number;
  pageSize: number;
};

export type PageMetadata = PageInput & {
  totalItems: number;
  totalPages: number;
};

export type PageResult<T> = PageMetadata & {
  items: T[];
};

export function resolvePage(totalItems: number, requestedPage: number, pageSize: number) {
  if (!Number.isSafeInteger(pageSize) || pageSize < 1) {
    throw new RangeError("pageSize must be a positive safe integer");
  }

  const normalizedTotalItems = Number.isSafeInteger(totalItems) && totalItems > 0 ? totalItems : 0;
  const totalPages = Math.max(1, Math.ceil(normalizedTotalItems / pageSize));
  const normalizedRequestedPage = Number.isSafeInteger(requestedPage) && requestedPage > 0
    ? requestedPage
    : 1;
  const page = Math.min(normalizedRequestedPage, totalPages);

  return {
    page,
    pageSize,
    totalItems: normalizedTotalItems,
    totalPages,
    offset: (page - 1) * pageSize,
  };
}

export function createPageResult<T>(
  items: T[],
  page: ReturnType<typeof resolvePage>,
): PageResult<T> {
  return {
    items,
    page: page.page,
    pageSize: page.pageSize,
    totalItems: page.totalItems,
    totalPages: page.totalPages,
  };
}
