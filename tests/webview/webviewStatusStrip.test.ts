import { describe, expect, it } from "vitest";

import { getWebviewLocalizedStrings } from "@/extension/webviewL10n";
import { buildWebviewStatusStrip } from "@/extension/webviewStatusStrip";
import { setStatusStrip } from "@/webview/statusStrip";

function renderStatusStrip(strings = getWebviewLocalizedStrings()) {
  document.body.innerHTML = buildWebviewStatusStrip(strings);
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
});
