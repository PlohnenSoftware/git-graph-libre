import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { getWebviewLocalizedStrings } from "@/extension/webviewL10n";
import { buildStartupScreen } from "@/extension/webviewStartupScreen";
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
      <button id="openLogFile" type="button">log</button>
      <button id="copyRecentLog" type="button">copy</button>
    </main>`;
}

function receive(startup: StartupStatus) {
  window.dispatchEvent(
    new MessageEvent("message", {
      data: { command: "repositoryStatus", startup },
      origin: window.location.origin
    })
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
    expect(
      startupFailure(
        status({ repositories: [probe({ state: "notRepository", repository: false })] })
      )
    ).toBe("noRepository");
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
    const shown = () => sent.filter((m) => m.command === "failureScreenShown");
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

  it("ignores foreign messages and retries a lost reply without getting stuck", () => {
    vi.useFakeTimers();
    start();
    window.dispatchEvent(
      new MessageEvent("message", {
        origin: "https://foreign.example",
        data: { command: "repositoryStatus", startup: status() }
      })
    );
    expect(sent).toEqual([{ command: "repositoryStatus" }]);
    vi.advanceTimersByTime(10000);
    expect(sent).toHaveLength(1);
    vi.advanceTimersByTime(5000);
    expect(sent).toHaveLength(2);
    document.getElementById("retryRepositories")?.click();
    expect(sent).toHaveLength(3);
  });

  it("sends the log buttons' messages", () => {
    start();
    sent.length = 0;
    document.getElementById("openLogFile")?.click();
    document.getElementById("copyRecentLog")?.click();
    expect(sent).toEqual([{ command: "openLogFile" }, { command: "copyRecentLog" }]);
  });

  it("removes every action listener when disposed", () => {
    start();
    receive(status({ repositories: [probe({ state: "untrusted" })] }));
    dispose?.();
    sent.length = 0;
    document.getElementById("retryRepositories")?.click();
    document.getElementById("openGitSettings")?.click();
    document.getElementById("showOutput")?.click();
    document.getElementById("openLogFile")?.click();
    document.getElementById("copyRecentLog")?.click();
    document.querySelector<HTMLButtonElement>(".startupRepository button")?.click();
    const input = document.getElementById("repoSearchDepth") as HTMLInputElement;
    input.value = "3";
    document
      .getElementById("startupSearchDepth")
      ?.dispatchEvent(new Event("submit", { cancelable: true }));
    expect(sent).toEqual([]);
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

describe("initStartupScreen on the shipped markup", () => {
  // The document the host really builds, not a fixture, so a renamed id or a
  // dropped attribute in it fails here.
  beforeEach(() => {
    const parsed = new DOMParser().parseFromString(
      `<!doctype html><html>${buildStartupScreen(l10n, "")}</html>`,
      "text/html"
    );
    document.body.replaceWith(document.adoptNode(parsed.body));
  });

  function text(id: string) {
    return document.getElementById(id)?.textContent ?? "";
  }

  it("says what Git and the engine observed when Git is missing but the engine found the repository", () => {
    start();
    receive(
      status({
        components: {
          git: { state: "failed", path: "/opt/git", detail: "spawn /opt/git ENOENT" },
          engine: { state: "active", version: "1.0.25", platform: "linux-x64" },
          graphLoad: null
        },
        repositories: [
          probe({
            state: "gitUnavailable",
            repository: true,
            detectedBy: "engine",
            detail: "spawn /opt/git ENOENT"
          })
        ]
      })
    );

    expect(text("startupTitle")).toBe(l10n.startupGitUnavailable);
    // Presence is confirmed, and the screen says it does not make Git optional.
    expect(text("startupRepositories")).toContain(l10n.startupFoundEngine);
    expect(text("startupComponents")).toContain("/opt/git");
    expect(text("startupComponents")).toContain("1.0.25");
    expect(document.querySelector(".startupRepository button")).toBeNull();
    expect(document.getElementById("startupSearchDepth")?.hidden).toBe(true);
  });

  it.each([
    ["absent", { repository: false, state: "notRepository" }, "startupNotFound"],
    ["unknown", { repository: null, state: "error" }, "startupUnknown"],
    ["found by Git", { repository: true, state: "ready" }, "startupFound"]
  ] as const)("words a repository whose presence is %s", (_name, shape, key) => {
    start();
    receive(status({ repositories: [probe(shape as Partial<RepositoryProbe>)] }));
    expect(text("startupRepositories")).toContain(l10n[key]);
  });

  it("frames no workspace and no repository as empty states, not failures", () => {
    start();
    receive(status({ roots: [] }));
    expect(text("startupTitle")).toBe(l10n.startupNoWorkspace);
    expect(text("startupSummary")).toBe(l10n.startupNoWorkspaceHint);

    receive(status({ repositories: [probe({ repository: false, state: "notRepository" })] }));
    expect(text("startupTitle")).toBe(l10n.startupNoRepository);
    expect(text("startupSummary")).toBe(l10n.startupNoRepositoryHint);
    expect(text("startupSummary")).not.toBe(l10n.startupRecoveryHint);

    receive(status({ repositories: [probe({ state: "error", repository: null })] }));
    expect(text("startupSummary")).toBe(l10n.startupRecoveryHint);
  });

  it("offers the depth form only for an empty workspace search, bounded 0 to 20", () => {
    start();
    receive(status({ repositories: [probe({ repository: false, state: "notRepository" })] }));
    const form = document.getElementById("startupSearchDepth");
    const input = document.getElementById("repoSearchDepth") as HTMLInputElement;
    expect(form?.hidden).toBe(false);
    expect(input.value).toBe("2");
    expect([input.min, input.max, input.step, input.required]).toEqual(["0", "20", "1", true]);

    receive(status({ repositories: [probe({ state: "untrusted" })] }));
    expect(form?.hidden).toBe(true);
  });
});
