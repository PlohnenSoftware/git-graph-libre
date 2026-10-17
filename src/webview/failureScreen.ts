import type { FailureScreen, RequestMessage } from "@/types";

/** Count appearances, including errors first rendered in a hidden tab. */
export function createFailureScreenReporter(send: (message: RequestMessage) => void) {
  let current: FailureScreen | null = null;
  let reported: FailureScreen | null = null;
  function report() {
    if (current === reported || (current !== null && document.hidden)) return;
    reported = current;
    send({ command: "failureScreenShown", screen: current });
  }
  document.addEventListener("visibilitychange", report);
  return {
    show(screen: FailureScreen | null) {
      current = screen;
      report();
    },
    dispose() {
      document.removeEventListener("visibilitychange", report);
    }
  };
}
