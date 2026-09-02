import "server-only";

import { z } from "zod";

const browserEnvironmentSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(32),
  NEXT_PUBLIC_STORAGE_TUS_ENDPOINT: z.string().url(),
});

const serverEnvironmentSchema = browserEnvironmentSchema.extend({
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(32),
  SUPABASE_JWT_SECRET: z.string().min(32).optional(),
  STORAGE_UPLOAD_AUTH_MODE: z.enum(["official_signed", "nas_scoped_jwt"]).default("official_signed"),
  DATABASE_URL: z.string().startsWith("postgresql://"),
  PARTICIPANT_SITE_URL: z.string().url(),
  ADMIN_SITE_URL: z.string().url(),
  MARKER_PRIVATE_KEY_JWK: z.string().transform((value, context) => {
    try {
      return JSON.parse(value) as Record<string, unknown>;
    } catch {
      context.addIssue({ code: "custom", message: "必须是合法 JWK JSON" });
      return z.NEVER;
    }
  }),
  MARKER_PUBLIC_KEY_JWK: z.string().transform((value, context) => {
    try {
      return JSON.parse(value) as Record<string, unknown>;
    } catch {
      context.addIssue({ code: "custom", message: "必须是合法 JWK JSON" });
      return z.NEVER;
    }
  }),
  MARKER_KEY_ID: z.string().min(1).max(80),
  DEVICE_SERIAL_HMAC_KEY: z.string().min(32),
  CRON_SECRET: z.string().min(32),
  DEMO_ADMIN_USERNAME: z.string().trim().min(1).max(64),
  DEMO_ADMIN_EMAIL: z.string().trim().email().max(254),
  DEMO_ADMIN_PASSWORD: z.string().min(8),
  DEMO_PARTICIPANT_PASSWORD: z.string().min(12).max(128),
}).superRefine((environment, context) => {
  if (environment.STORAGE_UPLOAD_AUTH_MODE === "nas_scoped_jwt" && !environment.SUPABASE_JWT_SECRET) {
    context.addIssue({
      code: "custom",
      path: ["SUPABASE_JWT_SECRET"],
      message: "NAS scoped upload 模式必须配置 Supabase JWT secret",
    });
  }
});

export type ServerEnvironment = z.infer<typeof serverEnvironmentSchema>;

let cachedEnvironment: ServerEnvironment | undefined;

export function serverEnvironment(): ServerEnvironment {
  cachedEnvironment ??= serverEnvironmentSchema.parse(process.env);
  return cachedEnvironment;
}

export function browserEnvironment() {
  return browserEnvironmentSchema.parse({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    NEXT_PUBLIC_STORAGE_TUS_ENDPOINT: process.env.NEXT_PUBLIC_STORAGE_TUS_ENDPOINT,
  });
}
