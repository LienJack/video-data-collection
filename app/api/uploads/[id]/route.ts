import { apiSuccess } from "@/src/server/api";
import { requireApiParticipant } from "@/src/server/request-auth";
import { routeHandler } from "@/src/server/route-handler";
import { getParticipantUpload } from "@/src/server/services/uploads";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  return routeHandler(request, async (requestId) => {
    const viewer = await requireApiParticipant();
    const { id } = await context.params;
    return apiSuccess(await getParticipantUpload(viewer, id), requestId);
  });
}
