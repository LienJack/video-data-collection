import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { TablePagination } from "../../apps/admin-web/app/_components/table-pagination";

afterEach(cleanup);

describe("TablePagination", () => {
  it("links to adjacent pages while preserving filters", () => {
    render(<TablePagination
      pathname="/records"
      query={{ tab: "videos", search: "needle", page: 2, pageSize: 25 }}
      pagination={{ page: 2, pageSize: 25, totalItems: 51, totalPages: 3 }}
    />);

    expect(screen.getByRole("link", { name: "上一页" })).toHaveAttribute("href", "/records?tab=videos&search=needle");
    expect(screen.getByRole("link", { name: "下一页" })).toHaveAttribute("href", "/records?tab=videos&search=needle&page=3");
    const pageInput = screen.getByRole("spinbutton", { name: "前往页码，范围 1 到 3" });
    expect(pageInput).toHaveValue(2);
    const jumpForm = pageInput.closest("form");
    expect(jumpForm).toHaveAttribute("action", "/records");
    expect(jumpForm?.querySelector('input[type="hidden"][name="tab"]')).toHaveValue("videos");
    expect(jumpForm?.querySelector('input[type="hidden"][name="search"]')).toHaveValue("needle");
    expect(jumpForm?.querySelector('input[type="hidden"][name="page"]')).toBeNull();
    expect(jumpForm?.querySelector('input[type="hidden"][name="pageSize"]')).toBeNull();
    expect(screen.getByText(/共/).closest("nav")).toHaveTextContent("共 51 条 · 第 2 / 3 页");
  });

  it("disables the previous control on the first page", () => {
    render(<TablePagination
      pathname="/tasks"
      query={{ lifecycle: "active", page: 1 }}
      pagination={{ page: 1, pageSize: 25, totalItems: 26, totalPages: 2 }}
    />);

    expect(screen.queryByRole("link", { name: "上一页" })).not.toBeInTheDocument();
    expect(screen.getByText("上一页").closest("span")).toHaveAttribute("aria-disabled", "true");
    expect(screen.getByRole("link", { name: "下一页" })).toHaveAttribute("href", "/tasks?lifecycle=active&page=2");
  });

  it("disables the outward control on the final page", () => {
    render(<TablePagination
      pathname="/participants"
      query={{ status: "active" }}
      pagination={{ page: 2, pageSize: 25, totalItems: 26, totalPages: 2 }}
    />);

    expect(screen.queryByRole("link", { name: "下一页" })).not.toBeInTheDocument();
    expect(screen.getByText("下一页").closest("span")).toHaveAttribute("aria-disabled", "true");
  });

  it("keeps an empty result on one stable page without redundant controls", () => {
    render(<TablePagination
      pathname="/review"
      query={{ status: "open", page: 99 }}
      pagination={{ page: 1, pageSize: 50, totalItems: 0, totalPages: 1 }}
    />);

    const navigation = screen.getByRole("navigation", { name: "表格分页" });
    expect(navigation).toHaveTextContent("共 0 条 · 第 1 / 1 页");
    expect(screen.queryByRole("spinbutton")).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /页/ })).not.toBeInTheDocument();
  });
});
