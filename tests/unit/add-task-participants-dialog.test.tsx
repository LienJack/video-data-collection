import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AddTaskParticipants } from "../../apps/admin-web/app/(console)/tasks/[taskPublicId]/add-task-participants";

const { refresh } = vi.hoisted(() => ({ refresh: vi.fn() }));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh }),
}));

const participant = {
  publicId: "PT-23456789",
  displayAlias: "测试参与者",
  status: "active",
  consentStatus: "valid",
  locale: "zh-CN",
  countryRegion: "CN",
  defaultDevicePublicId: "DEV-23456789",
  currentAssignmentPublicId: null,
  currentTaskState: null,
  devices: [{ publicId: "DEV-23456789", label: "测试相机" }],
};

const secondParticipant = {
  ...participant,
  publicId: "PT-3456789A",
  displayAlias: "第二位参与者",
  defaultDevicePublicId: null,
  devices: [],
};

describe("Add task participants dialog", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    refresh.mockReset();
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
    vi.stubGlobal("ResizeObserver", class {
      observe() {}
      unobserve() {}
      disconnect() {}
    });
    Object.defineProperty(HTMLDialogElement.prototype, "showModal", {
      configurable: true,
      value(this: HTMLDialogElement) { this.setAttribute("open", ""); },
    });
    Object.defineProperty(HTMLDialogElement.prototype, "close", {
      configurable: true,
      value(this: HTMLDialogElement) { this.removeAttribute("open"); },
    });
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("closes after every selected participant is assigned successfully", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        data: {
          created: [{
            participantPublicId: participant.publicId,
            assignmentPublicId: "AS-23456789",
            state: "assigned",
          }],
          skipped: [],
        },
      }),
    } as Response);

    render(<AddTaskParticipants
      taskPublicId="TSK-X6D3GAKJFY"
      versions={[{ version: 1 }]}
      participants={[participant]}
    />);

    fireEvent.click(screen.getByRole("button", { name: "添加参与者" }));
    const dialog = screen.getByRole("dialog");
    fireEvent.click(screen.getByRole("checkbox", { name: "选择 测试参与者" }));
    fireEvent.click(screen.getByRole("button", { name: "下一步：设备与设置" }));
    fireEvent.click(screen.getByRole("button", { name: "分配给 1 人" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledOnce());
    await waitFor(() => expect(dialog).not.toHaveAttribute("open"));
    expect(refresh).toHaveBeenCalledOnce();
  });

  it("stays open and shows the result when any participant is skipped", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        data: {
          created: [{
            participantPublicId: participant.publicId,
            assignmentPublicId: "AS-23456789",
            state: "assigned",
          }],
          skipped: [{
            participantPublicId: secondParticipant.publicId,
            code: "ALREADY_ASSIGNED",
            message: "already assigned",
          }],
        },
      }),
    } as Response);

    render(<AddTaskParticipants
      taskPublicId="TSK-X6D3GAKJFY"
      versions={[{ version: 1 }]}
      participants={[participant, secondParticipant]}
    />);

    fireEvent.click(screen.getByRole("button", { name: "添加参与者" }));
    const dialog = screen.getByRole("dialog");
    fireEvent.click(screen.getByRole("checkbox", { name: "选择 测试参与者" }));
    fireEvent.click(screen.getByRole("checkbox", { name: "选择 第二位参与者" }));
    fireEvent.click(screen.getByRole("button", { name: "下一步：设备与设置" }));
    fireEvent.click(screen.getByRole("button", { name: "分配给 2 人" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledOnce());
    expect(dialog).toHaveAttribute("open");
    expect(await screen.findByText("1 人未添加")).toBeVisible();
    expect(refresh).toHaveBeenCalledOnce();
  });
});
