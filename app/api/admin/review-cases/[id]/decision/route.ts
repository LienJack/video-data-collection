import { DomainError } from "@/src/domain/errors";
import { apiSuccess, hasTrustedOrigin } from "@/src/server/api";
import { requireIdempotencyKey } from "@/src/server/idempotency";
import { requireApiAdmin } from "@/src/server/request-auth";
import { routeHandler } from "@/src/server/route-handler";
import { decideReviewCase, reviewDecisionSchema } from "@/src/server/services/review";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  return routeHandler(request, async (requestId) => {
    if (!hasTrustedOrigin(request)) throw new DomainError("ORIGIN_REJECTED", "请求来源无效", 403);
    const viewer = await requireApiAdmin();
    const { id } = await context.params;
    const input = reviewDecisionSchema.parse(await request.json());
    return apiSuccess(await decideReviewCase(viewer, id, input, requireIdempotencyKey(request), requestId), requestId);
  });
}
