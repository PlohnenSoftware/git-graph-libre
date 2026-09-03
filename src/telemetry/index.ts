/**
 * Telemetry reporter.
 *
 * The whole compliance story lives in one call: `env.createTelemetryLogger()`
 * gates on `vscode.env.isTelemetryEnabled` and scrubs paths, file URIs, and
 * usernames before the sender ever sees the data. Never bypass it by calling
 * `fetch` from feature code.
 *
 * Two switches must both be on before anything is sent:
 *
 *  1. VS Code's global telemetry setting, enforced by the logger itself. It
 *     always wins — if it is off, nothing is sent even when ours is on.
 *  2. `git-graph-libre.telemetry.enabled`, ours, checked per call so toggling
 *     it takes effect immediately without rebuilding anything.
 */

import * as vscode from "vscode";

import type { Config } from "@/config";
import type { Logger } from "@/extension/utils/logger";

import { TELEMETRY_ENDPOINT } from "./endpoint";
import { createTelemetrySender } from "./sender";

/** Sent once per session. Carries environment plus the settings snapshot. */
export const EVENT_ACTIVATE = "activate";
/** Sent per feature invocation. Carries `{ feature, ok }`. */
export const EVENT_FEATURE = "feature";

export type TelemetryReporter = {
  /** Records one feature invocation and whether it succeeded. */
  logFeature: (feature: string, ok: boolean) => void;
  /** Records the once-per-session activation event. */
  logActivate: (data: Record<string, unknown>) => void;
  dispose: () => void;
};

/** Used when telemetry cannot run, so callers never need a null check. */
function createNoopReporter(): TelemetryReporter {
  return {
    logFeature: () => {},
    logActivate: () => {},
    dispose: () => {}
  };
}

export type TelemetryReporterOptions = {
  config: Pick<Config, "telemetryEnabled">;
  /** Overridden in tests; defaults to the compiled-in endpoint. */
  endpoint?: string;
  logger?: Logger;
};

export function createTelemetryReporter(options: TelemetryReporterOptions): TelemetryReporter {
  const endpoint = options.endpoint ?? TELEMETRY_ENDPOINT;
  if (endpoint === "") {
    options.logger?.log("[telemetry] disabled (no endpoint configured)");
    return createNoopReporter();
  }

  options.logger?.log(`[telemetry] ingest ${endpoint} (sending still gated by both settings)`);

  const sender = createTelemetrySender({ endpoint });

  // ignoreUnhandledErrors is required by the sender's no-op sendErrorData:
  // without it VS Code routes every unhandled extension-host error into the
  // sender, and the ingest accepts only `activate` and `feature`. The two
  // settings have to change together.
  const logger = vscode.env.createTelemetryLogger(sender, { ignoreUnhandledErrors: true });

  function enabled(): boolean {
    return options.config.telemetryEnabled();
  }

  return {
    logFeature(feature, ok) {
      if (!enabled()) return;
      logger.logUsage(EVENT_FEATURE, { feature, ok });
    },

    logActivate(data) {
      if (!enabled()) return;
      logger.logUsage(EVENT_ACTIVATE, data);
    },

    dispose() {
      // Disposing the logger flushes the sender. The extension host can also be
      // killed outright, in which case the pending batch is lost — accepted
      // deliberately, rather than persisting a queue and replaying stale events
      // weeks later.
      logger.dispose();
      void sender.dispose();
    }
  };
}
