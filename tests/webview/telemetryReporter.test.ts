import { beforeEach, describe, expect, it } from "vitest";

import { createTelemetryReporter } from "@/telemetry";

import { env, resetVscodeMock, telemetryLoggers } from "./__mocks__/vscode";

/**
 * The consent gate, which is the one piece of telemetry code where a mistake
 * cannot be walked back: an event sent before the user answered is sent.
 *
 * The reporter is exercised through the mocked `createTelemetryLogger`, so
 * nothing here reaches the network — an event that clears the gate lands in
 * the queue and stays there, because these tests never flush it.
 */
describe("telemetry reporter consent gate", () => {
  beforeEach(() => {
    resetVscodeMock();
  });

  function reporterFor(consent: "unset" | "enabled" | "disabled") {
    return createTelemetryReporter({
      config: { telemetryConsent: () => consent },
      endpoint: "http://127.0.0.1:1/v1/events"
    });
  }

  it("sends nothing while the question is unanswered", () => {
    const reporter = reporterFor("unset");

    reporter.logActivate({ settingsChanged: 0 });
    reporter.logFeature("pushTag", true);

    // Not "nothing arrived at the ingest" — nothing was even offered to the
    // logger. An unanswered question is not permission.
    expect(telemetryLoggers[0].events).toEqual([]);
  });

  it("sends nothing when the user has refused", () => {
    const reporter = reporterFor("disabled");

    reporter.logActivate({ settingsChanged: 0 });
    reporter.logFeature("pushTag", true);

    expect(telemetryLoggers[0].events).toEqual([]);
  });

  it("sends both event kinds once the user has accepted", () => {
    const reporter = reporterFor("enabled");

    reporter.logActivate({ settingsChanged: 2 });
    reporter.logFeature("pushTag", false);

    expect(telemetryLoggers[0].events).toEqual([
      { name: "activate", data: { settingsChanged: 2 } },
      { name: "feature", data: { feature: "pushTag", ok: false } }
    ]);
  });

  // VS Code's own switch is enforced by the logger, not by us. This asserts
  // the extension does not accidentally depend on checking it itself.
  it("still defers to VS Code's global telemetry setting", () => {
    env.isTelemetryEnabled = false;
    const reporter = reporterFor("enabled");

    reporter.logFeature("pushTag", true);

    expect(telemetryLoggers[0].events).toEqual([]);
  });

  it("consent is read per call, so a change takes effect without a reload", () => {
    let consent: "unset" | "enabled" | "disabled" = "unset";
    const reporter = createTelemetryReporter({
      config: { telemetryConsent: () => consent },
      endpoint: "http://127.0.0.1:1/v1/events"
    });

    reporter.logFeature("pushTag", true);
    consent = "enabled";
    reporter.logFeature("deleteTag", true);
    consent = "disabled";
    reporter.logFeature("addTag", true);

    expect(telemetryLoggers[0].events.map((event) => event.data?.feature)).toEqual(["deleteTag"]);
  });

  it("configures the logger for a no-op sendErrorData and adds the OS properties", () => {
    reporterFor("enabled");
    const { options } = telemetryLoggers[0];

    // Without ignoreUnhandledErrors VS Code routes every unhandled
    // extension-host error into a sender that deliberately drops them, and the
    // ingest accepts only `activate` and `feature`.
    expect(options?.ignoreUnhandledErrors).toBe(true);
    expect(options?.additionalCommonProperties).toMatchObject({
      "common.os": process.platform,
      "common.nodearch": process.arch
    });
  });

  it("creates no logger at all without an endpoint", () => {
    const reporter = reporterFor("enabled");
    expect(telemetryLoggers).toHaveLength(1);

    reporter.dispose();
    resetVscodeMock();

    createTelemetryReporter({
      config: { telemetryConsent: () => "enabled" },
      endpoint: ""
    }).logFeature("pushTag", true);

    expect(telemetryLoggers).toEqual([]);
  });
});
