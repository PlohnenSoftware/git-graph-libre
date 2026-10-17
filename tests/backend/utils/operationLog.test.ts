import * as fs from "node:fs";
import { git, makeRepo } from "@tests/backend/helpers";
import { simpleGit } from "simple-git";
import { afterEach, describe, expect, it } from "vitest";
import { type EngineAddon, loadEngineAddon, withEngineLogging } from "@/backend/engine/addon";
import { createRepoReader } from "@/backend/engine/index";
import { formatGitCommandRecord } from "@/backend/utils/gitCommandLog";
import {
  logBackendRoute,
  operationContext,
  runDetached,
  setOperationLog,
  traceBackend,
  traceRequest
} from "@/backend/utils/operationLog";
import { inspectRepository } from "@/backend/utils/repositoryProbe";
import { probeGit } from "@/extension/componentStatus";
import { webviewBridgeFactory } from "@/extension/webviewBridge";

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

  // The reader is built inside the request, as the bridge does it, so every
  // line it writes — routing included — carries that request's id.
  const ROUTE_LINES = {
    engine: null,
    setting: "operation=reader backend=cli reason=setting",
    unverified: "operation=reader backend=cli reason=unverified",
    missing: "operation=fallback backend=cli reason=engineUnavailable",
    declined: "operation=remoteUrl backend=cli reason=engineDeclined kind=Unsupported",
    failed: "operation=remoteUrl result=failed reason=engineFailed"
  } as const;

  it.each(Object.keys(ROUTE_LINES) as (keyof typeof ROUTE_LINES)[])(
    "records the actual calls and routing for %s reads",
    async (route) => {
      const repo = makeRepo();
      try {
        git(["remote", "add", "origin", "https://user:secret@example.test/repo"], repo);
        const lines = capture();
        let engineCalls = 0;
        const addon = {
          async remoteUrl() {
            engineCalls += 1;
            if (route === "declined") throw new Error("Unsupported: test");
            if (route === "failed") throw new Error("corrupt repo");
            return "https://example.test/native";
          }
        } as unknown as EngineAddon;
        await traceRequest("getRemoteUrl", 7, () =>
          createRepoReader({
            preference: route === "setting" ? "git-cli" : "auto",
            gitPath: "git",
            addonProvider: () => (route === "missing" ? null : addon),
            unverified: route === "unverified"
          }).getRemoteUrl(repo)
        );
        const calls = lines.filter(
          (line) => line.startsWith("[backend:") && line.endsWith(" started")
        );
        const viaCli = ["setting", "unverified", "missing"].includes(route);
        expect(calls.map((line) => line.split("]", 1)[0])).toEqual(
          route === "declined"
            ? ["[backend:engine", "[backend:cli"]
            : [viaCli ? "[backend:cli" : "[backend:engine"]
        );
        if (viaCli) expect(engineCalls).toBe(0);
        const routes = lines.filter((line) => line.startsWith("[route]"));
        const expected = ROUTE_LINES[route];
        if (expected === null) {
          expect(routes).toEqual([]);
        } else {
          expect(routes).toEqual([
            expect.stringMatching(
              new RegExp(
                `^\\[route\\] request=\\d+ command=getRemoteUrl clientRequest=7 ${expected}$`
              )
            )
          ]);
        }
        expect(lines.join("\n")).not.toContain("secret");
      } finally {
        fs.rmSync(repo, { recursive: true, force: true });
      }
    }
  );

  it("fails a read the engine answers with a payload it cannot read, and says why", async () => {
    const repo = makeRepo();
    try {
      const lines = capture();
      const addon = { loadRepoInfo: async () => "not json" } as unknown as EngineAddon;
      const result = await createRepoReader({
        preference: "auto",
        gitPath: "git",
        addonProvider: () => addon
      }).loadRepoInfo({ repoPath: repo, showStashes: false, git: simpleGit(repo) });
      expect(result.error).not.toBeNull();
      expect(lines).toContainEqual(
        expect.stringContaining("operation=loadRepoInfo result=failed reason=malformedPayload")
      );
    } finally {
      fs.rmSync(repo, { recursive: true, force: true });
    }
  });

  it("keeps overlapping webview requests apart from the bridge down", async () => {
    const lines = capture();
    let deliver: ((msg: unknown) => Promise<void>) | undefined;
    const webview = {
      onDidReceiveMessage: (listener: (msg: unknown) => Promise<void>) => {
        deliver = listener;
      },
      postMessage: async () => true
    };
    const bridge = webviewBridgeFactory(webview as never, { mute() {}, unmute() {} } as never);
    const gates: Record<string, () => void> = {};
    for (const command of ["loadCommits", "loadRepoInfo"] as const) {
      bridge.onMessage(command, async () => {
        await new Promise<void>((resolve) => {
          gates[command] = resolve;
        });
        await traceBackend("cli", command, "/repo", async () => "");
      });
    }

    const first = deliver?.({ command: "loadCommits", requestId: 11 });
    const second = deliver?.({ command: "loadRepoInfo", requestId: 22 });
    // Released in the opposite order to arrival, so only the async context —
    // not the order of events — can tell the two apart.
    gates.loadRepoInfo?.();
    gates.loadCommits?.();
    await Promise.all([first, second]);

    const ids = (command: string) =>
      new Set(
        lines
          .filter((line) => line.includes(`command=${command} `))
          .map((line) => /request=(\d+)/.exec(line)?.[1])
      );
    expect(ids("loadCommits").size).toBe(1);
    expect(ids("loadRepoInfo").size).toBe(1);
    expect([...ids("loadCommits")][0]).not.toBe([...ids("loadRepoInfo")][0]);
    expect(lines).toContainEqual(
      expect.stringMatching(/^\[backend:cli\] request=\d+ command=loadCommits clientRequest=11 /)
    );
    expect(lines).toContainEqual(
      expect.stringMatching(/^\[backend:cli\] request=\d+ command=loadRepoInfo clientRequest=22 /)
    );
  });

  it("logs work a request merely started, such as a timer, as background", async () => {
    const seen = await traceRequest(
      "fetchAvatar",
      null,
      () =>
        new Promise<string>((resolve) => {
          runDetached(() => setTimeout(() => resolve(operationContext()), 0));
        })
    );
    expect(seen).toBe("request=background");
  });

  it("stamps Git command records with the request that ran them", async () => {
    const line = await traceRequest("loadBranches", 5, async () =>
      formatGitCommandRecord({
        label: "loadBranches",
        kind: "query",
        repo: "/repo",
        args: ["branch"],
        durationMs: 1,
        success: true,
        error: null
      })
    );
    expect(line).toMatch(/ request=\d+ command=loadBranches clientRequest=5 repo=/);
  });

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
