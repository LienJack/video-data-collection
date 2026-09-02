import { apiSuccess } from "@egocapture/core/server/api";
import { requireApiParticipant } from "@egocapture/core/server/request-auth";
import { routeHandler } from "@egocapture/core/server/route-handler";
import { getParticipantUpload } from "@egocapture/core/server/services/uploads";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  return routeHandler(request, async (requestId) => {
    const viewer = await requireApiParticipant();
    const { id } = await context.params;
    return apiSuccess(await getParticipantUpload(viewer, id), requestId);
  });
}
