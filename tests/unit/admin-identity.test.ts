import { describe, expect, it } from "vitest";
import { resolveAdminEmail } from "@egocapture/core/domain/admin-identity";

const configured = {
  username: "admin",
  email: "admin.demo@egocapture.invalid",
};

describe("admin identity", () => {
  it("maps the configured short username to the internal Auth email", () => {
    expect(resolveAdminEmail(" ADMIN ", configured)).toBe(configured.email);
  });

  it("preserves email login for integration and non-demo administrators", () => {
    expect(resolveAdminEmail(" Reviewer@Demo.Invalid ", configured)).toBe("reviewer@demo.invalid");
  });

  it("rejects unknown short usernames", () => {
    expect(resolveAdminEmail("operator", configured)).toBeNull();
  });
});
