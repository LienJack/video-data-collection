import { z } from "zod";
import { DomainError } from "@/src/domain/errors";

const createdAtCursorSchema = z.object({
  createdAt: z.string().datetime(),
  publicId: z.string().min(1).max(80),
});

export type CreatedAtCursor = z.infer<typeof createdAtCursorSchema>;

export function encodeCreatedAtCursor(cursor: { createdAt: Date; publicId: string }) {
  return Buffer.from(JSON.stringify({
    createdAt: cursor.createdAt.toISOString(),
    publicId: cursor.publicId,
  }), "utf8").toString("base64url");
}

export function decodeCreatedAtCursor(value: string | undefined): CreatedAtCursor | null {
  if (!value) return null;
  try {
    return createdAtCursorSchema.parse(JSON.parse(Buffer.from(value, "base64url").toString("utf8")));
  } catch {
    throw new DomainError("INVALID_CURSOR", "分页游标无效", 422);
  }
}
