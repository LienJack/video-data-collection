import { createHash, randomUUID } from "node:crypto";
import { z } from "zod";
import {
  MAX_FILE_SIZE_BYTES,
  STORAGE_BUCKET,
} from "@/src/domain/constants";

export const uploadExtensionSchema = z.enum(["mp4", "mov", "insv"]);
export type UploadExtension = z.infer<typeof uploadExtensionSchema>;

export const uploadContentTypeSchema = z.enum([
  "video/mp4",
  "video/quicktime",
  "application/octet-stream",
]);

const contentTypeByExtension: Record<UploadExtension, z.infer<typeof uploadContentTypeSchema>> = {
  mp4: "video/mp4",
  mov: "video/quicktime",
  insv: "application/octet-stream",
};

export const createUploadIntentInputSchema = z.object({
  batchPublicId: z.string().regex(/^UB-[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{6,16}$/),
  originalFilename: z.string().min(1).max(1024),
  sizeBytes: z.number().int().min(1).max(MAX_FILE_SIZE_BYTES),
  contentType: uploadContentTypeSchema,
  extension: uploadExtensionSchema,
  localModifiedAt: z.string().datetime({ offset: true }).nullable(),
  claimedSessionPublicId: z.string()
    .regex(/^RS-[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{6,16}$/)
    .nullable(),
  unableToDetermine: z.boolean(),
  fingerprintV1: z.string().regex(/^[a-f0-9]{64}$/),
  participantNote: z.string().trim().max(500).nullable().optional(),
}).superRefine((input, context) => {
  if (contentTypeByExtension[input.extension] !== input.contentType) {
    context.addIssue({
      code: "custom",
      path: ["contentType"],
      message: "文件扩展名与 MIME 不匹配",
    });
  }
  if (Boolean(input.claimedSessionPublicId) === input.unableToDetermine) {
    context.addIssue({
      code: "custom",
      path: ["claimedSessionPublicId"],
      message: "必须选择一个 Session 或 Unable to Determine",
    });
  }
});

export function sanitizeOriginalFilename(value: string): string {
  const leaf = value.replaceAll("\\", "/").split("/").at(-1) ?? "";
  const safe = leaf
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .normalize("NFKC")
    .trim();
  if (!safe) return "unnamed-upload";
  return [...safe].slice(0, 255).join("");
}

export function createUploadObjectKey(input: {
  studyId: string;
  participantId: string;
  uploadId: string;
  extension: UploadExtension;
}): string {
  return [
    "study",
    input.studyId,
    "participant",
    input.participantId,
    "upload",
    input.uploadId,
    `${randomUUID()}.${input.extension}`,
  ].join("/");
}

export function fingerprintV1(
  sizeBytes: number,
  firstMegabyte: Uint8Array,
  lastMegabyte: Uint8Array,
): string {
  const size = Buffer.alloc(8);
  size.writeBigUInt64BE(BigInt(sizeBytes));
  return createHash("sha256")
    .update(size)
    .update(firstMegabyte)
    .update(lastMegabyte)
    .digest("hex");
}

export function uploadMetadata(objectKey: string, contentType: string) {
  return {
    bucketName: STORAGE_BUCKET,
    objectName: objectKey,
    contentType,
    cacheControl: "3600",
  };
}
