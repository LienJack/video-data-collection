import { apiSuccess } from "@/src/server/api";
import { requireApiAdmin } from "@/src/server/request-auth";
import { routeHandler } from "@/src/server/route-handler";
import { listAuditEvents } from "@/src/server/services/review";

export async function GET(request: Request) {
  return routeHandler(request, async (requestId) => {
    const viewer = await requireApiAdmin();
    return apiSuccess(await listAuditEvents(viewer, new URL(request.url).searchParams.get("cursor")), requestId);
  });
}
