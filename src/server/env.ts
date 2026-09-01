import "server-only";

import { z } from "zod";

const browserEnvironmentSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(32),
  NEXT_PUBLIC_STORAGE_TUS_ENDPOINT: z.string().url(),
});

const serverEnvironmentSchema = browserEnvironmentSchema.extend({
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(32),
  DATABASE_URL: z.string().startsWith("postgresql://"),
  SITE_URL: z.string().url(),
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
  STUDY_SERIAL_HMAC_KEY: z.string().min(32),
  CRON_SECRET: z.string().min(32),
  DEMO_ADMIN_PASSWORD: z.string().min(10),
  DEMO_PARTICIPANT_PASSWORD: z.string().min(10),
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
