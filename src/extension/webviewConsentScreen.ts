import { TELEMETRY_DISCLOSURE_URL } from "@/telemetry/consentPrompt";

import type { LocalizedStrings } from "./webviewL10n";

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

/**
 * The screen shown instead of the graph while the telemetry question is open.
 *
 * Maintainer decision (`2026-09-02`): an unanswered question replaces the whole
 * graph rather than sitting in a banner above it. The banner was easy to read
 * past, and the point is that the extension is waiting on a choice — so it
 * borrows the existing full-page message surface (`body.unableToLoad`, the
 * no-repository screen) and says so in the middle of the view.
 *
 * The document deliberately carries no graph, no toolbar and no `web.min.js`:
 * nothing is loaded, so nothing has to be torn down when the answer arrives.
 * Switching to the graph is a document rebuild, which is exactly what the
 * placeholder → graph swap already does elsewhere in `webviewPanel.ts`.
 *
 * **Set now** is the escape hatch, and it is why blocking the graph stays
 * recoverable: dismissing the notification leaves the answer unset, and
 * without a way back the user would be stuck looking at this screen. The
 * button posts `showTelemetryConsent`, which re-opens the same notification.
 */
export function buildTelemetryConsentScreen(
  l10n: LocalizedStrings,
  nonce: string,
  styleVars: string
): string {
  const title = escapeHtml(l10n.telemetryConsentTitle);
  const undecided = escapeHtml(l10n.telemetryUndecided);
  const hint = escapeHtml(l10n.telemetryConsentHint);
  const setNow = escapeHtml(l10n.telemetrySetNow);
  const details = escapeHtml(l10n.telemetryWhatIsSent);

  return `<body class="unableToLoad telemetryConsent" style="${styleVars}">
		<h2>${title}</h2>
		<p>${undecided}</p>
		<p>${hint}</p>
		<div class="telemetryConsentActions">
			<button id="telemetryConsentBtn" class="telemetryConsentBtn" type="button">${setNow}</button>
		</div>
		<p class="telemetryConsentDetails">
			<!-- A plain anchor on purpose: VS Code opens http(s) links from a
			     webview in the browser, so this needs no script and no message. -->
			<a href="${TELEMETRY_DISCLOSURE_URL}">${details}</a>
		</p>
		<script nonce="${nonce}">
			const telemetryConsentApi = acquireVsCodeApi();
			document.getElementById("telemetryConsentBtn").addEventListener("click", () => {
				telemetryConsentApi.postMessage({ command: "showTelemetryConsent" });
			});
		</script>
		</body>`;
}
