import type { DiffTabShowMessage, DiffTabWebviewMessage } from "@/diffTabTypes";

import { buildRows } from "./rowModel";
import { createDiffView } from "./view";

const started = performance.now();
// The global declaration types the graph's messages; this tab has its own.
const host = acquireVsCodeApi() as unknown as { postMessage(msg: DiffTabWebviewMessage): void };
const root = document.getElementById("diffTab") ?? document.body;
let view: ReturnType<typeof createDiffView> | undefined;
let painted = false;

function showText(text: string): void {
  const paragraph = document.createElement("p");
  paragraph.className = "diff-tab-message";
  paragraph.textContent = text;
  root.replaceChildren(paragraph);
}

function show({ payload, layout, lineHeight, tabSize, labels }: DiffTabShowMessage): void {
  view?.dispose();
  view = undefined;
  let rowCount = 0;
  if (payload.kind === "diff") {
    const rows = buildRows(payload.originalLines, payload.modifiedLines, payload.changes, layout);
    view = createDiffView(root, rows, {
      ...labels,
      lineHeight,
      tabSize,
      revealLineCount: layout.revealLineCount
    });
    // Focus the view so F7 and Shift+F7 work without a click first.
    root.focus({ preventScroll: true });
    rowCount = rows.length;
  } else if (payload.kind === "binary") showText(labels.binaryFile);
  else if (payload.kind === "tooLarge") showText(labels.tooLarge);
  else showText(labels.loadError.replace("{0}", payload.message));
  if (!painted) {
    painted = true;
    host.postMessage({ command: "painted", ms: performance.now() - started, rows: rowCount });
  }
}

window.addEventListener("message", (event: MessageEvent<unknown>) => {
  if (event.origin !== globalThis.location.origin) return;
  const message = event.data as Partial<DiffTabShowMessage> | null;
  if (message?.command === "show") show(message as DiffTabShowMessage);
});
host.postMessage({ command: "ready" });
