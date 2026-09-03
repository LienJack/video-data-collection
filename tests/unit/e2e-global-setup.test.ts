import { beforeEach, describe, expect, it, vi } from "vitest";
import { prepareDeterministicDemo } from "@/tests/e2e/global-setup";

const runCommand = vi.fn();

describe("Playwright deterministic demo setup", () => {
  beforeEach(() => {
    runCommand.mockReset();
  });

  it("does not seed when the deterministic graph already verifies", () => {
    runCommand.mockReturnValueOnce({ status: 0 });

    prepareDeterministicDemo(runCommand);

    expect(runCommand).toHaveBeenCalledTimes(1);
    expect(runCommand).toHaveBeenCalledWith("pnpm", ["db:test:seed"], expect.any(Object));
  });

  it("attempts the guarded empty-graph seed fallback before re-verifying", () => {
    runCommand
      .mockReturnValueOnce({ status: 1 })
      .mockReturnValueOnce({ status: 0 })
      .mockReturnValueOnce({ status: 0 });

    prepareDeterministicDemo(runCommand);

    expect(runCommand.mock.calls.map(([, args]) => args)).toEqual([
      ["db:test:seed"],
      ["db:seed"],
      ["db:test:seed"],
    ]);
  });

  it("stops before the second verification when the empty-graph seed guard holds", () => {
    runCommand
      .mockReturnValueOnce({ status: 1 })
      .mockReturnValueOnce({ status: 1 });

    expect(() => prepareDeterministicDemo(runCommand)).toThrow("db:seed failed before Playwright");
    expect(runCommand).toHaveBeenCalledTimes(2);
  });
});
