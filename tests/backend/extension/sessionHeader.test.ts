import { describe, expect, it } from "vitest";
import {
  formatSessionHeader,
  formatUtcOffset,
  logSessionHeader,
  type SessionHeaderFacts
} from "@/extension/sessionHeader";

const FACTS: SessionHeaderFacts = {
  extensionVersion: "1.9.0",
  hostVersion: "1.95.3",
  appName: "Visual Studio Code",
  platform: "linux",
  arch: "x64",
  osRelease: "7.2.2-1-cachyos",
  timezoneOffsetMinutes: -120,
  logFilePath: "/logs/git-graph-libre.log",
  backend: "auto"
};

describe("formatUtcOffset", () => {
  it.each([
    [-120, "+02:00"],
    [0, "+00:00"],
    [300, "-05:00"],
    [-330, "+05:30"]
  ])("writes %i minutes behind UTC as %s", (minutes, text) => {
    expect(formatUtcOffset(minutes)).toBe(text);
  });
});

describe("session header", () => {
  it("states the build, host, machine, log file and backend", () => {
    expect(formatSessionHeader(FACTS)).toEqual([
      '[session] extension=1.9.0 host=1.95.3 app="Visual Studio Code"',
      "[session] platform=linux arch=x64 os=7.2.2 utcOffset=+02:00",
      '[session] logFile="/logs/git-graph-libre.log" backend=auto'
    ]);
  });

  it("reduces the OS release like the telemetry property and names a missing log file", () => {
    const lines = formatSessionHeader({ ...FACTS, osRelease: "", logFilePath: undefined });
    expect(lines[1]).toContain("os=unknown");
    expect(lines[2]).toContain("logFile=null");
    expect(lines.join("\n")).not.toContain("cachyos");
  });

  it("adds the Git version and the engine line once Git answers", async () => {
    const lines: string[] = [];
    await logSessionHeader(FACTS, "git", (line) => lines.push(line), {
      probe: async () => ({ state: "ok", path: "git", version: "git version 2.47.0" }),
      engine: () => ({ state: "active", version: "1.0.25", platform: "linux-x64" })
    });
    expect(lines).toHaveLength(5);
    expect(lines[3]).toBe('[session] git path="git" version="git version 2.47.0"');
    expect(lines[4]).toBe("[session] engine Rust engine 1.0.25 active (linux-x64)");
  });

  it("records an unavailable Git and a git-cli engine instead of throwing", async () => {
    const lines: string[] = [];
    await logSessionHeader({ ...FACTS, backend: "git-cli" }, "/nope", (line) => lines.push(line), {
      probe: async () => ({ state: "failed", path: "/nope", detail: "spawn ENOENT" }),
      engine: () => ({ state: "off" })
    });
    expect(lines[3]).toBe('[session] git path="/nope" unavailable="spawn ENOENT"');
    expect(lines[4]).toContain("Rust engine off");
  });

  it("keeps the header lines when the status read itself throws", async () => {
    const lines: string[] = [];
    await logSessionHeader(FACTS, "git", (line) => lines.push(line), {
      probe: async () => {
        throw new Error("boom");
      }
    });
    expect(lines).toHaveLength(4);
    expect(lines[3]).toBe("[session] component status skipped: Error: boom");
  });
});
