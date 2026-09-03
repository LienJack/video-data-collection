export function authCookieName() {
  return process.env.AUTH_COOKIE_NAME?.trim() || "egocapture-auth";
}

export function authCookieOptions() {
  return {
    name: authCookieName(),
    httpOnly: true,
    path: "/",
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
  };
}
