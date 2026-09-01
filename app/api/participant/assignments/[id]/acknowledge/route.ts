import { z } from "zod";
import { DomainError } from "@/src/domain/errors";
import { apiSuccess, hasTrustedOrigin } from "@/src/server/api";
import { requireApiParticipant } from "@/src/server/request-auth";
import { routeHandler } from "@/src/server/route-handler";
import {
  acknowledgeAssignment,
  acknowledgeAssignmentSchema,
} from "@/src/server/services/tasks";

const idSchema = z.string().regex(/^AS-[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{6,16}$/);
type IdContext = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: IdContext) {
  return routeHandler(request, async (requestId) => {
    if (!hasTrustedOrigin(request)) throw new DomainError("ORIGIN_REJECTED", "请求来源无效", 403);
    const viewer = await requireApiParticipant();
    const { id } = await context.params;
    return apiSuccess(
      await acknowledgeAssignment(
        viewer,
        idSchema.parse(id),
        acknowledgeAssignmentSchema.parse(await request.json()),
        requestId,
      ),
      requestId,
    );
  });
}
