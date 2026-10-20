import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { COAUTHOR_AGENTS, CONTRIBUTOR_ERAS } from "@/webview/contributors";

const ROOT = resolve(__dirname, "../..");

// A roster line is indented two spaces: a name, a gap of two or more spaces,
// then a date (`2026-07-01`). Names contain single spaces only.
const ROSTER_LINE = /^ {2}(\S(?:\S| (?=\S))*?) {2,}\d{4}-\d{2}-\d{2}/;

function rosterNames(file: string) {
  const names = new Set<string>();
  for (const line of readFileSync(resolve(ROOT, file), "utf8").split("\n")) {
    const name = ROSTER_LINE.exec(line)?.[1];
    if (name !== undefined) names.add(name);
  }
  return names;
}

const credited = new Set(CONTRIBUTOR_ERAS.flatMap((era) => era.people));

describe("contributors data", () => {
  it("finds the rosters it is checked against", () => {
    expect(rosterNames("NOTICE.md").size).toBeGreaterThanOrEqual(3);
    expect(rosterNames("LICENSE.mit").size).toBeGreaterThanOrEqual(10);
  });

  it.each(["NOTICE.md", "LICENSE.mit"])("credits every person in the %s roster", (file) => {
    for (const name of rosterNames(file)) expect(credited).toContain(name);
  });

  it("credits nobody the rosters do not name", () => {
    const rostered = new Set([...rosterNames("NOTICE.md"), ...rosterNames("LICENSE.mit")]);
    for (const name of credited) expect(rostered).toContain(name);
  });

  it("contains no @ and no email-shaped string", () => {
    const text = JSON.stringify({ CONTRIBUTOR_ERAS, COAUTHOR_AGENTS });
    expect(text).not.toContain("@");
    expect(text).not.toMatch(/\S+\s*\[?at\]?\s*\S+\.\w{2,}/i);
  });

  it("does not list dependabot as an agent", () => {
    const names = COAUTHOR_AGENTS.map((agent) => agent.name.toLowerCase());
    expect(names.some((name) => name.includes("dependabot"))).toBe(false);
  });
});
