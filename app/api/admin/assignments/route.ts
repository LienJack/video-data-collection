import { DomainError } from "@egocapture/core/domain/errors";
import { apiSuccess, hasTrustedOrigin } from "@egocapture/core/server/api";
import { requireIdempotencyKey } from "@egocapture/core/server/idempotency";
import { requireApiAdmin } from "@egocapture/core/server/request-auth";
import { routeHandler } from "@egocapture/core/server/route-handler";
import {
  assignmentListSchema,
  createAssignment,
  createAssignmentSchema,
  listAssignments,
} from "@egocapture/core/server/services/tasks";

export async function GET(request: Request) {
  return routeHandler(request, async (requestId) => {
    const viewer = await requireApiAdmin();
    const input = assignmentListSchema.parse(Object.fromEntries(new URL(request.url).searchParams));
    return apiSuccess(await listAssignments(viewer, input), requestId);
  });
}

export async function POST(request: Request) {
  return routeHandler(request, async (requestId) => {
    if (!hasTrustedOrigin(request)) throw new DomainError("ORIGIN_REJECTED", "请求来源无效", 403);
    const viewer = await requireApiAdmin();
    const input = createAssignmentSchema.parse(await request.json());
    return apiSuccess(
      await createAssignment(viewer, input, requireIdempotencyKey(request), requestId),
      requestId,
      201,
    );
  });
}
