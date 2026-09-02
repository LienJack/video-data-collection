import { DomainError } from "@egocapture/core/domain/errors";
import { apiSuccess, hasTrustedOrigin } from "@egocapture/core/server/api";
import { requireApiParticipant } from "@egocapture/core/server/request-auth";
import { routeHandler } from "@egocapture/core/server/route-handler";
import {
  updateUploadAttemptProgress,
  updateUploadAttemptProgressInputSchema,
} from "@egocapture/core/server/services/uploads";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string; attemptId: string }> },
) {
  return routeHandler(request, async (requestId) => {
    if (!hasTrustedOrigin(request)) throw new DomainError("ORIGIN_REJECTED", "请求来源无效", 403);
    const viewer = await requireApiParticipant();
    const { id, attemptId } = await context.params;
    return apiSuccess(
      await updateUploadAttemptProgress(
        viewer,
        id,
        attemptId,
        updateUploadAttemptProgressInputSchema.parse(await request.json()),
      ),
      requestId,
    );
  });
}
