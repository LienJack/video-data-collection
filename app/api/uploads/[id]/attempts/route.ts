import { DomainError } from "@/src/domain/errors";
import { apiSuccess, hasTrustedOrigin } from "@/src/server/api";
import { requireApiParticipant } from "@/src/server/request-auth";
import { routeHandler } from "@/src/server/route-handler";
import { createAttemptSchema, createOrResumeAttempt } from "@/src/server/services/uploads";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  return routeHandler(request, async (requestId) => {
    if (!hasTrustedOrigin(request)) throw new DomainError("ORIGIN_REJECTED", "请求来源无效", 403);
    const viewer = await requireApiParticipant();
    const { id } = await context.params;
    return apiSuccess(
      await createOrResumeAttempt(viewer, id, createAttemptSchema.parse(await request.json()), requestId),
      requestId,
      201,
    );
  });
}
