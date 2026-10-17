import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { getWebviewLocalizedStrings } from "@/extension/webviewL10n";
import type { RepositoryProbe, RequestMessage, StartupStatus } from "@/types";

import { createVscodeMock } from "./setup";

// The startup bundle touches acquireVsCodeApi at module scope, so the mock
// must exist before the dynamic import evaluates it.
let initStartupScreen: typeof import("@/webview/startup").initStartupScreen;
let startupFailure: typeof import("@/webview/startup").startupFailure;

beforeAll(async () => {
  createVscodeMock(null);
  ({ initStartupScreen, startupFailure } = await import("@/webview/startup"));
});

const l10n = getWebviewLocalizedStrings();

function probe(partial: Partial<RepositoryProbe> = {}): RepositoryProbe {
  return {
    path: "/repo",
    state: "ready",
    repository: true,
    detectedBy: "git",
    detail: null,
    ...partial
  } as RepositoryProbe;
}

function status(partial: Partial<StartupStatus> = {}): StartupStatus {
  return {
    searchDepth: 2,
    roots: ["/ws"],
    repositories: [],
    components: {
      git: { state: "ok", path: "git", version: "2.47.0" },
      engine: { state: "off" },
      graphLoad: null
    },
    error: null,
    ...partial
  } as StartupStatus;
}

function setupDom() {
  document.body.innerHTML = `
    <main>
      <h1 id="startupTitle"></h1>
      <p id="startupSummary"></p>
      <div id="startupRepositories"></div>
      <div id="startupComponents"></div>
      <form id="startupSearchDepth"><input id="repoSearchDepth" type="number" /></form>
      <button id="retryRepositories" type="button">retry</button>
      <button id="openGitSettings" type="button">settings</button>
      <button id="showOutput" type="button">output</button>
    </main>`;
}

function receive(startup: StartupStatus) {
  window.dispatchEvent(
    new MessageEvent("message", { data: { command: "repositoryStatus", startup } })
  );
}

let dispose: (() => void) | undefined;
let sent: RequestMessage[];

beforeEach(() => {
  // The startup bundle reads the page-global l10n (see global.d.ts), exactly
  // as the graph document's injected script provides it.
  (globalThis as unknown as { l10n: typeof l10n }).l10n = l10n;
  setupDom();
  sent = [];
  Object.defineProperty(document, "hidden", { value: false, configurable: true });
});

afterEach(() => {
  dispose?.();
  dispose = undefined;
  vi.useRealTimers();
});

function start() {
  dispose = initStartupScreen((message) => sent.push(message));
}

describe("startupFailure category order", () => {
  it("classifies each evidence shape", () => {
    expect(startupFailure(status({ roots: [] }))).toBe("noWorkspace");
    expect(startupFailure(status({ repositories: [probe({ state: "untrusted" })] }))).toBe(
      "gitUntrusted"
    );
    expect(
      startupFailure(
        status({
          components: {
            git: { state: "failed", path: "git", detail: "missing" },
            engine: { state: "off" },
            graphLoad: null
          } as StartupStatus["components"]
        })
      )
    ).toBe("gitUnavailable");
    expect(startupFailure(status({ error: "boom" }))).toBe("repositoryError");
    expect(startupFailure(status({ repositories: [probe({ state: "notRepository", repository: false })] }))).toBe(
      "noRepository"
    );
  });
});

describe("initStartupScreen", () => {
  it("requests status on init and renders title, evidence and trust action", () => {
    start();
    expect(sent).toEqual([{ command: "repositoryStatus" }]);

    receive(status({ repositories: [probe({ state: "untrusted", detail: "dubious ownership" })] }));

    expect(document.getElementById("startupTitle")?.textContent).toBe(l10n.startupUntrusted);
    expect(document.getElementById("startupRepositories")?.textContent).toContain("/repo");
    expect(document.getElementById("startupRepositories")?.textContent).toContain(
      "dubious ownership"
    );
    const trust = document.querySelector<HTMLButtonElement>(".startupRepository button");
    expect(trust?.textContent).toBe(l10n.startupTrust);
    trust?.click();
    expect(sent).toContainEqual({ command: "trustRepository", repo: "/repo" });
    expect(trust?.disabled).toBe(true);
  });

  it("renders repository paths and details as text, never markup", () => {
    start();
    receive(
      status({
        repositories: [
          probe({ path: "<img src=x onerror=alert(1)>", state: "error", detail: "<b>boom</b>" })
        ]
      })
    );
    const host = document.getElementById("startupRepositories");
    expect(host?.querySelector("img")).toBeNull();
    expect(host?.querySelector("b")).toBeNull();
    expect(host?.textContent).toContain("<img src=x onerror=alert(1)>");
  });

  it("reports each distinct screen once, and only while visible", () => {
    start();
    receive(status());
    receive(status());
    const shown = () =>
      sent.filter((m) => m.command === "failureScreenShown");
    expect(shown()).toEqual([{ command: "failureScreenShown", screen: "noRepository" }]);

    Object.defineProperty(document, "hidden", { value: true, configurable: true });
    receive(status({ roots: [] }));
    expect(shown()).toHaveLength(1);

    Object.defineProperty(document, "hidden", { value: false, configurable: true });
    document.dispatchEvent(new Event("visibilitychange"));
    expect(shown()).toEqual([
      { command: "failureScreenShown", screen: "noRepository" },
      { command: "failureScreenShown", screen: "noWorkspace" }
    ]);
  });

  it("polls while visible and stops after dispose", () => {
    vi.useFakeTimers();
    start();
    expect(sent.filter((m) => m.command === "repositoryStatus")).toHaveLength(1);
    receive(status());
    vi.advanceTimersByTime(5000);
    expect(sent.filter((m) => m.command === "repositoryStatus")).toHaveLength(2);
    dispose?.();
    dispose = undefined;
    receive(status());
    vi.advanceTimersByTime(10000);
    expect(sent.filter((m) => m.command === "repositoryStatus")).toHaveLength(2);
  });

  it("sends only valid search depths", () => {
    start();
    const form = document.getElementById("startupSearchDepth") as HTMLFormElement;
    const input = document.getElementById("repoSearchDepth") as HTMLInputElement;
    for (const bad of ["21", "-1", "1.5", ""]) {
      input.value = bad;
      form.dispatchEvent(new Event("submit", { cancelable: true }));
    }
    expect(sent.filter((m) => m.command === "setRepoSearchDepth")).toEqual([]);
    input.value = "3";
    form.dispatchEvent(new Event("submit", { cancelable: true }));
    expect(sent).toContainEqual({ command: "setRepoSearchDepth", depth: 3 });
  });

  it("shows the depth form only for noRepository and syncs its value when unfocused", () => {
    start();
    receive(status({ searchDepth: 4 }));
    const form = document.getElementById("startupSearchDepth") as HTMLElement;
    const input = document.getElementById("repoSearchDepth") as HTMLInputElement;
    expect(form.hidden).toBe(false);
    expect(input.value).toBe("4");
    receive(status({ roots: [] }));
    expect(form.hidden).toBe(true);
  });
});
