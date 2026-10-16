import { describe, expect, it } from "vitest";

import { getWebviewLocalizedStrings } from "@/extension/webviewL10n";
import { buildWebviewStatusStrip } from "@/extension/webviewStatusStrip";
import type { EngineComponentStatus } from "@/types";
import { setEngineState, setStatusStrip } from "@/webview/statusStrip";

function renderStatusStrip(
  strings = getWebviewLocalizedStrings(),
  version = "1.2.0",
  engine: EngineComponentStatus["state"] = "active"
) {
  document.body.innerHTML = buildWebviewStatusStrip(strings, version, engine);
}

describe("webview status strip", () => {
  it("renders a polite ready status by default", () => {
    renderStatusStrip();

    const strip = document.getElementById("statusStrip");
    expect(strip?.tagName).toBe("SECTION");
    expect(strip?.getAttribute("role")).toBe("status");
    expect(strip?.getAttribute("aria-label")).toBe("Git Graph status");
    expect(strip?.getAttribute("aria-live")).toBe("polite");
    expect(strip?.getAttribute("aria-busy")).toBe("false");
    expect(strip?.dataset.state).toBe("ready");
    expect(document.getElementById("statusText")?.textContent).toBe("Ready");
  });

  it("updates busy and error states without replacing the shell", () => {
    renderStatusStrip();

    setStatusStrip("loading", "Refreshing graph");
    expect(document.getElementById("statusStrip")?.dataset.state).toBe("loading");
    expect(document.getElementById("statusStrip")?.getAttribute("aria-busy")).toBe("true");
    expect(document.getElementById("statusText")?.textContent).toBe("Refreshing graph");

    setStatusStrip("action", "Pushing Tag...");
    expect(document.getElementById("statusStrip")?.dataset.state).toBe("action");
    expect(document.getElementById("statusStrip")?.getAttribute("aria-busy")).toBe("true");
    expect(document.getElementById("statusText")?.textContent).toBe("Pushing Tag...");

    setStatusStrip("error", "Unable to push tag");
    expect(document.getElementById("statusStrip")?.dataset.state).toBe("error");
    expect(document.getElementById("statusStrip")?.getAttribute("aria-busy")).toBe("false");
    expect(document.getElementById("statusText")?.textContent).toBe("Unable to push tag");
  });

  it("escapes localized labels before embedding them in status markup", () => {
    renderStatusStrip({
      ...getWebviewLocalizedStrings(),
      statusStrip: 'Status <script>alert("x")</script>',
      statusReady: "Ready <bad>"
    });

    expect(document.querySelector("script")).toBeNull();
    expect(document.getElementById("statusStrip")?.getAttribute("aria-label")).toBe(
      'Status <script>alert("x")</script>'
    );
    expect(document.getElementById("statusText")?.textContent).toBe("Ready <bad>");
  });

  it("renders the extension version on the right of the readiness status", () => {
    renderStatusStrip(getWebviewLocalizedStrings(), "1.2.0");

    const version = document.getElementById("statusVersion");
    expect(version?.textContent).toBe("v1.2.0");
    expect(version?.getAttribute("title")).toContain("1.2.0");
    // A version containing markup must not reach the DOM as HTML.
    renderStatusStrip(getWebviewLocalizedStrings(), "1.2.0<img src=x onerror=alert(1)>");
    expect(document.querySelector("#statusVersion img")).toBeNull();
    expect(document.getElementById("statusVersion")?.textContent).toBe(
      "v1.2.0<img src=x onerror=alert(1)>"
    );
  });

  it("bakes the engine state in, so the first paint already shows it", () => {
    for (const engine of ["active", "off", "unavailable"] as const) {
      renderStatusStrip(getWebviewLocalizedStrings(), "1.2.0", engine);
      expect(document.getElementById("statusStrip")?.dataset.engine).toBe(engine);
    }
  });

  it("groups the indicator and the status text into one focusable hover target", () => {
    renderStatusStrip();

    const summary = document.getElementById("statusSummary");
    expect(summary?.getAttribute("tabindex")).toBe("0");
    expect(summary?.querySelector("#statusIndicator")).not.toBeNull();
    expect(summary?.querySelector("#statusText")).not.toBeNull();
    // The version stays outside: it has its own title and its own hidden menu.
    expect(summary?.querySelector("#statusVersion")).toBeNull();
  });

  it("carries the unavailable-engine note, escaped, for CSS to reveal", () => {
    renderStatusStrip({
      ...getWebviewLocalizedStrings(),
      statusEngineUnavailable: "(engine <b>gone</b>)"
    });

    const note = document.getElementById("statusEngineNote");
    expect(note?.textContent).toBe("(engine <b>gone</b>)");
    expect(note?.querySelector("b")).toBeNull();
    expect(getWebviewLocalizedStrings().statusEngineUnavailable).toBe("(Rust engine unavailable)");
  });

  it("carries the switched-off engine note, escaped, for CSS to reveal", () => {
    renderStatusStrip({
      ...getWebviewLocalizedStrings(),
      statusEngineOff: "(engine <b>off</b>)"
    });

    const note = document.getElementById("statusEngineOffNote");
    expect(note?.textContent).toBe("(engine <b>off</b>)");
    expect(note?.querySelector("b")).toBeNull();
    expect(getWebviewLocalizedStrings().statusEngineOff).toBe("(Rust off)");
  });

  it("updates the engine state without touching the readiness text", () => {
    renderStatusStrip();

    setEngineState("unavailable");
    expect(document.getElementById("statusStrip")?.dataset.engine).toBe("unavailable");
    expect(document.getElementById("statusText")?.textContent).toBe("Ready");
    setEngineState("off");
    expect(document.getElementById("statusStrip")?.dataset.engine).toBe("off");
  });
});
