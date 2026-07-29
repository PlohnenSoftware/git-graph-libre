import type { LocalizedStrings } from "./webviewL10n";

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

export function buildWebviewStatusStrip(l10n: LocalizedStrings, version: string): string {
  const label = escapeHtml(l10n.statusStrip);
  const ready = escapeHtml(l10n.statusReady);
  const versionLabel = escapeHtml(l10n.version);
  const escapedVersion = escapeHtml(version);

  return `<section id="statusStrip" class="statusStrip" role="status" aria-label="${label}" aria-live="polite" aria-atomic="true" aria-busy="false" data-state="ready">
    <span id="statusIndicator" class="statusIndicator" aria-hidden="true"></span>
    <span id="statusText">${ready}</span>
    <span id="statusVersion" class="statusVersion" title="${versionLabel} ${escapedVersion}">v${escapedVersion}</span>
  </section>`;
}
