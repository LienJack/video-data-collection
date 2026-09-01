import { apiSuccess } from "@/src/server/api";
import { requireApiAdmin } from "@/src/server/request-auth";
import { routeHandler } from "@/src/server/route-handler";
import { auditListSchema, listAuditEvents } from "@/src/server/services/review";

export async function GET(request: Request) {
  return routeHandler(request, async (requestId) => {
    const viewer = await requireApiAdmin();
    const params = new URL(request.url).searchParams;
    return apiSuccess(await listAuditEvents(viewer, auditListSchema.parse({
      cursor: params.get("cursor") || undefined,
      limit: params.get("limit") || undefined,
    })), requestId);
  });
}
