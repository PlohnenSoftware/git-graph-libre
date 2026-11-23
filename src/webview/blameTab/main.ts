import type { BlameHostMessage, BlameWebviewMessage } from "@/blameTabTypes";

import { normalizeGutterWidth } from "./columnResize";
import {
  applyData,
  applyHotspotMode,
  applyLoading,
  applyRepoChanged,
  type BlameViewState,
  initialBlameState,
  normalizeHotspotMode
} from "./rowModel";
import { createBlameView } from "./view";

// The global declaration types the graph's messages; this tab has its own.
const host = acquireVsCodeApi() as unknown as {
  postMessage(msg: BlameWebviewMessage): void;
  getState(): unknown;
  setState(state: unknown): void;
};
const root = document.getElementById("blameTab") ?? document.body;

/**
 * The webview's saved state: the gutter width per repository, and the
 * hotspot mode the user last chose. Both survive a reload or restore.
 */
const saved = host.getState() as {
  gutterWidthByRepo?: Record<string, unknown>;
  hotspotMode?: unknown;
} | null;
let state = initialBlameState(normalizeHotspotMode(saved?.hotspotMode));

/**
 * The gutter width the user dragged, per repository like the graph's
 * `columnWidths`. The graph keeps its set in its per-repository view
 * state on the extension host; this tab has no such store of its own,
 * so its widths live in the webview's saved state — the retained panel
 * pattern — which survives the document being reloaded or restored.
 */
const widthByRepo = new Map<string, number>();
for (const [repo, raw] of Object.entries(saved?.gutterWidthByRepo ?? {})) {
  const width = normalizeGutterWidth(raw);
  if (width !== null) widthByRepo.set(repo, width);
}

/** Writes both saved values; each save keeps the other as it is. */
function persist(): void {
  host.setState({
    gutterWidthByRepo: Object.fromEntries(widthByRepo),
    hotspotMode: state.hotspotMode
  });
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
    persist();
  },
  onHotspotModeChange: (mode) => {
    state = applyHotspotMode(state, mode);
    persist();
    view.render(state);
  },
  onBlameHead: () => host.postMessage({ command: "blameHead" }),
  onBlameLatest: () => host.postMessage({ command: "blameLatest" }),
  onOpenFile: () => host.postMessage({ command: "openFile" }),
  onRewind: (target) => {
    host.postMessage({
      command: "rewind",
      rev: target.rev,
      filePath: target.filePath,
      targetLine: target.targetLine
    });
  },
  onNavigate: (direction) => {
    host.postMessage({ command: "navigate", direction });
  },
  onOptionsChange: (options, targetLine) => {
    host.postMessage({ command: "setOptions", options, targetLine });
  },
  onIgnoreCommit: (commitHash, targetLine) => {
    host.postMessage({ command: "ignoreCommit", commitHash, targetLine });
  },
  onClearIgnoredCommit: (commitHash, targetLine) => {
    host.postMessage({ command: "clearIgnoredCommit", commitHash, targetLine });
  },
  onLoadCommitPopover: (commitHash, requestId) => {
    host.postMessage({ command: "loadCommitPopover", commitHash, requestId });
  },
  onShowCommitInGraph: (commitHash) => {
    host.postMessage({ command: "showCommitInGraph", commitHash });
  },
  onOpenCommitFileDiff: (request) => {
    host.postMessage({ command: "openCommitFileDiff", ...request });
  },
  onOpenFileAtLine: (line) => {
    host.postMessage({ command: "openFileAtLine", line });
  },
  onCopyText: (kind, commitHash) => {
    host.postMessage({ command: "copyText", kind, commitHash });
  },
  onFindStateChange: (next) => {
    state = next;
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
  } else if (message?.command === "blameRepoChanged") {
    state = applyRepoChanged(
      state,
      message as Extract<BlameHostMessage, { command: "blameRepoChanged" }>
    );
    view.render(state);
  } else if (message?.command === "blameCommitPopover") {
    view.applyCommitPopover(
      message as Extract<BlameHostMessage, { command: "blameCommitPopover" }>
    );
  }
});
view.render(state);
host.postMessage({ command: "ready" });
