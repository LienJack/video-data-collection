import { describe, expect, it } from "vitest";
import { resolveUploadSessionContext } from "../../apps/participant-web/app/(portal)/uploads/upload-session-context";

const sessions = [
  { publicId: "RS-OPEN0001", status: "open", deviceLabel: "Camera A" },
  { publicId: "RS-CLOSED01", status: "closed", deviceLabel: "Camera B" },
];

describe("participant upload Session entry context", () => {
  it("keeps the generic upload flow when the query parameter is absent", () => {
    expect(resolveUploadSessionContext(undefined, sessions)).toEqual({ kind: "generic" });
  });

  it("locks a Session only when it belongs to the participant and is open", () => {
    expect(resolveUploadSessionContext("RS-OPEN0001", sessions)).toEqual({
      kind: "locked",
      session: sessions[0],
    });
  });

  it.each([
    "",
    "RS-CLOSED01",
    "RS-OTHER001",
    ["RS-OPEN0001", "RS-CLOSED01"],
  ])("rejects invalid, closed, unowned, or ambiguous Session input: %j", (value) => {
    expect(resolveUploadSessionContext(value, sessions)).toEqual({ kind: "invalid" });
  });
});
