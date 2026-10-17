import { beforeEach, describe, expect, it } from "vitest";
import { registerRepositoryRecovery } from "@/extension/repositoryRecovery";
import { createTelemetryReporter } from "@/telemetry";
import type { RequestMessage } from "@/types";
import { env, resetVscodeMock, telemetryLoggers } from "./__mocks__/vscode";

beforeEach(() => resetVscodeMock());

describe("failure screen telemetry consent", () => {
  it.each(["unset", "disabled", "enabled"] as const)(
    "honors %s consent at the real reporter boundary",
    (consent) => {
      const telemetry = createTelemetryReporter({
        config: { telemetryConsent: () => consent },
        endpoint: "http://127.0.0.1:1/v1/events"
      });
      const handlers = new Map<string, (msg: RequestMessage) => void>();
      registerRepositoryRecovery(
        {
          onMessage: (command: string, handler: (msg: RequestMessage) => void) =>
            handlers.set(command, handler)
        } as never,
        { config: {} as never, repoSearch: {} as never, visible: () => true, telemetry }
      );
      const report = handlers.get("failureScreenShown");
      if (!report) throw new Error("Missing screen handler");
      for (const screen of [
        "gitUntrusted",
        "gitUnavailable",
        "repositoryError",
        "graphLoadError",
        "noWorkspace",
        "noRepository"
      ] as const) {
        report({ command: "failureScreenShown", screen });
        report({ command: "failureScreenShown", screen });
      }
      const events = telemetryLoggers[0].events;
      if (consent !== "enabled") {
        expect(events).toEqual([]);
        return;
      }
      expect(events.map((event) => event.data)).toEqual([
        { feature: "view.failure.gitUntrusted", ok: false },
        { feature: "view.failure.gitUnavailable", ok: false },
        { feature: "view.failure.repositoryError", ok: false },
        { feature: "view.failure.graphLoadError", ok: false },
        { feature: "view.empty.noWorkspace", ok: true },
        { feature: "view.empty.noRepository", ok: true }
      ]);
      env.isTelemetryEnabled = false;
      report({ command: "failureScreenShown", screen: "gitUntrusted" });
      expect(events).toHaveLength(6);
    }
  );
});
