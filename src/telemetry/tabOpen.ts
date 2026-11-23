/**
 * Open-and-outcome reporting for the extension's editor tabs (maintainer,
 * `2026-11-23`, slice T1): whether a tab was opened — the person clicked its
 * button or ran its command — and whether that went without errors. Nothing
 * about what was looked at, which options were used, or how long anything
 * took is ever reported.
 *
 * Neither existing chokepoint can answer this. `register()` and
 * `registerAction()` see the click, but a tab's panel is created first and
 * its first content loads asynchronously afterwards, so "the handler did not
 * throw" says nothing about whether the tab actually opened. The graph
 * toolbar's buttons do not reach either chokepoint at all. The panel is the
 * one place that knows, so the panel reports — through this helper only, so
 * the call sites stay one fixed id plus one outcome and nothing else can
 * creep into the payload.
 *
 * The contract, which every tab follows:
 *
 * - Exactly one event per open attempt. The panel reports `true` when it was
 *   created or revealed and its first content load did not fail, `false`
 *   when that load failed. An open route that never reaches the panel (no
 *   repository, the tab unavailable, the open itself throwing) reports
 *   `false` instead. Panel refreshes, paging, searches and option changes
 *   afterwards report nothing — they are use, not opening.
 * - The payload is the fixed feature id and `ok`, carried by the ordinary
 *   `feature` event like every other signal. No repository, path, file,
 *   hash, search text, option or count ever joins it, and no entry point is
 *   distinguished: the toolbar button and the palette command share the id.
 * - Feature ids match the ingest's pattern (see `viewFeatures.ts`); a test
 *   asserts it, because one malformed id loses a whole batch.
 *
 * How a new tab joins (the Blame tab, F4-03 onward, and the Statistics tab,
 * F3-02): add its fixed id here (`tab.<name>`), declare it in
 * `telemetry.json` and the README's Telemetry section in the same change,
 * accept `telemetry?: Pick<TelemetryReporter, "logFeature">` in the panel's
 * deps like the two existing panels do, build the reporter once with
 * `createTabOpenReporter(deps.telemetry, TAB_FEATURE_<NAME>)`, call it once
 * when the open's first load settles, and pass the extension's reporter at
 * every assembly site that opens the tab. Consent needs no handling here:
 * `logFeature` itself is silent until the user has answered `enabled`.
 */

import type { TelemetryReporter } from "./index";

/** The Reflog tab was opened; `ok` is its first load's outcome. */
export const TAB_FEATURE_REFLOG = "tab.reflog";
/** The GGL Diff tab was opened; `ok` is its first load's outcome. */
export const TAB_FEATURE_DIFF = "tab.diff";

/** Every tab-open feature id, for the pattern and declaration tests. */
export const TAB_FEATURE_IDS: readonly string[] = [TAB_FEATURE_REFLOG, TAB_FEATURE_DIFF];

/** Reports one tab open's outcome: `true` opened, `false` failed to open. */
export type TabOpenReporter = (ok: boolean) => void;

/**
 * Bind one tab's reporter. With no telemetry wired (a test, a partial
 * assembly) the reporter is a no-op, so panels never need a null check.
 */
export function createTabOpenReporter(
  telemetry: Pick<TelemetryReporter, "logFeature"> | undefined,
  feature: string
): TabOpenReporter {
  // Only the fixed id and the outcome are sent — never anything about the
  // repository, file or options behind the open.
  return (ok) => telemetry?.logFeature(feature, ok);
}
