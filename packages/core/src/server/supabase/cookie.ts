export function authCookieName() {
  return process.env.AUTH_COOKIE_NAME?.trim() || "egocapture-auth";
}
