import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { getWebviewLocalizedStrings } from "@/extension/webviewL10n";
import { buildWebviewStatusStrip } from "@/extension/webviewStatusStrip";
import type { ComponentStatus } from "@/types";
import {
  applyComponentStatus,
  COMPONENT_STATUS_HOVER_DELAY_MS,
  componentRows,
  initComponentStatus,
  resetComponentStatus
} from "@/webview/componentStatus";

// The popup's links post through the shared webview API, which is acquired
// when its module loads; hoisting puts the stand-in ahead of the import above.
const posted = vi.hoisted(() => {
  const messages: unknown[] = [];
  (globalThis as unknown as { acquireVsCodeApi: () => unknown }).acquireVsCodeApi = () => ({
    postMessage: (message: unknown) => messages.push(message),
    getState: () => undefined,
    setState: () => {}
  });
  return messages;
});

const ACTIVE: ComponentStatus = {
  git: { state: "ok", path: "git", version: "git version 2.51.0" },
  engine: { state: "active", version: "1.0.25", platform: "linux-x64" },
  graphLoad: "engine"
};

const UNAVAILABLE: ComponentStatus = {
  git: { state: "ok", path: "git", version: "git version 2.51.0" },
  engine: {
    state: "unavailable",
    reason: "loadFailed",
    platform: "linux-x64",
    detail: "libc.so.6: cannot open shared object file"
  },
  graphLoad: "unavailable"
};

function summary(): HTMLElement {
  const element = document.getElementById("statusSummary");
  if (element === null) throw new Error("no status summary");
  return element;
}

function popup(): HTMLElement | null {
  return document.getElementById("componentStatusPopup");
}

function isOpen(): boolean {
  const element = popup();
  return element !== null && !element.hidden;
}

function rowTexts(): string[][] {
  return [...(popup()?.querySelectorAll(".componentStatusRow") ?? [])].map((row) =>
    [...row.children].map((cell) => cell.textContent ?? "")
  );
}

describe("status indicator popup", () => {
  const requestStatus = vi.fn();

  beforeEach(() => {
    vi.useFakeTimers();
    const strings = getWebviewLocalizedStrings();
    (globalThis as unknown as { l10n: typeof strings }).l10n = strings;
    document.body.innerHTML = buildWebviewStatusStrip(strings, "1.8.1", "active");
    requestStatus.mockClear();
    resetComponentStatus();
    initComponentStatus(requestStatus);
  });

  afterEach(() => {
    resetComponentStatus();
    vi.useRealTimers();
  });

  it("asks for fresh answers at once but opens only after a long hover", () => {
    summary().dispatchEvent(new MouseEvent("mouseenter"));
    expect(requestStatus).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(COMPONENT_STATUS_HOVER_DELAY_MS - 1);
    expect(isOpen()).toBe(false);

    vi.advanceTimersByTime(1);
    expect(isOpen()).toBe(true);
    expect(popup()?.getAttribute("role")).toBe("tooltip");
    expect(summary().getAttribute("aria-describedby")).toBe("componentStatusPopup");
  });

  it("links to the diagnostics report and the log file, and each link sends its message", () => {
    summary().dispatchEvent(new FocusEvent("focus"));
    posted.length = 0;

    const links = [
      ...(popup()?.querySelectorAll<HTMLAnchorElement>(".componentStatusLinks a") ?? [])
    ];
    expect(links.map((link) => link.textContent)).toEqual([
      "Copy diagnostics report",
      "Open log file"
    ]);
    const click = new MouseEvent("click", { cancelable: true });
    links[0]?.dispatchEvent(click);
    links[1]?.click();

    expect(click.defaultPrevented).toBe(true);
    expect(posted).toEqual([{ command: "copyDiagnostics" }, { command: "openLogFile" }]);
  });

  it("keeps the links when an answer re-renders the open popup", () => {
    summary().dispatchEvent(new FocusEvent("focus"));
    applyComponentStatus(ACTIVE);

    expect(popup()?.querySelectorAll(".componentStatusLinks a")).toHaveLength(2);
  });

  it("shows nothing when the pointer only passes over the indicator", () => {
    summary().dispatchEvent(new MouseEvent("mouseenter"));
    vi.advanceTimersByTime(COMPONENT_STATUS_HOVER_DELAY_MS / 2);
    summary().dispatchEvent(new MouseEvent("mouseleave"));
    vi.advanceTimersByTime(COMPONENT_STATUS_HOVER_DELAY_MS * 2);

    expect(isOpen()).toBe(false);
  });

  it("says every row is being checked until the first answer arrives", () => {
    summary().dispatchEvent(new FocusEvent("focus"));

    expect(rowTexts()).toEqual([
      ["Git CLI", "Checking…"],
      ["Rust engine", "Checking…"],
      ["Last graph load", "Checking…"]
    ]);
  });

  it("re-renders in place when an answer arrives while open", () => {
    summary().dispatchEvent(new FocusEvent("focus"));
    applyComponentStatus(ACTIVE);

    expect(popup()?.querySelector(".componentStatusTitle")?.textContent).toBe("Components");
    expect(rowTexts()).toEqual([
      ["Git CLI", "git version 2.51.0", "git"],
      ["Rust engine", "Active, version 1.0.25 (linux-x64)"],
      ["Last graph load", "Rust engine"]
    ]);
    expect(popup()?.querySelector(".componentStatusNote")).toBeNull();
  });

  it("explains an unavailable engine, with the loader's detail and the fallback note", () => {
    applyComponentStatus(UNAVAILABLE);
    summary().dispatchEvent(new FocusEvent("focus"));

    expect(rowTexts()).toEqual([
      ["Git CLI", "git version 2.51.0", "git"],
      [
        "Rust engine",
        "Unavailable: the binary could not be loaded (linux-x64)",
        "libc.so.6: cannot open shared object file"
      ],
      ["Last graph load", "Git CLI (Rust engine unavailable)"]
    ]);
    expect(popup()?.querySelector(".componentStatusNote")?.textContent).toBe(
      "Everything still works through the Git CLI, only slower."
    );
  });

  it("promises no fallback when the Git CLI itself is not working", () => {
    applyComponentStatus({
      ...UNAVAILABLE,
      git: { state: "failed", path: "/opt/git/bin/git", detail: "spawn /opt/git/bin/git EACCES" }
    });
    summary().dispatchEvent(new FocusEvent("focus"));

    expect(popup()?.querySelector(".componentStatusNote")).toBeNull();
    // The configured path is named even when the error text does not say it.
    expect(rowTexts()[0]).toEqual([
      "Git CLI",
      "Not working: spawn /opt/git/bin/git EACCES",
      "/opt/git/bin/git"
    ]);
  });

  it("recolors the indicator from every answer, open or not", () => {
    applyComponentStatus(UNAVAILABLE);
    expect(document.getElementById("statusStrip")?.dataset.engine).toBe("unavailable");
    applyComponentStatus({ ...ACTIVE, engine: { state: "off" } });
    expect(document.getElementById("statusStrip")?.dataset.engine).toBe("off");
  });

  it("stays open while the pointer crosses into the popup, and closes after it leaves", () => {
    summary().dispatchEvent(new MouseEvent("mouseenter"));
    vi.advanceTimersByTime(COMPONENT_STATUS_HOVER_DELAY_MS);
    summary().dispatchEvent(new MouseEvent("mouseleave"));
    popup()?.dispatchEvent(new MouseEvent("mouseenter"));
    vi.advanceTimersByTime(1000);
    expect(isOpen()).toBe(true);

    popup()?.dispatchEvent(new MouseEvent("mouseleave"));
    vi.advanceTimersByTime(1000);
    expect(isOpen()).toBe(false);
    expect(summary().hasAttribute("aria-describedby")).toBe(false);
  });

  it("opens at once on focus, and closes on Escape or blur", () => {
    summary().dispatchEvent(new FocusEvent("focus"));
    expect(isOpen()).toBe(true);
    expect(requestStatus).toHaveBeenCalledTimes(1);

    summary().dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    expect(isOpen()).toBe(false);

    summary().dispatchEvent(new FocusEvent("focus"));
    summary().dispatchEvent(new FocusEvent("blur"));
    expect(isOpen()).toBe(false);
  });

  it("keeps the popup when focus leaves while the pointer is over it", () => {
    // Clicking into the popup to select its text blurs the indicator.
    summary().dispatchEvent(new FocusEvent("focus"));
    popup()?.dispatchEvent(new MouseEvent("mouseenter"));
    summary().dispatchEvent(new FocusEvent("blur"));

    expect(isOpen()).toBe(true);
  });

  it("never parses outside text as markup", () => {
    applyComponentStatus({
      ...ACTIVE,
      git: { state: "failed", path: "git", detail: "<img src=x onerror=alert(1)>" }
    });
    summary().dispatchEvent(new FocusEvent("focus"));

    expect(popup()?.querySelector("img")).toBeNull();
    expect(rowTexts()[0]).toEqual(["Git CLI", "Not working: <img src=x onerror=alert(1)>", "git"]);
  });
});

describe("componentRows", () => {
  beforeEach(() => {
    const strings = getWebviewLocalizedStrings();
    (globalThis as unknown as { l10n: typeof strings }).l10n = strings;
  });

  it.each([
    ["setting", "Git CLI (backend setting is git-cli)"],
    ["forced", "Git CLI (reloaded once from the Hidden menu)"],
    ["unverified", "Git CLI (Git has not confirmed this repository yet)"],
    ["handedBack", "Git CLI (handed back by the Rust engine)"],
    ["topoOrdering", "Git CLI (topological order is selected)"],
    ["reflog", "Git CLI (reflog commits are included)"],
    ["unreachableCommits", "Git CLI (unreachable commits are included)"],
    ["globPattern", "Git CLI (a branch glob pattern is selected)"]
  ] as const)("names the %s route, as a neutral row", (route, text) => {
    const row = componentRows({ ...ACTIVE, graphLoad: route })[2];
    expect(row).toEqual({ label: "Last graph load", value: text, tone: "neutral" });
  });

  it("tones each component by what it means for the user", () => {
    expect(componentRows(ACTIVE).map((row) => row.tone)).toEqual(["ok", "ok", "ok"]);
    expect(componentRows(UNAVAILABLE).map((row) => row.tone)).toEqual(["ok", "warning", "warning"]);
    const off = componentRows({ ...ACTIVE, engine: { state: "off" }, graphLoad: "setting" });
    expect(off.map((row) => row.tone)).toEqual(["ok", "neutral", "neutral"]);
    expect(off[1]?.value).toBe("Off: the backend setting is git-cli");
    const broken = componentRows({
      ...ACTIVE,
      git: { state: "failed", path: "git", detail: "spawn git ENOENT" }
    });
    expect(broken[0]).toEqual({
      label: "Git CLI",
      value: "Not working: spawn git ENOENT",
      tone: "error",
      detail: "git"
    });
  });

  it.each([
    ["unsupportedPlatform", "Unavailable: no build for this platform (linux-arm)"],
    ["missing", "Unavailable: not included in this installation (linux-arm)"],
    ["versionMismatch", "Unavailable: the binary is from a different build (linux-arm)"],
    ["incompatible", "Unavailable: the binary is incompatible (linux-arm)"]
  ] as const)("words the %s reason", (reason, text) => {
    const row = componentRows({
      ...UNAVAILABLE,
      engine: { state: "unavailable", reason, platform: "linux-arm", detail: null }
    })[1];
    expect(row?.value).toBe(text);
  });

  it("reports a session with no graph load yet", () => {
    expect(componentRows({ ...ACTIVE, graphLoad: null })[2]?.value).toBe("No graph loaded yet");
  });
});
