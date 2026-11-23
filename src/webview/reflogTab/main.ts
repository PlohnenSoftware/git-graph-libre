import type { ReflogHostMessage, ReflogWebviewMessage } from "@/reflogTabTypes";

import { normalizeColumnWidths } from "./columnResize";
import {
  applyData,
  applyLoading,
  applyLostCommits,
  initialReflogState,
  markLoadingMore,
  type ReflogViewState
} from "./rowModel";
import { createReflogView } from "./view";

// The global declaration types the graph's messages; this tab has its own.
const host = acquireVsCodeApi() as unknown as {
  postMessage(msg: ReflogWebviewMessage): void;
  getState(): unknown;
  setState(state: unknown): void;
};
const root = document.getElementById("reflogTab") ?? document.body;
let state = initialReflogState();

/**
 * The widths the user dragged, per repository like the graph's
 * `columnWidths`. The graph keeps its set in its per-repository view
 * state on the extension host; this tab has no such store of its own,
 * so its set lives in the webview's saved state — the retained panel
 * pattern — which survives the document being reloaded or restored.
 */
const widthsByRepo = new Map<string, number[]>();
const saved = host.getState() as { columnWidthsByRepo?: Record<string, unknown> } | null;
for (const [repo, raw] of Object.entries(saved?.columnWidthsByRepo ?? {})) {
  const widths = normalizeColumnWidths(raw);
  if (widths !== null) widthsByRepo.set(repo, widths);
}

/** A fresh state for a repository picks up its saved widths, if any. */
function seedColumnWidths(next: ReflogViewState): ReflogViewState {
  if (next.columnWidths !== null || next.repo === "") return next;
  const widths = widthsByRepo.get(next.repo);
  return widths === undefined ? next : { ...next, columnWidths: [...widths] };
}

/** Keystrokes settle this long before a search is asked for. */
const SEARCH_DEBOUNCE_MS = 250;
let searchTimer: ReturnType<typeof setTimeout> | undefined;

const view = createReflogView(root, {
  onQueryChange: (query, mode) => {
    state = { ...state, query };
    if (searchTimer !== undefined) clearTimeout(searchTimer);
    if (mode === "search") {
      searchTimer = setTimeout(() => {
        searchTimer = undefined;
        host.postMessage({ command: "query", query: state.query });
      }, SEARCH_DEBOUNCE_MS);
      return;
    }
    searchTimer = undefined;
    host.postMessage({ command: "query", query });
  },
  onLoadMore: () => {
    if (state.loadingMore || !state.hasMore) return;
    state = markLoadingMore(state);
    view.render(state);
    host.postMessage({ command: "loadMore" });
  },
  onColumnWidthsChange: (columnWidths) => {
    state = { ...state, columnWidths };
    widthsByRepo.set(state.repo, columnWidths);
    host.setState({ columnWidthsByRepo: Object.fromEntries(widthsByRepo) });
  },
  onScanLostCommits: () => {
    host.postMessage({ command: "scanLostCommits" });
  },
  onCancelLostCommitsScan: () => {
    host.postMessage({ command: "cancelLostCommitsScan" });
  },
  onCloseLostCommits: () => {
    host.postMessage({ command: "closeLostCommits" });
  },
  onCreateLostCommitBranch: (hash) => {
    host.postMessage({ command: "createLostCommitBranch", hash });
  },
  onAction: (action) => {
    host.postMessage({ command: "action", action });
  },
  onCopyHash: (hash) => {
    host.postMessage({ command: "copyHash", hash });
  },
  onShowInGraph: (hash, enableIncludeReflog) => {
    host.postMessage({ command: "showInGraph", hash, enableIncludeReflog });
  }
});

window.addEventListener("message", (event: MessageEvent<unknown>) => {
  if (event.origin !== globalThis.location.origin) return;
  const message = event.data as Partial<ReflogHostMessage> | null;
  if (message?.command === "reflogLoading") {
    state = seedColumnWidths(
      applyLoading(state, message as Extract<ReflogHostMessage, { command: "reflogLoading" }>)
    );
    view.render(state);
  } else if (message?.command === "reflogData") {
    state = seedColumnWidths(
      applyData(state, message as Extract<ReflogHostMessage, { command: "reflogData" }>)
    );
    view.render(state);
  } else if (message?.command === "reflogLostCommits") {
    state = applyLostCommits(
      state,
      message as Extract<ReflogHostMessage, { command: "reflogLostCommits" }>
    );
    view.render(state);
  } else if (message?.command === "reflogActionResult") {
    view.showActionResult(message as Extract<ReflogHostMessage, { command: "reflogActionResult" }>);
  }
});
view.render(state);
host.postMessage({ command: "ready" });
