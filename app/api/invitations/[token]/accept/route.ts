import { z } from "zod";
import { DomainError } from "@/src/domain/errors";
import { internalParticipantEmail } from "@/src/domain/invitation";
import { apiSuccess, hasTrustedOrigin } from "@/src/server/api";
import { routeHandler } from "@/src/server/route-handler";
import { acceptInvitation } from "@/src/server/services/participants";
import { createSupabaseServerClient } from "@/src/server/supabase/server";

const inputSchema = z.object({ password: z.string().min(10).max(128) });
type TokenContext = { params: Promise<{ token: string }> };

export async function POST(request: Request, context: TokenContext) {
  return routeHandler(request, async (requestId) => {
    if (!hasTrustedOrigin(request)) throw new DomainError("ORIGIN_REJECTED", "请求来源无效", 403);
    const { token } = await context.params;
    const { password } = inputSchema.parse(await request.json());
    const result = await acceptInvitation(token, password, requestId);
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.signInWithPassword({
      email: internalParticipantEmail(result.participantPublicId),
      password,
    });
    if (error) throw new DomainError("INVITATION_ACCEPT_FAILED", "账号已激活，请前往登录页登录", 503);
    return apiSuccess({ ...result, redirectTo: "/participant/tasks" }, requestId);
  });
}
