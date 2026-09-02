import { apiSuccess } from "@egocapture/core/server/api";
import { requireApiParticipant } from "@egocapture/core/server/request-auth";
import { routeHandler } from "@egocapture/core/server/route-handler";
import { listParticipantAssignments } from "@egocapture/core/server/services/tasks";

export async function GET(request: Request) {
  return routeHandler(request, async (requestId) => {
    const viewer = await requireApiParticipant();
    return apiSuccess(await listParticipantAssignments(viewer), requestId);
  });
}
