import { z } from "zod";
import { decodeCreatedAtCursor } from "@egocapture/core/server/cursor";

const tabSchema = z.enum(["videos", "sessions", "activity"]);
const transferStatusSchema = z.enum(["created", "uploading", "reconciling", "verified", "failed", "aborted", "expired"]);
const metadataStatusSchema = z.enum(["pending", "processing", "extracted", "partial", "unsupported", "failed"]);
const attentionSchema = z.enum(["open"]);
const sessionStatusSchema = z.enum(["open", "closed", "all"]);
const activityCategorySchema = z.enum(["task", "participant", "assignment", "session", "upload", "metadata", "review", "system"]);

export type RecordsTab = z.infer<typeof tabSchema>;

type SharedRecordsQuery = {
  search?: string;
  cursor?: string;
};

export type VideoRecordsQuery = SharedRecordsQuery & {
  tab: "videos";
  transferStatus?: z.infer<typeof transferStatusSchema>;
  metadataStatus?: z.infer<typeof metadataStatusSchema>;
  attention?: z.infer<typeof attentionSchema>;
};

export type SessionRecordsQuery = SharedRecordsQuery & {
  tab: "sessions";
  status: z.infer<typeof sessionStatusSchema>;
};

export type ActivityRecordsQuery = SharedRecordsQuery & {
  tab: "activity";
  category?: z.infer<typeof activityCategorySchema>;
};

export type RecordsQuery = VideoRecordsQuery | SessionRecordsQuery | ActivityRecordsQuery;
export type RawRecordsSearchParams = Record<string, string | string[] | undefined>;

function firstString(value: string | string[] | undefined) {
  return typeof value === "string" ? value : undefined;
}

function optionalText(value: string | string[] | undefined, max: number) {
  const parsed = z.string().trim().min(1).max(max).safeParse(firstString(value));
  return parsed.success ? parsed.data : undefined;
}

function optionalEnum<T extends z.ZodEnum>(schema: T, value: string | string[] | undefined): z.infer<T> | undefined {
  const parsed = schema.safeParse(firstString(value));
  return parsed.success ? parsed.data : undefined;
}

function optionalCursor(value: string | string[] | undefined) {
  const cursor = optionalText(value, 512);
  if (!cursor) return undefined;
  try {
    decodeCreatedAtCursor(cursor);
    return cursor;
  } catch {
    return undefined;
  }
}

export function parseRecordsQuery(params: RawRecordsSearchParams): RecordsQuery {
  const tab = optionalEnum(tabSchema, params.tab) ?? "videos";
  const shared = {
    search: optionalText(params.search, 160),
    cursor: optionalCursor(params.cursor),
  };

  if (tab === "sessions") {
    return {
      tab,
      ...shared,
      status: optionalEnum(sessionStatusSchema, params.status) ?? "open",
    };
  }

  if (tab === "activity") {
    return {
      tab,
      ...shared,
      category: optionalEnum(activityCategorySchema, params.category),
    };
  }

  return {
    tab,
    ...shared,
    transferStatus: optionalEnum(transferStatusSchema, params.transferStatus),
    metadataStatus: optionalEnum(metadataStatusSchema, params.metadataStatus),
    attention: optionalEnum(attentionSchema, params.attention),
  };
}

export function recordsHref(query: RecordsQuery, cursor?: string | null) {
  const params = new URLSearchParams({ tab: query.tab });
  if (query.search) params.set("search", query.search);
  if (query.tab === "videos") {
    if (query.transferStatus) params.set("transferStatus", query.transferStatus);
    if (query.metadataStatus) params.set("metadataStatus", query.metadataStatus);
    if (query.attention) params.set("attention", query.attention);
  } else if (query.tab === "sessions") {
    params.set("status", query.status);
  } else if (query.category) {
    params.set("category", query.category);
  }
  if (cursor) params.set("cursor", cursor);
  return `/records?${params.toString()}`;
}
