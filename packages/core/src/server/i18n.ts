import "server-only";

import { cookies, headers } from "next/headers";
import { LOCALE_COOKIE_NAME, resolveUiLocale, type UiLocale } from "../i18n";

export async function requestLocale(profileLocale?: string | null): Promise<UiLocale> {
  const [cookieStore, headerStore] = await Promise.all([cookies(), headers()]);
  return resolveUiLocale({
    cookie: cookieStore.get(LOCALE_COOKIE_NAME)?.value,
    profile: profileLocale,
    acceptLanguage: headerStore.get("accept-language"),
  });
}

export const localeCookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  path: "/",
  maxAge: 60 * 60 * 24 * 365,
};
