import type { StatsHostMessage, StatsWebviewMessage } from "@/statsTabTypes";

import { applyData, applyLoading, initialStatsState } from "./model";
import { createStatsView } from "./view";

// The global declaration types the graph's messages; this tab has its own.
const host = acquireVsCodeApi() as unknown as {
  postMessage(msg: StatsWebviewMessage): void;
};
const root = document.getElementById("statsTab") ?? document.body;
let state = initialStatsState();

const view = createStatsView(root, {
  onRefresh: () => {
    host.postMessage({ command: "refresh" });
  }
});

window.addEventListener("message", (event: MessageEvent<unknown>) => {
  if (event.origin !== globalThis.location.origin) return;
  const message = event.data as Partial<StatsHostMessage> | null;
  if (message?.command === "statsLoading") {
    state = applyLoading(state, message as Extract<StatsHostMessage, { command: "statsLoading" }>);
    view.render(state);
  } else if (message?.command === "statsData") {
    state = applyData(state, message as Extract<StatsHostMessage, { command: "statsData" }>);
    view.render(state);
  }
});
view.render(state);
host.postMessage({ command: "ready" });
