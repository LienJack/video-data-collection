import { apiError, apiSuccess, hasTrustedOrigin, requestId } from "@/src/server/api";
import { createSupabaseServerClient } from "@/src/server/supabase/server";

export async function POST(request: Request) {
  const id = requestId(request);
  if (!hasTrustedOrigin(request)) return apiError("ORIGIN_REJECTED", "请求来源无效", id, 403);
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  return apiSuccess({ redirectTo: "/login" }, id);
}
