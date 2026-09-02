import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AcceptInvitationForm } from "../../apps/participant-web/app/invite/[token]/accept-form";

describe("accept invitation confirmation", () => {
  it("does not ask the participant to create or submit a password", () => {
    render(<AcceptInvitationForm token="test-token" />);

    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    expect(screen.getByText(/登录帐号和系统生成的密码由管理员提供/)).toBeVisible();
    expect(screen.getByRole("button", { name: "接受邀请并进入任务" })).toBeEnabled();
  });
});
