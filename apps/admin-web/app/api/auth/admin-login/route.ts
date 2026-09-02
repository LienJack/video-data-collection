import { z } from "zod";
import { apiError, apiSuccess, hasTrustedOrigin, requestId } from "@egocapture/core/server/api";
import { database } from "@egocapture/core/server/database";
import { createSupabaseServerClient } from "@egocapture/core/server/supabase/server";
import { resolveAdminEmail } from "@egocapture/core/domain/admin-identity";
import { serverEnvironment } from "@egocapture/core/server/env";

export const runtime = "nodejs";

const loginSchema = z.object({
  identity: z.string().trim().min(1).max(254).optional(),
  email: z.string().trim().email().max(254).optional(),
  password: z.string().min(8).max(128),
}).refine((value) => Boolean(value.identity || value.email));

export async function POST(request: Request) {
  const id = requestId(request);
  if (!hasTrustedOrigin(request)) return apiError("ORIGIN_REJECTED", "请求来源无效", id, 403);
  const parsed = loginSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return apiError("VALIDATION_FAILED", "登录信息格式不正确", id, 422, parsed.error);

  const environment = serverEnvironment();
  const email = resolveAdminEmail(parsed.data.identity || parsed.data.email || "", {
    username: environment.DEMO_ADMIN_USERNAME,
    email: environment.DEMO_ADMIN_EMAIL,
  });
  const validEmail = z.string().email().safeParse(email);
  if (!validEmail.success) return apiError("INVALID_CREDENTIALS", "账号或密码不正确", id, 401);

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.signInWithPassword({
    email: validEmail.data,
    password: parsed.data.password,
  });
  if (error || !data.user) return apiError("INVALID_CREDENTIALS", "账号或密码不正确", id, 401);

  const db = database();
  const [profile] = await db<{ role: string }[]>`
    select role from egocapture.profiles where auth_user_id = ${data.user.id}::uuid limit 1
  `;
  if (profile?.role !== "admin") {
    await supabase.auth.signOut();
    return apiError("INVALID_CREDENTIALS", "账号或密码不正确", id, 401);
  }
  return apiSuccess({ redirectTo: "/dashboard" }, id);
}
