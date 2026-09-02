import type { PageMetadata } from "@egocapture/core/pagination";
import { Button, buttonVariants } from "@egocapture/ui/components/button";
import { Input } from "@egocapture/ui/components/input";
import { NativeSelect, NativeSelectOption } from "@egocapture/ui/components/native-select";
import { ArrowLeft, ArrowRight } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";
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
  const { page, pageSize, totalItems, totalPages } = pagination;
  const pageQuery = { ...query, pageSize };
  const controlId = pathname.replaceAll("/", "-") || "root";

  return (
    <nav className="flex flex-wrap items-center justify-between gap-3" aria-label="表格分页">
      <p className="text-sm text-[var(--muted)]" aria-live="polite">
        共 <strong className="font-semibold text-[var(--ink)] tabular-nums">{totalItems}</strong> 条 · 第 {page} / {totalPages} 页
      </p>
      <div className="flex flex-wrap items-center justify-end gap-2">
        <form action={pathname} method="get" className="flex items-center gap-2" aria-label="调整每页行数">
          {filterQueryEntries(query).map(([name, value]) => <input key={name} type="hidden" name={name} value={value} />)}
          <label htmlFor={`page-size-${controlId}`} className="text-sm text-[var(--muted)]">每页</label>
          <NativeSelect
            id={`page-size-${controlId}`}
            name="pageSize"
            size="sm"
            defaultValue={String(pageSize)}
            aria-label="每页行数"
            className="w-24"
          >
            {TABLE_PAGE_SIZES.map((option) => <NativeSelectOption key={option} value={option}>{option} 行</NativeSelectOption>)}
          </NativeSelect>
          <Button type="submit" variant="secondary" size="sm">应用</Button>
        </form>
        {totalPages > 1 ? (
          <>
          {page > 1 ? (
            <Link href={buildPageHref(pathname, pageQuery, page - 1)} className={buttonVariants({ variant: "outline", size: "sm" })}>
              <ArrowLeft aria-hidden="true" />上一页
            </Link>
          ) : (
            <span className={disabledLinkClass} aria-disabled="true"><ArrowLeft aria-hidden="true" />上一页</span>
          )}
          <form action={pathname} method="get" className="flex items-center gap-2">
            {paginationQueryEntries(pageQuery).map(([name, value]) => <input key={name} type="hidden" name={name} value={value} />)}
            <label htmlFor={`page-${controlId}`} className="sr-only">前往页码</label>
            <Input
              id={`page-${controlId}`}
              name="page"
              type="number"
              inputMode="numeric"
              min={1}
              max={totalPages}
              defaultValue={page}
              className="min-h-9 w-20 py-1.5 text-center tabular-nums"
              aria-label={`前往页码，范围 1 到 ${totalPages}`}
            />
            <Button type="submit" variant="secondary" size="sm">跳转</Button>
          </form>
          {page < totalPages ? (
            <Link href={buildPageHref(pathname, pageQuery, page + 1)} className={buttonVariants({ variant: "outline", size: "sm" })}>
              下一页<ArrowRight aria-hidden="true" />
            </Link>
          ) : (
            <span className={disabledLinkClass} aria-disabled="true">下一页<ArrowRight aria-hidden="true" /></span>
          )}
          </>
        ) : null}
      </div>
    </nav>
  );
}
