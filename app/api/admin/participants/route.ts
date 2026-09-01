import { DomainError } from "@/src/domain/errors";
import { apiSuccess, hasTrustedOrigin } from "@/src/server/api";
import { requireIdempotencyKey } from "@/src/server/idempotency";
import { requireApiAdmin } from "@/src/server/request-auth";
import { routeHandler } from "@/src/server/route-handler";
import {
  createParticipant,
  createParticipantSchema,
  listParticipants,
  participantListSchema,
} from "@/src/server/services/participants";

export async function GET(request: Request) {
  return routeHandler(request, async (requestId) => {
    const viewer = await requireApiAdmin();
    const url = new URL(request.url);
    const input = participantListSchema.parse(Object.fromEntries(url.searchParams));
    return apiSuccess(await listParticipants(viewer, input), requestId);
  });
}

export async function POST(request: Request) {
  return routeHandler(request, async (requestId) => {
    if (!hasTrustedOrigin(request)) throw new DomainError("ORIGIN_REJECTED", "请求来源无效", 403);
    const viewer = await requireApiAdmin();
    const input = createParticipantSchema.parse(await request.json());
    const result = await createParticipant(viewer, input, requireIdempotencyKey(request), requestId);
    return apiSuccess(result, requestId, 201);
  });
}
