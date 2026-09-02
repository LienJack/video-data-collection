import type { PageMetadata } from "@egocapture/core/pagination";
import { Button, buttonVariants } from "@egocapture/ui/components/button";
import { Input } from "@egocapture/ui/components/input";
import { ArrowLeft, ArrowRight } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";
import {
  buildPageHref,
  paginationQueryEntries,
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
  const { page, totalItems, totalPages } = pagination;

  return (
    <nav className="flex flex-wrap items-center justify-between gap-3" aria-label="表格分页">
      <p className="text-sm text-[var(--muted)]" aria-live="polite">
        共 <strong className="font-semibold text-[var(--ink)] tabular-nums">{totalItems}</strong> 条 · 第 {page} / {totalPages} 页
      </p>
      {totalPages > 1 ? (
        <div className="flex flex-wrap items-center gap-2">
          {page > 1 ? (
            <Link href={buildPageHref(pathname, query, page - 1)} className={buttonVariants({ variant: "outline", size: "sm" })}>
              <ArrowLeft aria-hidden="true" />上一页
            </Link>
          ) : (
            <span className={disabledLinkClass} aria-disabled="true"><ArrowLeft aria-hidden="true" />上一页</span>
          )}
          <form action={pathname} method="get" className="flex items-center gap-2">
            {paginationQueryEntries(query).map(([name, value]) => <input key={name} type="hidden" name={name} value={value} />)}
            <label htmlFor={`page-${pathname.replaceAll("/", "-") || "root"}`} className="sr-only">前往页码</label>
            <Input
              id={`page-${pathname.replaceAll("/", "-") || "root"}`}
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
            <Link href={buildPageHref(pathname, query, page + 1)} className={buttonVariants({ variant: "outline", size: "sm" })}>
              下一页<ArrowRight aria-hidden="true" />
            </Link>
          ) : (
            <span className={disabledLinkClass} aria-disabled="true">下一页<ArrowRight aria-hidden="true" /></span>
          )}
        </div>
      ) : null}
    </nav>
  );
}
