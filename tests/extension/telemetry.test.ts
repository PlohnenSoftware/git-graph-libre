import * as assert from "node:assert";
import * as http from "node:http";
import type { AddressInfo } from "node:net";

import * as vscode from "vscode";

import { createTelemetryReporter } from "@/telemetry";

/**
 * What the real extension host does with our `TelemetrySender`.
 *
 * **Read this before adding a case that asserts an event ARRIVES here.** It
 * cannot, and that is VS Code working as designed rather than a broken pipe.
 * `isLoggingOnly()` in the workbench
 * (`resources/app/out/vs/workbench/workbench.desktop.main.js`) reads
 *
 * ```js
 * extensionTestsLocationURI ? true : !(isBuilt || disableTelemetry || (enableTelemetry && aiConfig?.ariaKey))
 * ```
 *
 * and its result travels to the extension host as
 * `initData.environment.isExtensionTelemetryLoggingOnly`, becoming
 * `ExtHostTelemetryLogger._inLoggingOnlyMode`. `logEvent()` then reads
 * `this._inLoggingOnlyMode || this._sender?.sendEventData(name, data)`: the
 * event is written to the hidden "extHostTelemetry (Not Sent)" output logger
 * and the sender is never called. Every test launch sets
 * `extensionTestsLocationURI`, so this suite is blind to the seam by
 * construction — `vscode.env.isTelemetryEnabled` and `logger.isUsageEnabled`
 * are both still `true` while nothing is forwarded.
 *
 * The seam was therefore verified against a packaged build instead
 * (`2026-09-02`, recorded in `docs/AI_DEV_KNOWLEDGE_BASE.md`): a VSIX
 * installed into an isolated `--extensions-dir`/`--user-data-dir` under real
 * code-insiders `1.136.0-insider` delivered the `activate` event to a local
 * listener, name already normalized to the bare `activate`. Redo it that way,
 * not from here.
 *
 * What is left worth asserting is everything the harness *can* see: that the
 * real API accepts our sender's shape at all, that the documented blindness is
 * still the behavior (so a future VS Code that starts forwarding is noticed
 * rather than assumed), and that the no-endpoint reporter is inert.
 */

type QueuedEvent = { name: string; ts: number; data: Record<string, unknown> };
type Batch = { events: QueuedEvent[] };

suite("Telemetry in the extension host", () => {
  let server: http.Server;
  let endpoint: string;
  let batches: Batch[] = [];

  suiteSetup(async () => {
    server = http.createServer((req, res) => {
      const chunks: Buffer[] = [];
      req.on("data", (chunk: Buffer) => chunks.push(chunk));
      req.on("end", () => {
        batches.push(JSON.parse(Buffer.concat(chunks).toString()) as Batch);
        res.writeHead(204).end();
      });
    });
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    endpoint = `http://127.0.0.1:${(server.address() as AddressInfo).port}/v1/events`;
  });

  suiteTeardown(async () => {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  });

  setup(function () {
    // The default 2s mocha budget is tighter than the sender's own ingest
    // timeout, so a slow flush would look like a failed one.
    this.timeout(15_000);
    batches = [];
  });

  test("the real createTelemetryLogger accepts the sender's shape", () => {
    // VS Code's `validateSender` throws a TypeError unless sendEventData and
    // sendErrorData are functions and flush is a function or undefined. It
    // runs inside `createTelemetryLogger`, i.e. during activation, so a
    // regression here breaks the extension outright rather than just losing
    // telemetry. Nothing below this call can catch that, which is why it is
    // asserted against the genuine API rather than a fake.
    const reporter = createTelemetryReporter({
      config: { telemetryEnabled: () => true },
      endpoint
    });

    reporter.logFeature("pushTag", true);
    reporter.logActivate({ settingsChanged: 0 });

    assert.doesNotThrow(() => reporter.dispose());
    // Disposal flushes; a second call must stay harmless.
    assert.doesNotThrow(() => reporter.dispose());
  });

  test("a test launch keeps the sender blind, both gates open", async function () {
    if (!vscode.env.isTelemetryEnabled) this.skip();

    const probe: string[] = [];
    const logger = vscode.env.createTelemetryLogger(
      {
        sendEventData(eventName) {
          probe.push(eventName);
        },
        sendErrorData() {}
      },
      { ignoreUnhandledErrors: true }
    );

    // Both switches report open, which is the part that misleads: the event is
    // accepted, counted as enabled, and still goes nowhere near the sender.
    assert.strictEqual(logger.isUsageEnabled, true);
    logger.logUsage("feature", { feature: "pushTag", ok: true });
    logger.dispose();
    await new Promise((resolve) => setTimeout(resolve, 1000));

    assert.deepStrictEqual(
      probe,
      [],
      "the extension host forwarded to the sender inside a test launch — " +
        "isExtensionTelemetryLoggingOnly no longer holds, so this suite can " +
        "finally assert the seam directly; see the comment at the top"
    );
  });

  test("an empty endpoint makes the reporter inert", async () => {
    const reporter = createTelemetryReporter({
      config: { telemetryEnabled: () => true },
      endpoint: ""
    });

    // No logger, no sender, no request: this is the compiled-in off switch,
    // and it is the one path a test launch can still observe end to end.
    reporter.logFeature("pushTag", true);
    reporter.logActivate({ settingsChanged: 0 });
    reporter.dispose();

    await new Promise((resolve) => setTimeout(resolve, 500));
    assert.deepStrictEqual(batches, [], "the no-endpoint reporter reached the network");
  });
});
