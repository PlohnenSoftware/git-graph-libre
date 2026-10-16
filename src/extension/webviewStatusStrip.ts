import type { EngineComponentStatus } from "@/types";

import type { LocalizedStrings } from "./webviewL10n";

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

/**
 * The status strip above the toolbar. `engine` is baked in as `data-engine`
 * so the first paint already shows an engine that is not serving reads —
 * the amber indicator and "Rust engine unavailable" note, or the hollow
 * indicator and "Rust off" note, are CSS on that attribute — and the
 * webview updates it from later `componentStatus` messages.
 *
 * The indicator and the status text form one focusable target: hovering it
 * for a moment, or focusing it, opens the component popup. An 8px dot alone
 * would be too small to aim at.
 */
export function buildWebviewStatusStrip(
  l10n: LocalizedStrings,
  version: string,
  engine: EngineComponentStatus["state"]
): string {
  const label = escapeHtml(l10n.statusStrip);
  const ready = escapeHtml(l10n.statusReady);
  const engineNote = escapeHtml(l10n.statusEngineUnavailable);
  const engineOffNote = escapeHtml(l10n.statusEngineOff);
  const versionLabel = escapeHtml(l10n.version);
  const escapedVersion = escapeHtml(version);

  return `<section id="statusStrip" class="statusStrip" role="status" aria-label="${label}" aria-live="polite" aria-atomic="true" aria-busy="false" data-state="ready" data-engine="${engine}">
    <span id="statusSummary" class="statusSummary" tabindex="0">
      <span id="statusIndicator" class="statusIndicator" aria-hidden="true"></span>
      <span id="statusText">${ready}</span>
      <span id="statusEngineNote" class="statusEngineNote">${engineNote}</span>
      <span id="statusEngineOffNote" class="statusEngineNote">${engineOffNote}</span>
    </span>
    <span id="statusVersion" class="statusVersion" title="${versionLabel} ${escapedVersion}">v${escapedVersion}</span>
  </section>`;
}
