import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { RequestMessage } from "@/types";
import { createFailureScreenReporter } from "@/webview/failureScreen";

let reporter: ReturnType<typeof createFailureScreenReporter>;
let sent: RequestMessage[];
function visible(value: boolean) {
  Object.defineProperty(document, "hidden", { value: !value, configurable: true });
  document.dispatchEvent(new Event("visibilitychange"));
}
beforeEach(() => {
  sent = [];
  visible(true);
  reporter = createFailureScreenReporter((message) => sent.push(message));
});
afterEach(() => reporter.dispose());

describe("failure screen appearances", () => {
  it("counts repeated failures only after recovery or a different screen", () => {
    reporter.show("graphLoadError");
    reporter.show("graphLoadError");
    reporter.show(null);
    reporter.show("graphLoadError");
    expect(sent).toEqual([
      { command: "failureScreenShown", screen: "graphLoadError" },
      { command: "failureScreenShown", screen: null },
      { command: "failureScreenShown", screen: "graphLoadError" }
    ]);
  });
  it("reports a hidden failure on reveal, and clears recovery even while hidden", () => {
    visible(false);
    reporter.show("graphLoadError");
    expect(sent).toEqual([]);
    visible(true);
    expect(sent).toHaveLength(1);
    visible(false);
    reporter.show(null);
    reporter.show("graphLoadError");
    expect(sent.at(-1)).toEqual({ command: "failureScreenShown", screen: null });
    visible(true);
    expect(sent).toHaveLength(3);
  });
  it("never counts a hidden error that recovered before reveal", () => {
    visible(false);
    reporter.show("graphLoadError");
    reporter.show(null);
    visible(true);
    expect(sent).toEqual([]);
  });
  it("stops observing visibility after disposal", () => {
    visible(false);
    reporter.show("graphLoadError");
    reporter.dispose();
    visible(true);
    expect(sent).toEqual([]);
  });
});
