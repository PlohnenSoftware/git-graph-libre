import type { ReflogHostMessage, ReflogWebviewMessage } from "@/reflogTabTypes";

import { applyData, applyLoading, initialReflogState, markLoadingMore } from "./rowModel";
import { createReflogView } from "./view";

// The global declaration types the graph's messages; this tab has its own.
const host = acquireVsCodeApi() as unknown as { postMessage(msg: ReflogWebviewMessage): void };
const root = document.getElementById("reflogTab") ?? document.body;
let state = initialReflogState();

const view = createReflogView(root, {
  onLoadMore: () => {
    if (state.loadingMore || !state.hasMore) return;
    state = markLoadingMore(state);
    view.render(state);
    host.postMessage({ command: "loadMore" });
  }
});

window.addEventListener("message", (event: MessageEvent<unknown>) => {
  if (event.origin !== globalThis.location.origin) return;
  const message = event.data as Partial<ReflogHostMessage> | null;
  if (message?.command === "reflogLoading") {
    state = applyLoading(
      state,
      message as Extract<ReflogHostMessage, { command: "reflogLoading" }>
    );
    view.render(state);
  } else if (message?.command === "reflogData") {
    state = applyData(state, message as Extract<ReflogHostMessage, { command: "reflogData" }>);
    view.render(state);
  }
});
view.render(state);
host.postMessage({ command: "ready" });
