import { DomainError } from "@/src/domain/errors";
import { MAX_FILE_SIZE_BYTES } from "@/src/domain/constants";
import { apiSuccess, hasTrustedOrigin } from "@/src/server/api";
import { requireIdempotencyKey } from "@/src/server/idempotency";
import { requireApiParticipant } from "@/src/server/request-auth";
import { routeHandler } from "@/src/server/route-handler";
import {
  createUploadIntent,
  createUploadIntentInputSchema,
} from "@/src/server/services/uploads";

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
