import { apiSuccess } from "@egocapture/core/server/api";
import { requireApiAdmin } from "@egocapture/core/server/request-auth";
import { routeHandler } from "@egocapture/core/server/route-handler";
import { listReviewCases, reviewListSchema } from "@egocapture/core/server/services/review";

export async function GET(request: Request) {
  return routeHandler(request, async (requestId) => {
    const viewer = await requireApiAdmin();
    const input = reviewListSchema.parse(Object.fromEntries(new URL(request.url).searchParams));
    return apiSuccess(await listReviewCases(viewer, input), requestId);
  });
}
