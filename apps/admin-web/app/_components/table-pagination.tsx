"use client";

import type { PageMetadata } from "@egocapture/core/pagination";
import { Button, buttonVariants } from "@egocapture/ui/components/button";
import { Input } from "@egocapture/ui/components/input";
import { NativeSelect, NativeSelectOption } from "@egocapture/ui/components/native-select";
import { ArrowLeft, ArrowRight } from "@phosphor-icons/react";
import Link from "next/link";
import { useI18n } from "@egocapture/ui/lib/i18n";
import {
  buildPageHref,
  filterQueryEntries,
  paginationQueryEntries,
  TABLE_PAGE_SIZES,
  type PaginationQuery,
} from "../../lib/pagination";

type TablePaginationProps = {
  pathname: string;
  query: PaginationQuery;
  pagination: PageMetadata;
};

const disabledLinkClass = buttonVariants({
  variant: "outline",
  size: "sm",
  className: "pointer-events-none opacity-50",
});

export function TablePagination({ pathname, query, pagination }: TablePaginationProps) {
  const i18n = useI18n();
  const { page, pageSize, totalItems, totalPages } = pagination;
  const pageQuery = { ...query, pageSize };
  const controlId = pathname.replaceAll("/", "-") || "root";

  return (
    <nav className="flex flex-wrap items-center justify-between gap-3" aria-label={i18n.t("adminUi.tablePagination")}>
      <p className="text-sm text-[var(--muted)]" aria-live="polite">
        {i18n.t("adminUi.totalRows", { count: i18n.number(totalItems), page: i18n.number(page), pages: i18n.number(totalPages) })}
      </p>
      <div className="flex flex-wrap items-center justify-end gap-2">
        <form action={pathname} method="get" className="flex items-center gap-2" aria-label={i18n.t("adminUi.rowsPerPageAria")}>
          {filterQueryEntries(query).map(([name, value]) => <input key={name} type="hidden" name={name} value={value} />)}
          <label htmlFor={`page-size-${controlId}`} className="text-sm text-[var(--muted)]">{i18n.t("adminUi.rowsPerPage")}</label>
          <NativeSelect
            id={`page-size-${controlId}`}
            name="pageSize"
            size="sm"
            defaultValue={String(pageSize)}
            aria-label={i18n.t("adminUi.rowsPerPageAria")}
            className="w-24"
          >
            {TABLE_PAGE_SIZES.map((option) => <NativeSelectOption key={option} value={option}>{i18n.t("adminUi.rows", { count: i18n.number(option) })}</NativeSelectOption>)}
          </NativeSelect>
          <Button type="submit" variant="secondary" size="sm">{i18n.t("adminUi.apply")}</Button>
        </form>
        {totalPages > 1 ? (
          <>
          {page > 1 ? (
            <Link href={buildPageHref(pathname, pageQuery, page - 1)} className={buttonVariants({ variant: "outline", size: "sm" })}>
              <ArrowLeft aria-hidden="true" />{i18n.t("adminUi.previousPage")}
            </Link>
          ) : (
            <span className={disabledLinkClass} aria-disabled="true"><ArrowLeft aria-hidden="true" />{i18n.t("adminUi.previousPage")}</span>
          )}
          <form action={pathname} method="get" className="flex items-center gap-2">
            {paginationQueryEntries(pageQuery).map(([name, value]) => <input key={name} type="hidden" name={name} value={value} />)}
            <label htmlFor={`page-${controlId}`} className="sr-only">{i18n.t("adminUi.goToPage")}</label>
            <Input
              id={`page-${controlId}`}
              name="page"
              type="number"
              inputMode="numeric"
              min={1}
              max={totalPages}
              defaultValue={page}
              className="min-h-9 w-20 py-1.5 text-center tabular-nums"
              aria-label={i18n.t("adminUi.goToPageRange", { pages: totalPages })}
            />
            <Button type="submit" variant="secondary" size="sm">{i18n.t("adminUi.jump")}</Button>
          </form>
          {page < totalPages ? (
            <Link href={buildPageHref(pathname, pageQuery, page + 1)} className={buttonVariants({ variant: "outline", size: "sm" })}>
              {i18n.t("adminUi.nextPage")}<ArrowRight aria-hidden="true" />
            </Link>
          ) : (
            <span className={disabledLinkClass} aria-disabled="true">{i18n.t("adminUi.nextPage")}<ArrowRight aria-hidden="true" /></span>
          )}
          </>
        ) : null}
      </div>
    </nav>
  );
}
