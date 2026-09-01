import { readFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";

function parseEnv(text: string): Record<string, string> {
  return Object.fromEntries(text.split(/\r?\n/).filter((line) => line && !line.startsWith("#")).map((line) => {
    const separator = line.indexOf("=");
    return [line.slice(0, separator), line.slice(separator + 1)];
  }));
}

function readEnv(file: string) {
  try { return parseEnv(readFileSync(file, "utf8")); } catch { return {}; }
}

export function integrationEnvironment() {
  const root = process.cwd();
  const local = readEnv(path.join(root, ".env.development.local"));
  const profile = local.EGOCAPTURE_DEV_PROFILE || "local";
  const merged = { ...readEnv(path.join(root, ".runtime", profile, "app.env")), ...process.env };
  for (const key of [
    "DATABASE_URL",
    "NEXT_PUBLIC_SUPABASE_URL",
    "SUPABASE_SERVICE_ROLE_KEY",
    "SITE_URL",
    "MARKER_PUBLIC_KEY_JWK",
    "MARKER_KEY_ID",
  ]) {
    if (!merged[key]) throw new Error(`缺少 ${key}`);
  }
  return {
    databaseUrl: merged.DATABASE_URL!,
    supabaseUrl: merged.NEXT_PUBLIC_SUPABASE_URL!,
    serviceRoleKey: merged.SUPABASE_SERVICE_ROLE_KEY!,
    siteUrl: merged.SITE_URL!,
    markerPublicKeyJwk: JSON.parse(merged.MARKER_PUBLIC_KEY_JWK!) as Record<string, unknown>,
    markerKeyId: merged.MARKER_KEY_ID!,
  };
}

export class CookieJar {
  private readonly values = new Map<string, string>();
  absorb(response: Response) {
    for (const header of response.headers.getSetCookie()) {
      const pair = header.slice(0, header.indexOf(";"));
      const separator = pair.indexOf("=");
      const name = pair.slice(0, separator);
      const value = pair.slice(separator + 1);
      if (/max-age=0/i.test(header) || !value) this.values.delete(name);
      else this.values.set(name, value);
    }
  }
  header() { return [...this.values].map(([name, value]) => `${name}=${value}`).join("; "); }
}

export async function api<T>(
  siteUrl: string,
  route: string,
  options: RequestInit & { jar?: CookieJar } = {},
): Promise<{ response: Response; payload: T }> {
  const headers = new Headers(options.headers);
  headers.set("origin", new URL(siteUrl).origin);
  if (options.jar?.header()) headers.set("cookie", options.jar.header());
  const response = await fetch(`${siteUrl}${route}`, { ...options, headers, redirect: "manual" });
  options.jar?.absorb(response);
  const payload = await response.json() as T;
  return { response, payload };
}

export function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}
