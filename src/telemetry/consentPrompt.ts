/**
 * The telemetry consent question.
 *
 * `git-graph-libre.telemetry.enabled` starts at `unset`, which sends nothing
 * and means the question is still open. This module is what asks it: once on
 * activation, again each time the graph is opened while the answer is still
 * missing, and on demand from the consent screen's **Set now** button.
 * Dismissing the notification is not an answer — the state stays `unset`,
 * nothing is sent, and the question comes back.
 *
 * **Never guard this behind a "one prompt at a time" latch.** An earlier
 * version did, and it broke Set now outright. The workbench makes an Info
 * notification with buttons non-sticky (`get sticky()` requires actions *and*
 * `Severity.Error`), so `PURGE_TIMEOUT[Info]` — 10 seconds — removes the toast
 * on its own. `removeToast()` drops only the toast: the notification stays in
 * the model, `onDidClose` never fires, and the promise from
 * `showInformationMessage` therefore never resolves. Any flag cleared in that
 * promise's `finally` latches on for the rest of the session and silently
 * blocks every later prompt. No latch is needed anyway:
 * `NotificationsModel.addNotification()` closes an identical notification
 * before adding the new one, so at most one of these is ever present.
 *
 * **Button styling is settled, do not re-litigate it.** A plain notification
 * already accents its first button: `renderButtons()` in the workbench builds
 * each one with `{ title: true, secondary: index > 0 }`, so Accept renders as
 * the primary action and Reject as secondary purely from their order. Modality
 * would add nothing to that and would seize the window, so `PROMPT_MODAL`
 * stays `false`; it exists as one flag because the choice is a judgment call
 * that may be revisited, not because the styling is in doubt.
 */

import * as vscode from "vscode";

import type { Config } from "@/config";
import * as l10n from "@/l10n";
import type { TelemetryConsent } from "@/types";

import { TELEMETRY_ENDPOINT } from "./endpoint";

/**
 * Whether to seize the window with a modal dialog instead of a notification.
 *
 * See the note above: `false` is the considered default, and this is the one
 * line to change if that is ever revisited.
 */
const PROMPT_MODAL = false;

/** The setting the answer is written to. */
export const CONSENT_SETTING_KEY = "telemetry.enabled";
/**
 * Where "what is actually sent" is written out in full.
 *
 * Every surface that asks for consent links here — the notification, the gate
 * screen, and the setting description — because a question about data is not
 * answerable without the answer to "which data". Defined once so the three
 * cannot drift apart.
 */
export const TELEMETRY_DISCLOSURE_URL =
  "https://github.com/PlohnenSoftware/git-graph-libre#telemetry";
/** VS Code's own switch, which always wins over ours. */
export const VSCODE_TELEMETRY_SETTING = "telemetry.telemetryLevel";

type MessageOptions = { modal: boolean };

/**
 * Whether the telemetry question is still open and worth putting to the user.
 *
 * Shared by the two surfaces that answer to it — the notification here and the
 * graph-replacing consent screen — so they can never disagree about whether
 * the question is pending. An empty endpoint means telemetry is compiled off,
 * and asking permission for something that cannot happen is noise.
 */
export function isConsentPending(
  consent: TelemetryConsent,
  endpoint: string = TELEMETRY_ENDPOINT
): boolean {
  return endpoint !== "" && consent === "unset";
}

/** The slice of `vscode.window` this needs, so tests need no editor. */
export type ConsentWindowApi = {
  showInformationMessage(
    message: string,
    options: MessageOptions,
    ...items: string[]
  ): Thenable<string | undefined>;
};

export type ConsentPromptDeps = {
  config: Pick<Config, "telemetryConsent">;
  /** Writes the answer. Defaults to the extension's own configuration. */
  updateConsent?: (value: TelemetryConsent) => Thenable<void>;
  /** Reads VS Code's global switch. Defaults to `vscode.env`. */
  isGlobalTelemetryEnabled?: () => boolean;
  window?: ConsentWindowApi;
  openSettings?: (query: string) => Thenable<unknown>;
  /** Opens the disclosure in a browser. Defaults to `vscode.env.openExternal`. */
  openDisclosure?: (url: string) => Thenable<unknown>;
  /** Empty means telemetry is compiled off, so the question is moot. */
  endpoint?: string;
  logger?: { log: (message: string) => void };
};

export type ConsentPrompt = {
  /**
   * Asks the question if it is still open. Resolves once the notification has
   * been answered or dismissed, so callers can `void` it and move on.
   */
  promptIfUnset: () => Promise<void>;
};

function defaultUpdateConsent(value: TelemetryConsent): Thenable<void> {
  // Global on purpose: consent is about this person and this machine, not
  // about whichever repository happens to be open.
  return vscode.workspace
    .getConfiguration("git-graph-libre")
    .update(CONSENT_SETTING_KEY, value, vscode.ConfigurationTarget.Global);
}

export function createConsentPrompt(deps: ConsentPromptDeps): ConsentPrompt {
  const endpoint = deps.endpoint ?? TELEMETRY_ENDPOINT;
  const windowApi: ConsentWindowApi = deps.window ?? vscode.window;
  const updateConsent = deps.updateConsent ?? defaultUpdateConsent;
  const isGlobalTelemetryEnabled =
    deps.isGlobalTelemetryEnabled ?? (() => vscode.env.isTelemetryEnabled);
  const openSettings =
    deps.openSettings ??
    ((query: string) => vscode.commands.executeCommand("workbench.action.openSettings", query));
  const openDisclosure =
    deps.openDisclosure ?? ((url: string) => vscode.env.openExternal(vscode.Uri.parse(url)));

  async function confirmGlobalSwitchWins(): Promise<void> {
    if (isGlobalTelemetryEnabled()) return;

    // Accepting while VS Code's switch is off is not a contradiction to
    // correct — it is a preference that cannot take effect yet, and silently
    // storing it would leave the user believing data is being sent.
    const openSetting = l10n.t("telemetry.consent.openGlobalSetting");
    const choice = await windowApi.showInformationMessage(
      l10n.t("telemetry.consent.globalOff"),
      { modal: PROMPT_MODAL },
      openSetting
    );
    if (choice === openSetting) await openSettings(VSCODE_TELEMETRY_SETTING);
  }

  async function ask(): Promise<void> {
    const accept = l10n.t("telemetry.consent.accept");
    const reject = l10n.t("telemetry.consent.reject");
    const details = l10n.t("telemetry.consent.details");

    // Accept is passed first because a notification's first button is its
    // accented one; the order is the styling.
    //
    // The loop exists because clicking the details button closes the
    // notification: the user has gone to read what is collected and has still
    // not answered, so the question has to come back when they return.
    let choice: string | undefined;
    do {
      choice = await windowApi.showInformationMessage(
        l10n.t("telemetry.consent.question"),
        { modal: PROMPT_MODAL },
        accept,
        reject,
        details
      );
      if (choice === details) await openDisclosure(TELEMETRY_DISCLOSURE_URL);
    } while (choice === details);

    if (choice === accept) {
      await updateConsent("enabled");
      await confirmGlobalSwitchWins();
      return;
    }

    if (choice === reject) {
      await updateConsent("disabled");
      return;
    }

    // Dismissed. Left `unset` deliberately: closing a notification is not a
    // decision, and treating it as one would either collect data nobody
    // agreed to or bury the question forever.
    deps.logger?.log("[telemetry] consent prompt dismissed; still unanswered");
  }

  return {
    async promptIfUnset() {
      if (!isConsentPending(deps.config.telemetryConsent(), endpoint)) return;

      try {
        await ask();
      } catch (error: unknown) {
        // A failed settings write must not take activation or a graph open
        // down with it. The state stays `unset`, so the question is asked
        // again rather than lost.
        deps.logger?.log(`[telemetry] consent prompt failed: ${String(error)}`);
      }
    }
  };
}
