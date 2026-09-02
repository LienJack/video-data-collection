import { DomainError } from "@egocapture/core/domain/errors";
import { apiSuccess, hasTrustedOrigin } from "@egocapture/core/server/api";
import { requireIdempotencyKey } from "@egocapture/core/server/idempotency";
import { requireApiAdmin } from "@egocapture/core/server/request-auth";
import { routeHandler } from "@egocapture/core/server/route-handler";
import { decideReviewCase, reviewDecisionSchema } from "@egocapture/core/server/services/review";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  return routeHandler(request, async (requestId) => {
    if (!hasTrustedOrigin(request)) throw new DomainError("ORIGIN_REJECTED", "请求来源无效", 403);
    const viewer = await requireApiAdmin();
    const { id } = await context.params;
    const input = reviewDecisionSchema.parse(await request.json());
    return apiSuccess(await decideReviewCase(viewer, id, input, requireIdempotencyKey(request), requestId), requestId);
  });
}
