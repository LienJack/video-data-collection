import { afterEach, describe, expect, it, vi } from "vitest";
import { authCookieOptions } from "@egocapture/core/server/supabase/cookie";

describe("authCookieOptions", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("uses a secure, HTTP-only, host-scoped cookie in production", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("AUTH_COOKIE_NAME", "egocapture-participant-auth");

    expect(authCookieOptions()).toEqual({
      name: "egocapture-participant-auth",
      httpOnly: true,
      path: "/",
      sameSite: "lax",
      secure: true,
    });
  });

  it("allows the local HTTP development origin", () => {
    vi.stubEnv("NODE_ENV", "development");

    expect(authCookieOptions()).toMatchObject({
      httpOnly: true,
      secure: false,
    });
  });
});
