import { NextResponse } from "next/server";
import { ZodError } from "zod";

export type ApiSuccess<T> = { data: T; requestId: string };
export type ApiError = {
  error: { code: string; message: string; fieldErrors?: Record<string, string[]> };
  requestId: string;
};

export function requestId(request: Request): string {
  const incoming = request.headers.get("x-request-id");
  return incoming && /^[A-Za-z0-9._-]{8,100}$/.test(incoming) ? incoming : crypto.randomUUID();
}

export function hasTrustedOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return false;
  try {
    return new URL(origin).origin === new URL(request.url).origin;
  } catch {
    return false;
  }
}

export function apiSuccess<T>(data: T, id: string, status = 200) {
  return NextResponse.json<ApiSuccess<T>>({ data, requestId: id }, {
    status,
    headers: { "x-request-id": id, "cache-control": "no-store" },
  });
}

export function apiError(code: string, message: string, id: string, status: number, error?: unknown) {
  const fieldErrors = error instanceof ZodError ? error.flatten().fieldErrors : undefined;
  return NextResponse.json<ApiError>(
    { error: { code, message, ...(fieldErrors ? { fieldErrors } : {}) }, requestId: id },
    { status, headers: { "x-request-id": id, "cache-control": "no-store" } },
  );
}
