import { afterEach, describe, expect, it, vi } from "vitest";

import { clearRevealHighlight, startRevealHighlight } from "@/webview/utils/dom";

function makeRow() {
  const row = document.createElement("tr");
  row.className = "commit";
  document.body.appendChild(row);
  return row;
}

describe("reveal highlight DOM helper", () => {
  afterEach(() => {
    clearRevealHighlight();
    document.body.innerHTML = "";
    vi.useRealTimers();
  });

  it("keeps the highlight until the row is dismissed", () => {
    vi.useFakeTimers();
    const row = makeRow();

    startRevealHighlight(row);
    vi.advanceTimersByTime(1_000);

    expect(row.classList.contains("blinking")).toBe(true);
  });

  it.each([
    "mouseenter",
    "click",
    "contextmenu"
  ])("dismisses the highlight on %s and detaches dismissal listeners", (eventName) => {
    const row = makeRow();

    startRevealHighlight(row);
    row.dispatchEvent(new MouseEvent(eventName, { bubbles: true }));

    expect(row.classList.contains("blinking")).toBe(false);

    row.classList.add("blinking");
    row.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    row.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true }));
    row.dispatchEvent(new MouseEvent("mouseenter", { bubbles: true }));

    expect(row.classList.contains("blinking")).toBe(true);
  });

  it("clears an earlier reveal when a new row is highlighted", () => {
    const first = makeRow();
    const second = makeRow();

    startRevealHighlight(first);
    startRevealHighlight(second);

    expect(first.classList.contains("blinking")).toBe(false);
    expect(second.classList.contains("blinking")).toBe(true);
  });
});
