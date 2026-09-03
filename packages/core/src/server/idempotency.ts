import "server-only";

import { createHash } from "node:crypto";
import type postgres from "postgres";
import { DomainError } from "@egocapture/core/domain/errors";

type Options<T> = {
  actorAuthUserId: string;
  commandName: string;
  idempotencyKey: string;
  input: unknown;
  execute: () => Promise<T>;
  receiptResponse?: (response: T) => unknown;
  onReplay?: (storedResponse: unknown) => T;
};

export function requireIdempotencyKey(request: Request) {
  const key = request.headers.get("idempotency-key");
  if (!key || !/^[A-Za-z0-9._:-]{8,200}$/.test(key)) {
    throw new DomainError("IDEMPOTENCY_KEY_REQUIRED", "缺少或无效的 Idempotency-Key", 422);
  }
  return key;
}

export async function withIdempotency<T>(db: postgres.TransactionSql, options: Options<T>) {
  const lockKey = `${options.actorAuthUserId}:${options.commandName}:${options.idempotencyKey}`;
  await db`select pg_advisory_xact_lock(hashtext(${lockKey}))`;
  const requestHash = createHash("sha256").update(JSON.stringify(options.input)).digest("hex");
  const [receipt] = await db<{ requestHash: string; responseBody: unknown; expiresAt: Date }[]>`
    select request_hash, response_body, expires_at
    from egocapture.command_receipts
    where actor_auth_user_id = ${options.actorAuthUserId}::uuid
      and command_name = ${options.commandName}
      and idempotency_key = ${options.idempotencyKey}
    limit 1
  `;
  if (receipt && receipt.expiresAt > new Date()) {
    if (receipt.requestHash !== requestHash) {
      throw new DomainError("IDEMPOTENCY_KEY_REUSED", "该 Idempotency-Key 已用于不同请求", 409);
    }
    return options.onReplay ? options.onReplay(receipt.responseBody) : receipt.responseBody as T;
  }
  if (receipt) {
    await db`
      delete from egocapture.command_receipts
      where actor_auth_user_id = ${options.actorAuthUserId}::uuid
        and command_name = ${options.commandName}
        and idempotency_key = ${options.idempotencyKey}
    `;
  }
  const response = await options.execute();
  await db`
    insert into egocapture.command_receipts (
      actor_auth_user_id, command_name, idempotency_key, request_hash, response_status, response_body
    ) values (
      ${options.actorAuthUserId}::uuid,
      ${options.commandName},
      ${options.idempotencyKey},
      ${requestHash},
      200,
      ${db.json((options.receiptResponse ? options.receiptResponse(response) : response) as never)}
    )
  `;
  return response;
}
