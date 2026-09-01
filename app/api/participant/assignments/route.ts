import { apiSuccess } from "@/src/server/api";
import { requireApiParticipant } from "@/src/server/request-auth";
import { routeHandler } from "@/src/server/route-handler";
import { listParticipantAssignments } from "@/src/server/services/tasks";

export async function GET(request: Request) {
  return routeHandler(request, async (requestId) => {
    const viewer = await requireApiParticipant();
    return apiSuccess(await listParticipantAssignments(viewer), requestId);
  });
}
