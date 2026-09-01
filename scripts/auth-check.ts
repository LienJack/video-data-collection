import { randomBytes, randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";
import { createClient } from "@supabase/supabase-js";
import postgres from "postgres";

function parseEnv(text: string): Record<string, string> {
  return Object.fromEntries(
    text.split(/\r?\n/).filter((line) => line && !line.startsWith("#")).map((line) => {
      const separator = line.indexOf("=");
      return [line.slice(0, separator), line.slice(separator + 1)];
    }),
  );
}

function readEnv(file: string): Record<string, string> {
  try { return parseEnv(readFileSync(file, "utf8")); } catch { return {}; }
}

function environment() {
  const root = process.cwd();
  const local = readEnv(path.join(root, ".env.development.local"));
  const profile = local.EGOCAPTURE_DEV_PROFILE || "local";
  const runtime = readEnv(path.join(root, ".runtime", profile, "app.env"));
  const merged = { ...runtime, ...process.env };
  for (const key of [
    "DATABASE_URL",
    "NEXT_PUBLIC_SUPABASE_URL",
    "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    "SUPABASE_SERVICE_ROLE_KEY",
  ]) {
    if (!merged[key]) throw new Error(`缺少 ${key}`);
  }
  return {
    DATABASE_URL: merged.DATABASE_URL!,
    NEXT_PUBLIC_SUPABASE_URL: merged.NEXT_PUBLIC_SUPABASE_URL!,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: merged.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    SUPABASE_SERVICE_ROLE_KEY: merged.SUPABASE_SERVICE_ROLE_KEY!,
  };
}

async function main() {
  const env = environment();
  const db = postgres(env.DATABASE_URL, { max: 1, connect_timeout: 8, prepare: false });
  const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, detectSessionInUrl: false, persistSession: false },
  });
  const browser = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    auth: { autoRefreshToken: false, detectSessionInUrl: false, persistSession: false },
  });
  const suffix = randomUUID();
  const email = `auth-smoke-${suffix}@demo.invalid`;
  const password = randomBytes(24).toString("base64url");
  const studyId = randomUUID();
  let userId: string | undefined;
  try {
    const { data: created, error: createError } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });
    if (createError || !created.user) throw createError || new Error("Auth User 未创建");
    userId = created.user.id;
    const [profile] = await db<{ id: string }[]>`
      insert into egocapture.profiles (auth_user_id, role, display_name)
      values (${userId}::uuid, 'admin', 'Auth Smoke Admin')
      returning id
    `;
    await db`
      insert into egocapture.studies (id, public_id, slug, name, serial_hmac_salt)
      values (${studyId}::uuid, ${`ST-${suffix.replaceAll("-", "").slice(0, 8).toUpperCase().replace(/[01IO]/g, "2")}`}, ${`auth-smoke-${suffix}`}, 'Auth Smoke Study', 'auth-smoke-salt')
    `;
    await db`
      insert into egocapture.study_memberships (study_id, profile_id, role)
      values (${studyId}::uuid, ${profile.id}::uuid, 'owner')
    `;

    const { data: session, error: loginError } = await browser.auth.signInWithPassword({ email, password });
    if (loginError || !session.session) throw loginError || new Error("登录未返回 Session");
    const { data: studies, error: rlsError } = await browser
      .schema("egocapture")
      .from("studies")
      .select("id,slug")
      .eq("id", studyId);
    if (rlsError) throw rlsError;
    if (studies?.length !== 1) throw new Error(`JWT 经 PostgREST 后未通过预期 RLS：${studies?.length ?? 0}`);
    await browser.auth.signOut();
  } finally {
    try {
      await db`delete from egocapture.study_memberships where study_id = ${studyId}::uuid`;
      await db`delete from egocapture.studies where id = ${studyId}::uuid`;
      if (userId) await db`delete from egocapture.profiles where auth_user_id = ${userId}::uuid`;
      if (userId) await admin.auth.admin.deleteUser(userId);
    } finally {
      await db.end({ timeout: 2 });
    }
  }
  console.log("GoTrue login, JWT propagation, PostgREST and Study RLS checks passed");
}

main().catch((error) => {
  console.error(error instanceof Error ? `EgoCapture Auth: ${error.message}` : error);
  process.exitCode = 1;
});
