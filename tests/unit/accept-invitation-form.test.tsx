import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AcceptInvitationForm } from "../../apps/participant-web/app/invite/[token]/accept-form";

describe("accept invitation password fields", () => {
  it("shows and hides each password independently without clearing its value", () => {
    render(<AcceptInvitationForm token="test-token" />);

    const password = screen.getByLabelText("设置密码");
    const confirmation = screen.getByLabelText("再次输入");
    fireEvent.change(password, { target: { value: "strong-password" } });

    expect(password).toHaveAttribute("type", "password");
    expect(confirmation).toHaveAttribute("type", "password");

    fireEvent.click(screen.getByRole("button", { name: "显示设置的密码" }));

    expect(password).toHaveAttribute("type", "text");
    expect(password).toHaveValue("strong-password");
    expect(confirmation).toHaveAttribute("type", "password");
    expect(screen.getByRole("button", { name: "隐藏设置的密码" })).toHaveAttribute("aria-pressed", "true");

    fireEvent.click(screen.getByRole("button", { name: "显示再次输入的密码" }));

    expect(confirmation).toHaveAttribute("type", "text");
    fireEvent.click(screen.getByRole("button", { name: "隐藏设置的密码" }));
    expect(password).toHaveAttribute("type", "password");
  });
});
