import { z } from "zod";
import { DomainError } from "@egocapture/core/domain/errors";
import { internalParticipantEmail } from "@egocapture/core/domain/invitation";
import { apiSuccess, hasTrustedOrigin } from "@egocapture/core/server/api";
import { routeHandler } from "@egocapture/core/server/route-handler";
import { acceptInvitation } from "@egocapture/core/server/services/participants";
import { createSupabaseServerClient } from "@egocapture/core/server/supabase/server";

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
