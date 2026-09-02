import { describe, expect, it } from "vitest";
import {
  auditActionLabel,
  auditEntityLabel,
  changedAuditFields,
  matchDecisionLabel,
  recordHealth,
  resolvedSessionForDisplay,
  transferStatusLabel,
} from "../../apps/admin-web/lib/record-presenters";
import { parseRecordsQuery, recordsHref } from "../../apps/admin-web/lib/records-query";

describe("records workspace query", () => {
  it("falls back to videos and ignores invalid or oversized values", () => {
    expect(parseRecordsQuery({
      tab: "unknown",
      transferStatus: "not-a-status",
      metadataStatus: "not-a-status",
      attention: "all",
      search: "x".repeat(161),
      cursor: "not-a-cursor",
    })).toEqual({ tab: "videos", search: undefined, cursor: undefined, transferStatus: undefined, metadataStatus: undefined, attention: undefined });
  });

  it("defaults sessions to open and preserves delayed-upload history filters", () => {
    const query = parseRecordsQuery({ tab: "sessions", status: "all", search: " RS-23456789 " });
    expect(query).toEqual({ tab: "sessions", status: "all", search: "RS-23456789", cursor: undefined });
    expect(recordsHref(query, "next-page")).toBe("/records?tab=sessions&search=RS-23456789&status=all&cursor=next-page");
    expect(parseRecordsQuery({ tab: "sessions", status: "invalid" })).toMatchObject({ tab: "sessions", status: "open" });
  });

  it("keeps only activity filters when the activity tab is selected", () => {
    const cursor = Buffer.from(JSON.stringify({ createdAt: "2026-09-02T00:00:00.000Z", publicId: "event-id" }), "utf8").toString("base64url");
    const query = parseRecordsQuery({ tab: "activity", category: "review", transferStatus: "failed", cursor });
    expect(query).toEqual({ tab: "activity", category: "review", search: undefined, cursor });
    expect(recordsHref(query, query.cursor)).toBe(`/records?tab=activity&category=review&cursor=${cursor}`);
  });
});

describe("record presenters", () => {
  it("uses Chinese labels with lossless fallback for unknown evidence", () => {
    expect(transferStatusLabel("verified")).toBe("上传已验证");
    expect(matchDecisionLabel("unmatched")).toBe("尚未匹配");
    expect(auditActionLabel("session.closed")).toBe("关闭录制会话");
    expect(auditEntityLabel("recording_session")).toBe("录制会话");
    expect(auditActionLabel("future.action")).toBe("future.action");
    expect(auditEntityLabel("future_entity")).toBe("future_entity");
  });

  it("shows the current resolved Session without falling back after rejection", () => {
    expect(resolvedSessionForDisplay("participant_claim", "RS-23456789")).toBe("RS-23456789");
    expect(resolvedSessionForDisplay("admin_corrected", "RS-23456782")).toBe("RS-23456782");
    expect(resolvedSessionForDisplay("rejected", "RS-23456789")).toBeNull();
    expect(resolvedSessionForDisplay("rejected", null)).toBeNull();
  });

  it("prioritizes review and failed states in record health", () => {
    expect(recordHealth({ transferStatus: "verified", metadataStatus: "extracted", decisionType: "participant_claim", reviewCount: 0 }).tone).toBe("ready");
    expect(recordHealth({ transferStatus: "uploading", metadataStatus: "pending", decisionType: null, reviewCount: 0 }).tone).toBe("progress");
    expect(recordHealth({ transferStatus: "verified", metadataStatus: "extracted", decisionType: "participant_claim", reviewCount: 2 }).tone).toBe("attention");
  });

  it("summarizes only changed audit fields", () => {
    expect(changedAuditFields({ status: "open", dueAt: "a" }, { status: "closed", dueAt: "a", taskPublicId: "TSK-23456789" }))
      .toEqual(["状态", "采集任务"]);
  });
});
