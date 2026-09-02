import { z } from "zod";
import { apiError, apiSuccess, hasTrustedOrigin, requestId } from "@egocapture/core/server/api";
import { database } from "@egocapture/core/server/database";
import { createSupabaseServerClient } from "@egocapture/core/server/supabase/server";

export const runtime = "nodejs";

const loginSchema = z.object({
  participantPublicId: z.string().trim().toUpperCase().regex(/^PT-[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{6,16}$/),
  password: z.string().min(10).max(128),
});

export async function POST(request: Request) {
  const id = requestId(request);
  if (!hasTrustedOrigin(request)) return apiError("ORIGIN_REJECTED", "请求来源无效", id, 403);
  const parsed = loginSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return apiError("INVALID_CREDENTIALS", "Participant ID 或密码不正确", id, 401);

  const db = database();
  const [identity] = await db<{ email: string }[]>`
    select auth_user.email
    from egocapture.participants participant
    join auth.users auth_user on auth_user.id = participant.auth_user_id
    where participant.public_id = ${parsed.data.participantPublicId}
      and participant.status = 'active'
      and participant.consent_status = 'valid'
    limit 1
  `;
  if (!identity?.email) return apiError("INVALID_CREDENTIALS", "Participant ID 或密码不正确", id, 401);

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: identity.email,
    password: parsed.data.password,
  });
  if (error) return apiError("INVALID_CREDENTIALS", "Participant ID 或密码不正确", id, 401);
  return apiSuccess({ redirectTo: "/tasks" }, id);
}
