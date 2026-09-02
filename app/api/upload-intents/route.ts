import { DomainError } from "@egocapture/core/domain/errors";
import { MAX_FILE_SIZE_BYTES } from "@egocapture/core/domain/constants";
import { apiSuccess, hasTrustedOrigin } from "@egocapture/core/server/api";
import { requireIdempotencyKey } from "@egocapture/core/server/idempotency";
import { requireApiParticipant } from "@egocapture/core/server/request-auth";
import { routeHandler } from "@egocapture/core/server/route-handler";
import {
  createUploadIntent,
  createUploadIntentInputSchema,
} from "@egocapture/core/server/services/uploads";

export async function POST(request: Request) {
  return routeHandler(request, async (requestId) => {
    if (!hasTrustedOrigin(request)) throw new DomainError("ORIGIN_REJECTED", "请求来源无效", 403);
    const viewer = await requireApiParticipant();
    const input = await request.json() as { sizeBytes?: unknown };
    if (typeof input.sizeBytes === "number" && input.sizeBytes > MAX_FILE_SIZE_BYTES) {
      throw new DomainError("FILE_TOO_LARGE", `单文件不能超过 ${MAX_FILE_SIZE_BYTES} bytes`, 413);
    }
    return apiSuccess(
      await createUploadIntent(
        viewer,
        createUploadIntentInputSchema.parse(input),
        requireIdempotencyKey(request),
        requestId,
      ),
      requestId,
      201,
    );
  });
}
