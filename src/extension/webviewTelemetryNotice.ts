import type { TelemetryConsent } from "@/types";

import type { LocalizedStrings } from "./webviewL10n";

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

/**
 * The standing notice that the telemetry question is still open.
 *
 * The consent prompt is a notification, and a notification is easy to miss or
 * dismiss by reflex. This is the ambient half of the answer: while the setting
 * is `unset` the graph itself says that telemetry is neither accepted nor
 * rejected and that nothing is being sent, so the state is never a secret
 * kept by a dialog the user already closed.
 *
 * Deliberately not actionable. The choice belongs to the prompt, which comes
 * back on the next graph open; a second set of Accept/Reject buttons wired to
 * the same setting would be two surfaces to keep in agreement for no gain.
 *
 * The element is always emitted and toggled with `hidden`, so the webview can
 * flip it when the setting changes without rebuilding the document — which
 * would drop the retained graph state.
 */
export function buildTelemetryNotice(l10n: LocalizedStrings, consent: TelemetryConsent): string {
  const message = escapeHtml(l10n.telemetryUndecided);
  const hidden = consent === "unset" ? "" : " hidden";

  return `<section id="telemetryNotice" class="telemetryNotice" role="note"${hidden}>
    <span class="telemetryNoticeText">${message}</span>
  </section>`;
}
