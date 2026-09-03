import { beforeEach, describe, expect, it } from "vitest";

import {
  CONSENT_SETTING_KEY,
  createConsentPrompt,
  TELEMETRY_DISCLOSURE_URL,
  VSCODE_TELEMETRY_SETTING
} from "@/telemetry/consentPrompt";
import type { TelemetryConsent } from "@/types";

import {
  ConfigurationTarget,
  configurationUpdates,
  env,
  executedCommands,
  resetVscodeMock
} from "./__mocks__/vscode";

/**
 * The consent question: shown while the answer is `unset`, and the only place
 * the setting is written on the user's behalf.
 */

type Shown = { message: string; options: { modal: boolean }; items: string[] };

function createWindowStub(answers: Array<string | undefined>) {
  const shown: Shown[] = [];
  return {
    shown,
    api: {
      showInformationMessage(message: string, options: { modal: boolean }, ...items: string[]) {
        shown.push({ message, options, items });
        return Promise.resolve(answers.shift());
      }
    }
  };
}

const ENDPOINT = "https://example.invalid/v1/events";

describe("telemetry consent prompt", () => {
  beforeEach(() => {
    resetVscodeMock();
  });

  function promptFor(
    consent: TelemetryConsent,
    answers: Array<string | undefined>,
    overrides: Partial<Parameters<typeof createConsentPrompt>[0]> = {}
  ) {
    const window = createWindowStub(answers);
    const written: TelemetryConsent[] = [];
    const prompt = createConsentPrompt({
      config: { telemetryConsent: () => consent },
      window: window.api,
      updateConsent: (value) => {
        written.push(value);
        return Promise.resolve();
      },
      endpoint: ENDPOINT,
      ...overrides
    });
    return { prompt, window, written };
  }

  it("asks while the answer is unset", async () => {
    const { prompt, window } = promptFor("unset", ["Accept"]);

    await prompt.promptIfUnset();

    expect(window.shown).toHaveLength(1);
    expect(window.shown[0].message).toContain("anonymous");
  });

  it.each<TelemetryConsent>(["enabled", "disabled"])(
    "never asks again once the answer is %s",
    async (consent) => {
      const { prompt, window, written } = promptFor(consent, ["Accept"]);

      await prompt.promptIfUnset();

      expect(window.shown).toEqual([]);
      expect(written).toEqual([]);
    }
  );

  // The first button of a notification is the accented one, so Accept has to
  // come first: the order IS the styling.
  it("offers Accept first so it renders as the primary action", async () => {
    const { prompt, window } = promptFor("unset", [undefined]);

    await prompt.promptIfUnset();

    expect(window.shown[0].items).toEqual([
      "Accept",
      "Reject and Don't Show Again",
      "What Is Sent?"
    ]);
  });

  it("stays a notification rather than seizing the window", async () => {
    const { prompt, window } = promptFor("unset", [undefined]);

    await prompt.promptIfUnset();

    expect(window.shown[0].options).toEqual({ modal: false });
  });

  it("writes enabled when the user accepts", async () => {
    const { prompt, written } = promptFor("unset", ["Accept"]);

    await prompt.promptIfUnset();

    expect(written).toEqual(["enabled"]);
  });

  // The label promises the asking stops, so the state written has to be the
  // one that stops it: `disabled` is silent AND no longer pending, so neither
  // the notification nor the gate screen comes back.
  // Reading what is collected closes the notification without answering, so
  // the question has to come back rather than being lost to curiosity.
  it("opens the disclosure and asks again", async () => {
    const opened: string[] = [];
    const { prompt, window, written } = promptFor(
      "unset",
      ["What Is Sent?", "What Is Sent?", "Accept"],
      { openDisclosure: (url) => {
          opened.push(url);
          return Promise.resolve(undefined);
        }
      }
    );

    await prompt.promptIfUnset();

    expect(opened).toEqual([TELEMETRY_DISCLOSURE_URL, TELEMETRY_DISCLOSURE_URL]);
    expect(window.shown).toHaveLength(3);
    expect(written).toEqual(["enabled"]);
  });

  it("links the disclosure at a stable anchor in the README", () => {
    expect(TELEMETRY_DISCLOSURE_URL).toBe(
      "https://github.com/PlohnenSoftware/git-graph-libre#telemetry"
    );
  });

  it("writes disabled when the user rejects", async () => {
    const { prompt, written } = promptFor("unset", ["Reject and Don't Show Again"]);

    await prompt.promptIfUnset();

    expect(written).toEqual(["disabled"]);
  });

  // Closing a notification is not a decision. Recording one either way would
  // collect data nobody agreed to, or bury the question forever.
  it("leaves the answer unset when the notification is dismissed", async () => {
    const { prompt, written } = promptFor("unset", [undefined]);

    await prompt.promptIfUnset();

    expect(written).toEqual([]);
  });

  it("says so when accepting cannot take effect, and opens the setting", async () => {
    const opened: string[] = [];
    const { prompt, window, written } = promptFor("unset", ["Accept", "Open Setting"], {
      isGlobalTelemetryEnabled: () => false,
      openSettings: (query) => {
        opened.push(query);
        return Promise.resolve(undefined);
      }
    });

    await prompt.promptIfUnset();

    expect(written).toEqual(["enabled"]);
    expect(window.shown).toHaveLength(2);
    expect(window.shown[1].message).toContain("Visual Studio Code");
    expect(opened).toEqual([VSCODE_TELEMETRY_SETTING]);
  });

  it("does not open the setting if that follow-up is dismissed", async () => {
    const opened: string[] = [];
    const { prompt, window } = promptFor("unset", ["Accept", undefined], {
      isGlobalTelemetryEnabled: () => false,
      openSettings: (query) => {
        opened.push(query);
        return Promise.resolve(undefined);
      }
    });

    await prompt.promptIfUnset();

    expect(window.shown).toHaveLength(2);
    expect(opened).toEqual([]);
  });

  it("stays quiet about the global switch when it is already on", async () => {
    const { prompt, window } = promptFor("unset", ["Accept"], {
      isGlobalTelemetryEnabled: () => true
    });

    await prompt.promptIfUnset();

    expect(window.shown).toHaveLength(1);
  });

  it("asks again after a dismissal", async () => {
    const { prompt, window } = promptFor("unset", [undefined, undefined]);

    await prompt.promptIfUnset();
    await prompt.promptIfUnset();

    expect(window.shown).toHaveLength(2);
  });

  /*
   * The reported bug, and the reason there is no "one prompt at a time" flag.
   *
   * An Info notification carrying buttons is not sticky in the workbench
   * (`get sticky()` wants actions AND Severity.Error), so PURGE_TIMEOUT[Info]
   * removes the toast after 10 seconds. `removeToast()` drops the toast only:
   * the notification stays in the model, `onDidClose` never fires, and this
   * promise never resolves. A flag cleared in its `finally` therefore latches
   * for the rest of the session — which is exactly what stopped Set now from
   * reopening the prompt once the toast had aged out.
   */
  it("still asks while an earlier prompt's promise is still unresolved", async () => {
    const shown: string[] = [];
    const prompt = createConsentPrompt({
      config: { telemetryConsent: () => "unset" },
      window: {
        showInformationMessage(message: string) {
          shown.push(message);
          // The purged-toast case: never answered, never closed.
          return new Promise<string | undefined>(() => {});
        }
      },
      endpoint: ENDPOINT
    });

    void prompt.promptIfUnset();
    void prompt.promptIfUnset();
    void prompt.promptIfUnset();
    await Promise.resolve();

    expect(shown).toHaveLength(3);
  });

  // Two prompts in the same tick are safe rather than guarded against:
  // NotificationsModel.addNotification() closes an identical notification
  // before adding the new one, so the user only ever sees one.
  it("lets activation and the first graph open both ask", async () => {
    const { prompt, window } = promptFor("unset", ["Accept", "Accept"]);

    await Promise.all([prompt.promptIfUnset(), prompt.promptIfUnset()]);

    expect(window.shown).toHaveLength(2);
  });

  // With no endpoint compiled in nothing can be sent at all, so asking for
  // permission would be noise.
  it("never asks when telemetry is compiled off", async () => {
    const { prompt, window } = promptFor("unset", ["Accept"], { endpoint: "" });

    await prompt.promptIfUnset();

    expect(window.shown).toEqual([]);
  });

  it("survives a failed settings write and leaves the question open", async () => {
    const logged: string[] = [];
    const { prompt, window } = promptFor("unset", ["Accept"], {
      updateConsent: () => Promise.reject(new Error("settings.json is read-only")),
      logger: { log: (message) => logged.push(message) }
    });

    await expect(prompt.promptIfUnset()).resolves.toBeUndefined();

    expect(window.shown).toHaveLength(1);
    expect(logged.join(" ")).toContain("read-only");
  });

  it("writes the answer globally through the real configuration API", async () => {
    const window = createWindowStub(["Reject and Don't Show Again"]);
    const prompt = createConsentPrompt({
      config: { telemetryConsent: () => "unset" },
      window: window.api,
      endpoint: ENDPOINT
    });

    await prompt.promptIfUnset();

    // Global, not workspace: consent is about this person and machine, not
    // about whichever repository happens to be open.
    expect(configurationUpdates).toEqual([
      {
        section: "git-graph-libre",
        key: CONSENT_SETTING_KEY,
        value: "disabled",
        target: ConfigurationTarget.Global
      }
    ]);
  });

  it("reads VS Code's switch and opens its setting through the real APIs", async () => {
    env.isTelemetryEnabled = false;
    const window = createWindowStub(["Accept", "Open Setting"]);
    const prompt = createConsentPrompt({
      config: { telemetryConsent: () => "unset" },
      window: window.api,
      endpoint: ENDPOINT
    });

    await prompt.promptIfUnset();

    expect(executedCommands).toEqual([["workbench.action.openSettings", VSCODE_TELEMETRY_SETTING]]);
  });
});
