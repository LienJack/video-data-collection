import { z } from "zod";
import { buildPageHref, parsePageParam } from "./pagination";

const tabSchema = z.enum(["videos", "sessions", "activity"]);
const transferStatusSchema = z.enum(["created", "uploading", "reconciling", "verified", "failed", "aborted", "expired"]);
const metadataStatusSchema = z.enum(["pending", "processing", "extracted", "partial", "unsupported", "failed"]);
const attentionSchema = z.enum(["open"]);
const sessionStatusSchema = z.enum(["open", "closed", "all"]);
const activityCategorySchema = z.enum(["task", "participant", "assignment", "session", "upload", "metadata", "review", "system"]);

export type RecordsTab = z.infer<typeof tabSchema>;

type SharedRecordsQuery = {
  search?: string;
  page: number;
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

export function parseRecordsQuery(params: RawRecordsSearchParams): RecordsQuery {
  const tab = optionalEnum(tabSchema, params.tab) ?? "videos";
  const shared = {
    search: optionalText(params.search, 160),
    page: parsePageParam(params.page),
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

export function recordsHref(query: RecordsQuery, page = query.page) {
  const params: Record<string, string | undefined> = {
    tab: query.tab,
    search: query.search,
  };
  if (query.tab === "videos") {
    params.transferStatus = query.transferStatus;
    params.metadataStatus = query.metadataStatus;
    params.attention = query.attention;
  } else if (query.tab === "sessions") {
    params.status = query.status;
  } else if (query.category) {
    params.category = query.category;
  }
  return buildPageHref("/records", params, page);
}
