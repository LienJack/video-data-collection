import { DomainError } from "@/src/domain/errors";
import { apiSuccess, hasTrustedOrigin } from "@/src/server/api";
import { requireIdempotencyKey } from "@/src/server/idempotency";
import { requireApiAdmin } from "@/src/server/request-auth";
import { routeHandler } from "@/src/server/route-handler";
import {
  createTask,
  createTaskSchema,
  listTasks,
  taskListSchema,
} from "@/src/server/services/tasks";

export async function GET(request: Request) {
  return routeHandler(request, async (requestId) => {
    const viewer = await requireApiAdmin();
    const input = taskListSchema.parse(Object.fromEntries(new URL(request.url).searchParams));
    return apiSuccess(await listTasks(viewer, input), requestId);
  });
}

export async function POST(request: Request) {
  return routeHandler(request, async (requestId) => {
    if (!hasTrustedOrigin(request)) throw new DomainError("ORIGIN_REJECTED", "请求来源无效", 403);
    const viewer = await requireApiAdmin();
    const input = createTaskSchema.parse(await request.json());
    return apiSuccess(
      await createTask(viewer, input, requireIdempotencyKey(request), requestId),
      requestId,
      201,
    );
  });
}
