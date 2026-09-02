import { describe, expect, it } from "vitest";
import { createPageResult, pageNumberSchema, resolvePage } from "@egocapture/core/pagination";
import {
  buildPageHref,
  paginationQueryEntries,
  parsePageParam,
} from "../../apps/admin-web/lib/pagination";

describe("page-number pagination", () => {
  it("reports one stable page for empty results", () => {
    expect(resolvePage(0, 7, 25)).toEqual({
      page: 1,
      pageSize: 25,
      totalItems: 0,
      totalPages: 1,
      offset: 0,
    });
  });

  it("handles partial final pages and clamps requests past the end", () => {
    expect(resolvePage(51, 99, 25)).toEqual({
      page: 3,
      pageSize: 25,
      totalItems: 51,
      totalPages: 3,
      offset: 50,
    });
  });

  it("keeps exact final pages distinct from partial final pages", () => {
    expect(resolvePage(50, 2, 25)).toMatchObject({
      page: 2,
      totalItems: 50,
      totalPages: 2,
      offset: 25,
    });
    expect(resolvePage(51, 2, 25)).toMatchObject({
      page: 2,
      totalItems: 51,
      totalPages: 3,
      offset: 25,
    });
  });

  it("normalizes invalid page values without accepting arrays", () => {
    expect(pageNumberSchema.parse("3")).toBe(3);
    expect(parsePageParam("0")).toBe(1);
    expect(parsePageParam("1.5")).toBe(1);
    expect(parsePageParam("not-a-page")).toBe(1);
    expect(parsePageParam(["2", "3"])).toBe(1);
  });

  it("builds page results without leaking the internal offset", () => {
    expect(createPageResult(["last"], resolvePage(26, 2, 25))).toEqual({
      items: ["last"],
      page: 2,
      pageSize: 25,
      totalItems: 26,
      totalPages: 2,
    });
  });

  it("preserves filters while replacing page state", () => {
    const query = { tab: "videos", search: "PT-23456789", attention: "open", page: 9, pageSize: 50 };
    expect(buildPageHref("/records", query, 2)).toBe("/records?tab=videos&search=PT-23456789&attention=open&page=2");
    expect(buildPageHref("/records", query, 1)).toBe("/records?tab=videos&search=PT-23456789&attention=open");
    expect(paginationQueryEntries(query)).toEqual([
      ["tab", "videos"],
      ["search", "PT-23456789"],
      ["attention", "open"],
    ]);
  });

  it("drops pagination-only state when returning to the first page", () => {
    expect(buildPageHref("/participants", { page: 7, pageSize: 25 }, 1)).toBe("/participants");
    expect(paginationQueryEntries({ page: 7, pageSize: 25, search: "", missing: false })).toEqual([
      ["missing", "false"],
    ]);
  });
});
