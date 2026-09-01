import { DomainError } from "@/src/domain/errors";
import { apiSuccess, hasTrustedOrigin } from "@/src/server/api";
import { requireIdempotencyKey } from "@/src/server/idempotency";
import { requireApiParticipant } from "@/src/server/request-auth";
import { routeHandler } from "@/src/server/route-handler";
import { createUploadBatch } from "@/src/server/services/uploads";

export async function POST(request: Request) {
  return routeHandler(request, async (requestId) => {
    if (!hasTrustedOrigin(request)) throw new DomainError("ORIGIN_REJECTED", "请求来源无效", 403);
    const viewer = await requireApiParticipant();
    return apiSuccess(
      await createUploadBatch(viewer, requireIdempotencyKey(request), requestId),
      requestId,
      201,
    );
  });
}
