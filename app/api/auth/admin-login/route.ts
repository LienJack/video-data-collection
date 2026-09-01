import { z } from "zod";
import { apiError, apiSuccess, hasTrustedOrigin, requestId } from "@/src/server/api";
import { database } from "@/src/server/database";
import { createSupabaseServerClient } from "@/src/server/supabase/server";

export const runtime = "nodejs";

const loginSchema = z.object({
  email: z.string().trim().email().max(254),
  password: z.string().min(10).max(128),
});

export async function POST(request: Request) {
  const id = requestId(request);
  if (!hasTrustedOrigin(request)) return apiError("ORIGIN_REJECTED", "请求来源无效", id, 403);
  const parsed = loginSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return apiError("VALIDATION_FAILED", "登录信息格式不正确", id, 422, parsed.error);

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error || !data.user) return apiError("INVALID_CREDENTIALS", "账号或密码不正确", id, 401);

  const db = database();
  const [profile] = await db<{ role: string }[]>`
    select role from egocapture.profiles where auth_user_id = ${data.user.id}::uuid limit 1
  `;
  if (profile?.role !== "admin") {
    await supabase.auth.signOut();
    return apiError("INVALID_CREDENTIALS", "账号或密码不正确", id, 401);
  }
  return apiSuccess({ redirectTo: "/admin/dashboard" }, id);
}
