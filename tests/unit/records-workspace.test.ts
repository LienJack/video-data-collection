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
      page: "not-a-page",
    })).toEqual({ tab: "videos", search: undefined, page: 1, transferStatus: undefined, metadataStatus: undefined, attention: undefined });
  });

  it("defaults sessions to open and preserves delayed-upload history filters", () => {
    const query = parseRecordsQuery({ tab: "sessions", status: "all", search: " RS-23456789 ", page: "3" });
    expect(query).toEqual({ tab: "sessions", status: "all", search: "RS-23456789", page: 3 });
    expect(recordsHref(query, 2)).toBe("/records?tab=sessions&search=RS-23456789&status=all&page=2");
    expect(parseRecordsQuery({ tab: "sessions", status: "invalid" })).toMatchObject({ tab: "sessions", status: "open" });
  });

  it("keeps only activity filters when the activity tab is selected", () => {
    const query = parseRecordsQuery({ tab: "activity", category: "review", transferStatus: "failed", page: "4" });
    expect(query).toEqual({ tab: "activity", category: "review", search: undefined, page: 4 });
    expect(recordsHref(query)).toBe("/records?tab=activity&category=review&page=4");
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
