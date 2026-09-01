import { apiSuccess } from "@/src/server/api";
import { requireApiAdmin } from "@/src/server/request-auth";
import { routeHandler } from "@/src/server/route-handler";
import { listReviewCases, reviewListSchema } from "@/src/server/services/review";

export async function GET(request: Request) {
  return routeHandler(request, async (requestId) => {
    const viewer = await requireApiAdmin();
    const input = reviewListSchema.parse(Object.fromEntries(new URL(request.url).searchParams));
    return apiSuccess(await listReviewCases(viewer, input), requestId);
  });
}
