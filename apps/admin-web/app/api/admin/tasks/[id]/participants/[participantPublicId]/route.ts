import { z } from "zod";
import { DomainError } from "@egocapture/core/domain/errors";
import { apiSuccess, hasTrustedOrigin } from "@egocapture/core/server/api";
import { requireApiAdmin } from "@egocapture/core/server/request-auth";
import { routeHandler } from "@egocapture/core/server/route-handler";
import { removePlannedTaskParticipant } from "@egocapture/core/server/services/tasks";

const taskIdSchema = z.string().regex(/^TSK-[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{6,16}$/);
const participantIdSchema = z.string().regex(/^PT-[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{6,16}$/);

type IdContext = {
  params: Promise<{ id: string; participantPublicId: string }>;
};

export async function DELETE(request: Request, context: IdContext) {
  return routeHandler(request, async (requestId) => {
    if (!hasTrustedOrigin(request)) throw new DomainError("ORIGIN_REJECTED", "请求来源无效", 403);
    const viewer = await requireApiAdmin();
    const { id, participantPublicId } = await context.params;
    return apiSuccess(
      await removePlannedTaskParticipant(
        viewer,
        taskIdSchema.parse(id),
        participantIdSchema.parse(participantPublicId),
        requestId,
      ),
      requestId,
    );
  });
}
