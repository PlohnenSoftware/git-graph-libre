import * as fs from "node:fs";
import { git, makeRepo } from "@tests/backend/helpers";
import { afterEach, describe, expect, it } from "vitest";
import { type EngineAddon, loadEngineAddon, withEngineLogging } from "@/backend/engine/addon";
import { createRepoReader } from "@/backend/engine/index";
import {
  logBackendRoute,
  operationContext,
  setOperationLog,
  traceBackend,
  traceRequest
} from "@/backend/utils/operationLog";
import { inspectRepository } from "@/backend/utils/repositoryProbe";
import { probeGit } from "@/extension/componentStatus";

let log: ReturnType<typeof setOperationLog> | undefined;
afterEach(() => log?.dispose());

function capture() {
  const lines: string[] = [];
  log = setOperationLog((line) => lines.push(line));
  return lines;
}

describe("operation logging", () => {
  it("keeps request IDs and client IDs separate across overlapping native and CLI work", async () => {
    const lines = capture();
    let release = () => {};
    const wait = new Promise<void>((resolve) => {
      release = resolve;
    });
    const first = traceRequest("loadCommits", 17, async () => {
      await wait;
      logBackendRoute("loadCommits", "backend=cli reason=handedBack");
      return traceBackend("cli", "commits", "/one", async () => "first");
    });
    const second = traceRequest("loadRepoInfo", 18, async () => {
      await traceBackend("engine", "repoInfo", "/two", async () => "second");
      release();
    });
    await Promise.all([first, second]);
    const firstId = /request=(\d+)/.exec(lines[0])?.[1];
    const secondId = /request=(\d+)/.exec(lines[1])?.[1];
    expect(firstId).toBeDefined();
    expect(secondId).toBeDefined();
    expect(firstId).not.toBe(secondId);
    for (const line of lines.filter(
      (line) => line.startsWith("[backend:cli]") || line.startsWith("[route]")
    )) {
      expect(line).toContain(`request=${firstId} command=loadCommits clientRequest=17`);
    }
    for (const line of lines.filter((line) => line.startsWith("[backend:engine]"))) {
      expect(line).toContain(`request=${secondId} command=loadRepoInfo clientRequest=18`);
    }
    expect(lines.filter((line) => line.includes(" completed "))).toHaveLength(2);
    expect(operationContext()).toBe("request=background");
  });

  it("logs failed operations and requests without copying sensitive exception text", async () => {
    const lines = capture();
    const failure = new Error("https://user:secret@example.test/repo");
    await expect(
      traceRequest("loadCommits", 4, () =>
        traceBackend("cli", "commits", "/repo", async () => {
          throw failure;
        })
      )
    ).rejects.toBe(failure);
    expect(lines.filter((line) => / failed \d+ms$/.test(line))).toHaveLength(2);
    expect(lines.join("\n")).not.toContain("secret");
    expect(lines.join("\n")).not.toContain(" ok ");
  });

  it("logs a failed Git version probe as failed even though the public probe resolves", async () => {
    const lines = capture();
    const result = await probeGit("/nonexistent/ggl-git");
    expect(result.state).toBe("failed");
    expect(lines).toHaveLength(2);
    expect(lines[1]).toMatch(/operation=gitVersion .* failed \d+ms$/);
  });

  it("wraps addon methods once, preserves their receiver, and leaves sync lifecycle methods synchronous", async () => {
    const lines = capture();
    const addon = {
      engineVersion: () => "test",
      openRepositoryCount: () => 3,
      async remoteUrl() {
        expect(this).toBe(addon);
        return "https://user:secret@example.test/repo";
      }
    } as unknown as EngineAddon;
    const wrapped = withEngineLogging(addon);
    expect(withEngineLogging(wrapped)).toBe(wrapped);
    expect(withEngineLogging(addon)).toBe(wrapped);
    expect(wrapped.engineVersion()).toBe("test");
    expect(wrapped.openRepositoryCount()).toBe(3);
    await wrapped.remoteUrl("/repo", "origin");
    expect(lines).toHaveLength(2);
    expect(lines[0]).toContain("[backend:engine]");
    expect(lines.join("\n")).not.toContain("secret");
  });

  it.each(["engine", "setting", "missing", "declined", "failed"] as const)(
    "records the actual calls and routing for %s reads",
    async (route) => {
      const repo = makeRepo();
      try {
        git(["remote", "add", "origin", "https://user:secret@example.test/repo"], repo);
        const lines = capture();
        const addon = {
          async remoteUrl() {
            if (route === "declined") throw new Error("Unsupported: test");
            if (route === "failed") throw new Error("corrupt repo");
            return "https://example.test/native";
          }
        } as unknown as EngineAddon;
        const reader = createRepoReader({
          preference: route === "setting" ? "git-cli" : "auto",
          gitPath: "git",
          addonProvider: () => (route === "missing" ? null : addon)
        });
        await traceRequest("getRemoteUrl", null, () => reader.getRemoteUrl(repo));
        const calls = lines.filter(
          (line) => line.startsWith("[backend:") && line.endsWith(" started")
        );
        expect(calls.map((line) => line.split("]", 1)[0])).toEqual(
          route === "declined"
            ? ["[backend:engine", "[backend:cli"]
            : [route === "setting" || route === "missing" ? "[backend:cli" : "[backend:engine"]
        );
        if (["setting", "missing", "declined"].includes(route)) {
          expect(lines.some((line) => line.startsWith("[route]"))).toBe(true);
        }
        if (route === "failed") expect(lines.some((line) => line.includes(" failed "))).toBe(true);
        expect(lines.join("\n")).not.toContain("secret");
      } finally {
        fs.rmSync(repo, { recursive: true, force: true });
      }
    }
  );

  it.skipIf(!loadEngineAddon()?.repoRoot)("traces real native discovery only once", async () => {
    const repo = makeRepo();
    try {
      const lines = capture();
      const result = await inspectRepository(repo, {
        gitPath: "/nonexistent/ggl-git",
        useEngine: true
      });
      expect(result.repository).toBe(true);
      const native = lines.filter((line) => line.startsWith("[backend:engine]"));
      expect(native).toHaveLength(2);
      expect(native[0]).toContain("operation=repoRoot");
    } finally {
      loadEngineAddon()?.closeRepository(repo);
      fs.rmSync(repo, { recursive: true, force: true });
    }
  });
});
