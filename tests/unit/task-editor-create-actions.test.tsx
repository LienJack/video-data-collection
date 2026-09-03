import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { defaultTaskInstructions } from "@egocapture/core/domain/task-template";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TaskEditor } from "../../apps/admin-web/app/(console)/tasks/task-editor";

const { push, refresh } = vi.hoisted(() => ({
  push: vi.fn(),
  refresh: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, refresh }),
}));

function response<T>(body: T, options: { ok?: boolean; status?: number } = {}) {
  return Promise.resolve({
    ok: options.ok ?? true,
    status: options.status ?? 200,
    json: async () => body,
  } as Response);
}

describe("task editor create actions", () => {
  const fetchMock = vi.fn();
  const instructions = {
    ...structuredClone(defaultTaskInstructions),
    title: "测试发布方案",
    description: "验证新建任务可以直接发布首个版本。",
  };

  beforeEach(() => {
    push.mockReset();
    refresh.mockReset();
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
    vi.stubGlobal("ResizeObserver", class {
      observe() {}
      unobserve() {}
      disconnect() {}
    });
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("keeps 创建草稿 as a create-only action", async () => {
    fetchMock.mockReturnValueOnce(response({ data: { taskPublicId: "TSK-12345678", updatedAt: "2026-09-03T02:00:00.000Z" } }, { status: 201 }));

    render(<TaskEditor mode="create" initialInstructions={instructions} />);
    fireEvent.click(screen.getByRole("button", { name: "创建草稿" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledOnce());
    expect(fetchMock.mock.calls[0]?.[0]).toBe("/api/admin/tasks");
    expect(push).toHaveBeenCalledWith("/tasks/TSK-12345678");
  });

  it("creates the task and publishes its first immutable version from 发布方案", async () => {
    fetchMock
      .mockReturnValueOnce(response({ data: { taskPublicId: "TSK-23456789", updatedAt: "2026-09-03T02:00:00.000Z" } }, { status: 201 }))
      .mockReturnValueOnce(response({ data: { version: 1, contentHash: "a".repeat(64), updatedAt: "2026-09-03T02:00:01.000Z" } }, { status: 201 }));

    render(<TaskEditor mode="create" initialInstructions={instructions} />);
    expect(screen.getByRole("button", { name: "创建草稿" })).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "发布方案" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    expect(fetchMock.mock.calls[0]?.[0]).toBe("/api/admin/tasks");
    expect(fetchMock.mock.calls[0]?.[1]).toMatchObject({ method: "POST" });
    expect(fetchMock.mock.calls[1]?.[0]).toBe("/api/admin/tasks/TSK-23456789/publish");
    expect(fetchMock.mock.calls[1]?.[1]).toMatchObject({ method: "POST" });
    expect(push).toHaveBeenCalledWith("/tasks/TSK-23456789");
  });

  it("opens the saved draft with a retry notice when first-version publication fails", async () => {
    fetchMock
      .mockReturnValueOnce(response({ data: { taskPublicId: "TSK-34567890", updatedAt: "2026-09-03T02:00:00.000Z" } }, { status: 201 }))
      .mockReturnValueOnce(response({ error: { code: "INTERNAL_ERROR" } }, { ok: false, status: 503 }));

    render(<TaskEditor mode="create" initialInstructions={instructions} />);
    fireEvent.click(screen.getByRole("button", { name: "发布方案" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    expect(push).toHaveBeenCalledWith("/tasks/TSK-34567890?tab=instructions&publish=failed");
  });
});
