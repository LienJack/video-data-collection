import { apiSuccess } from "@egocapture/core/server/api";
import { requireApiAdmin } from "@egocapture/core/server/request-auth";
import { routeHandler } from "@egocapture/core/server/route-handler";
import { adminUploadSignedUrl } from "@egocapture/core/server/services/review";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  return routeHandler(request, async (requestId) => {
    const viewer = await requireApiAdmin();
    const { id } = await context.params;
    return apiSuccess(await adminUploadSignedUrl(viewer, id), requestId);
  });
}
