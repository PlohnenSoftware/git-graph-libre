import * as cp from "node:child_process";
import * as path from "node:path";

import { describe, expect, it } from "vitest";

const SCRIPT = path.resolve(__dirname, "../../scripts/list-coauthor-agents.mjs");

/** Feeds a synthetic `git log --format=%B%x00` to the script on standard input. */
function listFor(log: string): string {
  const result = cp.spawnSync(process.execPath, [SCRIPT], { input: log, encoding: "utf8" });
  expect(result.status).toBe(0);
  return result.stdout;
}

describe("list-coauthor-agents", () => {
  it("counts trailer names, strips addresses, and never prints one", () => {
    const log = [
      "Subject\n\nCo-Authored-By: Claude Haiku 5.5 <noreply@example.com>\n\0",
      "Subject\n\nco-authored-by:   Codex <codex@example.com>  \n\0",
      "Subject\n\nCO-AUTHORED-BY: Codex\r\n\0",
      "Subject\n\nCo-Authored-By: <only@example.com>\n\0",
      "Subject\n\nCo-Authored-By:\n\0"
    ].join("");
    expect(listFor(log)).toBe("    2  Codex\n    1  Claude Haiku 5.5\n");
  });

  it("ignores lines that only mention the trailer", () => {
    expect(listFor("Not Co-Authored-By: Codex\nSigned-off-by: Someone\n")).toBe("");
  });
});
