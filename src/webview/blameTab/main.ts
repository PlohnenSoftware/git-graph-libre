import type { BlameHostMessage, BlameWebviewMessage } from "@/blameTabTypes";

import { normalizeGutterWidth } from "./columnResize";
import { applyData, applyLoading, type BlameViewState, initialBlameState } from "./rowModel";
import { createBlameView } from "./view";

// The global declaration types the graph's messages; this tab has its own.
const host = acquireVsCodeApi() as unknown as {
  postMessage(msg: BlameWebviewMessage): void;
  getState(): unknown;
  setState(state: unknown): void;
};
const root = document.getElementById("blameTab") ?? document.body;
let state = initialBlameState();

/**
 * The gutter width the user dragged, per repository like the graph's
 * `columnWidths`. The graph keeps its set in its per-repository view
 * state on the extension host; this tab has no such store of its own,
 * so its widths live in the webview's saved state — the retained panel
 * pattern — which survives the document being reloaded or restored.
 */
const widthByRepo = new Map<string, number>();
const saved = host.getState() as { gutterWidthByRepo?: Record<string, unknown> } | null;
for (const [repo, raw] of Object.entries(saved?.gutterWidthByRepo ?? {})) {
  const width = normalizeGutterWidth(raw);
  if (width !== null) widthByRepo.set(repo, width);
}

/** A fresh state for a repository picks up its saved gutter width, if any. */
function seedGutterWidth(next: BlameViewState): BlameViewState {
  if (next.gutterWidth !== null || next.repo === "") return next;
  const width = widthByRepo.get(next.repo);
  return width === undefined ? next : { ...next, gutterWidth: width };
}

const view = createBlameView(root, {
  onGutterWidthChange: (gutterWidth) => {
    state = { ...state, gutterWidth };
    widthByRepo.set(state.repo, gutterWidth);
    host.setState({ gutterWidthByRepo: Object.fromEntries(widthByRepo) });
  }
});

window.addEventListener("message", (event: MessageEvent<unknown>) => {
  if (event.origin !== globalThis.location.origin) return;
  const message = event.data as Partial<BlameHostMessage> | null;
  if (message?.command === "blameLoading") {
    state = seedGutterWidth(
      applyLoading(state, message as Extract<BlameHostMessage, { command: "blameLoading" }>)
    );
    view.render(state);
  } else if (message?.command === "blameData") {
    state = seedGutterWidth(
      applyData(state, message as Extract<BlameHostMessage, { command: "blameData" }>)
    );
    view.render(state);
  }
});
view.render(state);
host.postMessage({ command: "ready" });
