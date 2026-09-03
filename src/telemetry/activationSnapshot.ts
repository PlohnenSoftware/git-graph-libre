/**
 * Builds the payload for the once-per-session `activate` event.
 *
 * Pure, so it is testable without VS Code.
 *
 * The question this answers is "which settings does anyone actually touch",
 * which is the only reliable way to find settings that are pure maintenance
 * debt. It therefore records **whether** a setting was explicitly set, never
 * what it was set to.
 *
 * That distinction is not cosmetic. Several settings hold user-supplied
 * strings — `customBranchGlobPatterns` can contain fragments of real branch
 * names, and `graphColors` is free-form — so sending values would leak user
 * content through a channel that promises not to.
 */

import type { TelemetryEventPayload } from "./eventQueue";

/** Prefix stripped from manifest keys so the property names stay short. */
const CONFIGURATION_PREFIX = "git-graph-libre.";

/**
 * Bound on the per-setting flags. The ingest keeps 64 properties per event and
 * VS Code injects a dozen of its own, so leave room rather than have the
 * server silently truncate.
 */
export const MAX_SETTING_FLAGS = 40;

export function buildActivationPayload(
  explicitSettings: Record<string, unknown>
): TelemetryEventPayload {
  // Sorted so the truncation below is deterministic rather than dependent on
  // object insertion order.
  const keys = Object.keys(explicitSettings).sort((a, b) => a.localeCompare(b));

  const payload: TelemetryEventPayload = { settingsChanged: keys.length };

  for (const key of keys.slice(0, MAX_SETTING_FLAGS)) {
    const shortKey = key.startsWith(CONFIGURATION_PREFIX)
      ? key.slice(CONFIGURATION_PREFIX.length)
      : key;
    // Value deliberately omitted — presence only. See the note above.
    payload[`setting.${shortKey}`] = true;
  }

  return payload;
}
