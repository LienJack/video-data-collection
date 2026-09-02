import { NextResponse } from "next/server";
import { LOCALE_COOKIE_NAME, SUPPORTED_LOCALES, type UiLocale } from "@egocapture/core/i18n";
import { hasTrustedOrigin, requestId } from "@egocapture/core/server/api";
import { localeCookieOptions } from "@egocapture/core/server/i18n";

export async function POST(request: Request) {
  const id = requestId(request);
  if (!hasTrustedOrigin(request)) return NextResponse.json({ error: { code: "ORIGIN_REJECTED" }, requestId: id }, { status: 403 });
  const body = await request.json().catch(() => null) as { locale?: unknown } | null;
  if (!body || typeof body.locale !== "string" || !(SUPPORTED_LOCALES as readonly string[]).includes(body.locale)) {
    return NextResponse.json({ error: { code: "VALIDATION_FAILED" }, requestId: id }, { status: 422 });
  }
  const response = NextResponse.json({ data: { locale: body.locale }, requestId: id }, { headers: { "cache-control": "no-store", "x-request-id": id } });
  response.cookies.set(LOCALE_COOKIE_NAME, body.locale as UiLocale, { ...localeCookieOptions, secure: new URL(request.url).protocol === "https:" });
  return response;
}
