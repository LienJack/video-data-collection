import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ParticipantRowActions } from "../../apps/admin-web/app/(console)/participants/participant-row-actions";

const { refresh } = vi.hoisted(() => ({ refresh: vi.fn() }));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh }),
}));

const participantDetail = {
  publicId: "PT-23456789",
  displayAlias: "演示参与者",
  managementEmail: "manager@example.com",
  status: "active",
  consentStatus: "valid",
  locale: "zh-CN",
  timezone: "Asia/Shanghai",
  countryRegion: "CN",
  notes: "仅用于测试",
  isFixture: false,
  defaultDevicePublicId: "DEV-23456789",
  updatedAt: "2026-09-02T02:00:00.000Z",
  loginCredential: {
    username: "PT-23456789",
    password: "Abc23456789TestX",
    loginUrl: "http://localhost:3000/login",
    version: 1,
    status: "ready" as const,
    canLogin: true,
    updatedAt: "2026-09-02T01:00:00.000Z",
    syncedAt: "2026-09-02T01:00:01.000Z",
  },
};

function response<T>(body: T, options: { ok?: boolean; status?: number } = {}) {
  return Promise.resolve({
    ok: options.ok ?? true,
    status: options.status ?? 200,
    json: async () => body,
  } as Response);
}

describe("participant view and edit drawer", () => {
  const fetchMock = vi.fn();
  const writeText = vi.fn();

  beforeEach(() => {
    refresh.mockReset();
    fetchMock.mockReset();
    writeText.mockReset();
    vi.stubGlobal("fetch", fetchMock);
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    });
    Object.defineProperty(HTMLDialogElement.prototype, "showModal", {
      configurable: true,
      value(this: HTMLDialogElement) { this.setAttribute("open", ""); },
    });
    Object.defineProperty(HTMLDialogElement.prototype, "close", {
      configurable: true,
      value(this: HTMLDialogElement) { this.removeAttribute("open"); },
    });
    document.body.style.overflow = "auto";
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    Reflect.deleteProperty(document, "execCommand");
    document.body.style.overflow = "";
  });

  it("loads credentials only after opening, copies them, and clears them on close", async () => {
    fetchMock.mockReturnValueOnce(response({ data: participantDetail }));
    writeText.mockResolvedValue(undefined);
    render(<ParticipantRowActions participantPublicId={participantDetail.publicId} fixtureProtected={false} />);

    expect(fetchMock).not.toHaveBeenCalled();
    const viewButton = screen.getByRole("button", { name: `查看 ${participantDetail.publicId}` });
    fireEvent.click(viewButton);

    expect(document.body.style.overflow).toBe("hidden");
    expect(await screen.findByText(participantDetail.loginCredential.password)).toBeVisible();
    expect(screen.getByText("当前凭据可以直接登录。")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: /复制完整登录信息/ }));

    await waitFor(() => expect(writeText).toHaveBeenCalledWith(
      `登录地址：${participantDetail.loginCredential.loginUrl}\n帐号：${participantDetail.publicId}\n密码：${participantDetail.loginCredential.password}`,
    ));
    expect(screen.getByText("参与者登录信息已复制。")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "关闭参与者侧边栏" }));
    await waitFor(() => expect(viewButton).toHaveFocus());
    expect(screen.queryByText(participantDetail.loginCredential.password)).not.toBeInTheDocument();
    expect(document.body.style.overflow).toBe("auto");
  });

  it("falls back to a temporary textarea when the Clipboard API rejects", async () => {
    const execCommand = vi.fn(() => true);
    fetchMock.mockReturnValueOnce(response({ data: participantDetail }));
    writeText.mockRejectedValueOnce(new DOMException("blocked", "NotAllowedError"));
    Object.defineProperty(document, "execCommand", {
      configurable: true,
      value: execCommand,
    });
    render(<ParticipantRowActions participantPublicId={participantDetail.publicId} fixtureProtected={false} />);

    fireEvent.click(screen.getByRole("button", { name: `查看 ${participantDetail.publicId}` }));
    fireEvent.click(await screen.findByRole("button", { name: "复制密码" }));

    await waitFor(() => expect(execCommand).toHaveBeenCalledWith("copy"));
    expect(screen.getByText("密码已复制。")).toBeVisible();
    expect(document.querySelector("body > textarea")).toBeNull();
  });

  it("shows a visible alert while leaving the password selectable when copying fails", async () => {
    fetchMock.mockReturnValueOnce(response({ data: participantDetail }));
    writeText.mockRejectedValueOnce(new DOMException("blocked", "NotAllowedError"));
    Object.defineProperty(document, "execCommand", {
      configurable: true,
      value: vi.fn(() => false),
    });
    render(<ParticipantRowActions participantPublicId={participantDetail.publicId} fixtureProtected={false} />);

    fireEvent.click(screen.getByRole("button", { name: `查看 ${participantDetail.publicId}` }));
    fireEvent.click(await screen.findByRole("button", { name: "复制密码" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("复制失败，请选中文本后手动复制。");
    expect(screen.getByText(participantDetail.loginCredential.password)).toHaveClass("select-all");
  });

  it("keeps a GET failure in the drawer and retries the detail request", async () => {
    fetchMock
      .mockReturnValueOnce(response({ error: { code: "INTERNAL_ERROR", message: "详情暂时不可用" } }, { ok: false, status: 503 }))
      .mockReturnValueOnce(response({ data: participantDetail }));
    render(<ParticipantRowActions participantPublicId={participantDetail.publicId} fixtureProtected={false} />);

    fireEvent.click(screen.getByRole("button", { name: `查看 ${participantDetail.publicId}` }));
    expect(await screen.findByText("服务暂时无法处理请求。")).toBeVisible();
    expect(screen.getByRole("dialog", { name: "查看参与者" })).toBeVisible();

    fireEvent.click(screen.getByRole("button", { name: "重新加载" }));
    expect(await screen.findByText(participantDetail.loginCredential.password)).toBeVisible();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("submits only the approved profile fields and refreshes the current route", async () => {
    fetchMock
      .mockReturnValueOnce(response({ data: participantDetail }))
      .mockReturnValueOnce(response({ data: { ...participantDetail, displayAlias: "更新后" } }));
    render(<ParticipantRowActions participantPublicId={participantDetail.publicId} fixtureProtected={false} />);

    fireEvent.click(screen.getByRole("button", { name: `编辑 ${participantDetail.publicId}` }));
    const alias = await screen.findByRole("textbox", { name: /显示别名/ });
    expect(alias).toHaveFocus();
    fireEvent.change(alias, { target: { value: "更新后" } });
    fireEvent.change(screen.getByRole("textbox", { name: /管理邮箱/ }), { target: { value: "new@example.com" } });
    fireEvent.change(screen.getByRole("textbox", { name: /备注/ }), { target: { value: "更新备注" } });
    fireEvent.click(screen.getByRole("button", { name: "保存修改" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    const [, request] = fetchMock.mock.calls[1] as [string, RequestInit];
    expect(request.method).toBe("PATCH");
    expect(JSON.parse(String(request.body))).toEqual({
      displayAlias: "更新后",
      managementEmail: "new@example.com",
      countryRegion: "CN",
      locale: "zh-CN",
      timezone: "Asia/Shanghai",
      notes: "更新备注",
      expectedUpdatedAt: participantDetail.updatedAt,
    });
    await waitFor(() => expect(refresh).toHaveBeenCalledOnce());
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("uses an in-drawer confirmation before generating a missing password", async () => {
    const missingDetail = {
      ...participantDetail,
      status: "draft",
      consentStatus: "pending",
      loginCredential: {
        ...participantDetail.loginCredential,
        password: null,
        version: 0,
        status: "missing" as const,
        canLogin: false,
        updatedAt: null,
        syncedAt: null,
      },
    };
    const generatedCredential = {
      ...missingDetail.loginCredential,
      password: "New23456789PassX",
      version: 1,
      status: "pending_activation" as const,
      updatedAt: "2026-09-02T03:00:00.000Z",
    };
    fetchMock
      .mockReturnValueOnce(response({ data: missingDetail }))
      .mockReturnValueOnce(response({
        data: {
          loginCredential: generatedCredential,
          updatedAt: "2026-09-02T03:00:00.000Z",
        },
      }));
    render(<ParticipantRowActions participantPublicId={participantDetail.publicId} fixtureProtected={false} />);

    fireEvent.click(screen.getByRole("button", { name: `查看 ${participantDetail.publicId}` }));
    fireEvent.click(await screen.findByRole("button", { name: "生成登录密码" }));
    expect(screen.getByText("确定为该参与者生成登录密码吗？")).toBeVisible();
    expect(fetchMock).toHaveBeenCalledOnce();

    fireEvent.click(screen.getByRole("button", { name: "确认" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    const [, request] = fetchMock.mock.calls[1] as [string, RequestInit];
    expect(request.method).toBe("POST");
    expect(new Headers(request.headers).get("idempotency-key")).toMatch(/^[\w-]{8,}$/);
    expect(await screen.findByText(generatedCredential.password)).toBeVisible();
    expect(screen.getByText("等待激活")).toBeVisible();
    expect(screen.getByRole("button", { name: /复制完整登录信息/ })).toBeVisible();
    expect(refresh).toHaveBeenCalledOnce();
  });

  it("keeps protected fixtures readable but disables mutations", async () => {
    fetchMock.mockReturnValueOnce(response({ data: { ...participantDetail, isFixture: true } }));
    render(<ParticipantRowActions participantPublicId={participantDetail.publicId} fixtureProtected />);

    fireEvent.click(screen.getByRole("button", { name: `编辑 ${participantDetail.publicId}` }));
    expect(await screen.findByText("演示数据受保护，公开管理员可以查看，但不能保存修改。")).toBeVisible();
    expect(screen.getByRole("button", { name: "保存修改" })).toBeDisabled();
  });

  it("ignores a late detail response after the drawer closes", async () => {
    let resolveRequest!: (value: Response) => void;
    fetchMock.mockReturnValueOnce(new Promise<Response>((resolve) => { resolveRequest = resolve; }));
    render(<ParticipantRowActions participantPublicId={participantDetail.publicId} fixtureProtected={false} />);

    fireEvent.click(screen.getByRole("button", { name: `查看 ${participantDetail.publicId}` }));
    fireEvent.click(screen.getByRole("button", { name: "关闭参与者侧边栏" }));
    await act(async () => resolveRequest(await response({ data: participantDetail })));

    expect(screen.queryByText(participantDetail.loginCredential.password)).not.toBeInTheDocument();
  });

  it("does not let a late credential reset repopulate or overwrite a reopened drawer", async () => {
    const missingDetail = {
      ...participantDetail,
      loginCredential: {
        ...participantDetail.loginCredential,
        password: null,
        version: 0,
        status: "missing" as const,
        canLogin: false,
        updatedAt: null,
        syncedAt: null,
      },
    };
    const freshDetail = {
      ...participantDetail,
      loginCredential: {
        ...participantDetail.loginCredential,
        password: "Fresh23456789Pass",
        version: 3,
      },
    };
    const lateCredential = {
      ...participantDetail.loginCredential,
      password: "Late23456789PassX",
      version: 2,
    };
    let resolveReset!: (value: Response) => void;
    fetchMock
      .mockReturnValueOnce(response({ data: missingDetail }))
      .mockReturnValueOnce(new Promise<Response>((resolve) => { resolveReset = resolve; }))
      .mockReturnValueOnce(response({ data: freshDetail }));
    render(<ParticipantRowActions participantPublicId={participantDetail.publicId} fixtureProtected={false} />);

    const viewButton = screen.getByRole("button", { name: `查看 ${participantDetail.publicId}` });
    fireEvent.click(viewButton);
    fireEvent.click(await screen.findByRole("button", { name: "生成登录密码" }));
    fireEvent.click(screen.getByRole("button", { name: "确认" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    fireEvent.click(screen.getByRole("button", { name: "关闭参与者侧边栏" }));

    fireEvent.click(viewButton);
    expect(await screen.findByText(freshDetail.loginCredential.password)).toBeVisible();
    await act(async () => resolveReset(await response({
      data: {
        loginCredential: lateCredential,
        updatedAt: "2026-09-02T03:30:00.000Z",
      },
    })));

    expect(screen.getByRole("dialog", { name: "查看参与者" })).toBeVisible();
    expect(screen.getByText(freshDetail.loginCredential.password)).toBeVisible();
    expect(screen.queryByText(lateCredential.password)).not.toBeInTheDocument();
    expect(refresh).not.toHaveBeenCalled();
  });

  it("does not let a late profile save close a reopened drawer", async () => {
    const freshDetail = {
      ...participantDetail,
      displayAlias: "重新打开后的资料",
      updatedAt: "2026-09-02T06:00:00.000Z",
    };
    let resolveSave!: (value: Response) => void;
    fetchMock
      .mockReturnValueOnce(response({ data: participantDetail }))
      .mockReturnValueOnce(new Promise<Response>((resolve) => { resolveSave = resolve; }))
      .mockReturnValueOnce(response({ data: freshDetail }));
    render(<ParticipantRowActions participantPublicId={participantDetail.publicId} fixtureProtected={false} />);

    fireEvent.click(screen.getByRole("button", { name: `编辑 ${participantDetail.publicId}` }));
    fireEvent.change(await screen.findByRole("textbox", { name: /显示别名/ }), { target: { value: "迟到保存" } });
    fireEvent.click(screen.getByRole("button", { name: "保存修改" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    fireEvent.click(screen.getByRole("button", { name: "关闭参与者侧边栏" }));

    fireEvent.click(screen.getByRole("button", { name: `查看 ${participantDetail.publicId}` }));
    expect(await screen.findByText(freshDetail.displayAlias)).toBeVisible();
    await act(async () => resolveSave(await response({ data: { updatedAt: freshDetail.updatedAt } })));

    expect(screen.getByRole("dialog", { name: "查看参与者" })).toBeVisible();
    expect(screen.getByText(freshDetail.displayAlias)).toBeVisible();
    expect(refresh).not.toHaveBeenCalled();
  });

  it("reloads current values after a stale edit and keeps the drawer open", async () => {
    const latestDetail = {
      ...participantDetail,
      displayAlias: "来自其他管理员的更新",
      updatedAt: "2026-09-02T04:00:00.000Z",
    };
    fetchMock
      .mockReturnValueOnce(response({ data: participantDetail }))
      .mockReturnValueOnce(response({ error: { code: "STALE_WRITE", message: "已过期" } }, { ok: false, status: 409 }))
      .mockReturnValueOnce(response({ data: latestDetail }));
    render(<ParticipantRowActions participantPublicId={participantDetail.publicId} fixtureProtected={false} />);

    fireEvent.click(screen.getByRole("button", { name: `编辑 ${participantDetail.publicId}` }));
    fireEvent.change(await screen.findByRole("textbox", { name: /显示别名/ }), { target: { value: "我的修改" } });
    fireEvent.click(screen.getByRole("button", { name: "保存修改" }));

    expect(await screen.findByText("资料已被其他操作更新，已重新加载最新内容。请确认后再次保存。")).toBeVisible();
    expect(screen.getByRole("dialog", { name: "编辑参与者" })).toBeVisible();
    expect(screen.getByRole("textbox", { name: /显示别名/ })).toHaveValue(latestDetail.displayAlias);
    expect(refresh).not.toHaveBeenCalled();
  });

  it("reuses the idempotency key while retrying a pending credential sync", async () => {
    const missingDetail = {
      ...participantDetail,
      loginCredential: {
        ...participantDetail.loginCredential,
        password: null,
        version: 0,
        status: "missing" as const,
        canLogin: false,
        updatedAt: null,
        syncedAt: null,
      },
    };
    const pendingDetail = {
      ...missingDetail,
      updatedAt: "2026-09-02T05:00:00.000Z",
      loginCredential: {
        ...missingDetail.loginCredential,
        password: "Pending2345678X",
        version: 1,
        status: "pending_sync" as const,
        updatedAt: "2026-09-02T05:00:00.000Z",
      },
    };
    const readyCredential = {
      ...pendingDetail.loginCredential,
      status: "ready" as const,
      canLogin: true,
      syncedAt: "2026-09-02T05:00:01.000Z",
    };
    fetchMock
      .mockReturnValueOnce(response({ data: missingDetail }))
      .mockReturnValueOnce(response({ error: { code: "INTERNAL_ERROR", message: "Auth 暂时不可用" } }, { ok: false, status: 503 }))
      .mockReturnValueOnce(response({ data: pendingDetail }))
      .mockReturnValueOnce(response({ data: { loginCredential: readyCredential, updatedAt: pendingDetail.updatedAt } }));
    render(<ParticipantRowActions participantPublicId={participantDetail.publicId} fixtureProtected={false} />);

    fireEvent.click(screen.getByRole("button", { name: `查看 ${participantDetail.publicId}` }));
    fireEvent.click(await screen.findByRole("button", { name: "生成登录密码" }));
    fireEvent.click(screen.getByRole("button", { name: "确认" }));
    expect(await screen.findByText("服务暂时无法处理请求。")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "继续同步" }));
    fireEvent.click(screen.getByRole("button", { name: "确认" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(4));

    const firstKey = new Headers((fetchMock.mock.calls[1]?.[1] as RequestInit).headers).get("idempotency-key");
    const retryKey = new Headers((fetchMock.mock.calls[3]?.[1] as RequestInit).headers).get("idempotency-key");
    expect(firstKey).toBeTruthy();
    expect(retryKey).toBe(firstKey);
    expect(await screen.findByText("当前凭据可以直接登录。")).toBeVisible();
  });
});
