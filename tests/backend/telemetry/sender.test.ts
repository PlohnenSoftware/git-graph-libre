import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createTelemetrySender, normalizeEventName, toPayload } from "@/telemetry/sender";

const ENDPOINT = "https://tel.example.test/v1/events";

function okResponse(): Response {
  return new Response(null, { status: 204 });
}

function makeSender(fetchImpl: typeof fetch, overrides = {}) {
  return createTelemetrySender({
    endpoint: ENDPOINT,
    fetchImpl,
    maxBatchSize: 2,
    flushIntervalMs: 1000,
    maxQueuedEvents: 10,
    now: () => 1_756_000_000_000,
    ...overrides
  });
}

describe("telemetry sender", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("posts a batch to the ingest", async () => {
    const fetchImpl = vi.fn(async (_url: string, _init?: RequestInit) => okResponse());
    const sender = makeSender(fetchImpl as unknown as typeof fetch);

    sender.sendEventData("feature", { feature: "pushTag", ok: true });
    sender.sendEventData("feature", { feature: "deleteBranch", ok: false });
    await vi.runAllTimersAsync();

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe(ENDPOINT);
    expect(init?.method).toBe("POST");

    const body = JSON.parse(String(init?.body)) as {
      events: Array<{ name: string; ts: number; data: Record<string, unknown> }>;
    };
    expect(body.events).toHaveLength(2);
    expect(body.events[0]).toMatchObject({
      name: "feature",
      ts: 1_756_000_000_000,
      data: { feature: "pushTag", ok: true }
    });
  });

  // Getting this wrong would fail invisibly: the ingest 400s an unknown event
  // name and the queue swallows it, so nothing would ever arrive.
  it("strips any publisher.extension prefix from the event name", () => {
    expect(normalizeEventName("feature")).toBe("feature");
    expect(normalizeEventName("PlohnenSoftware.git-graph-libre/feature")).toBe("feature");
    expect(normalizeEventName("a/b/activate")).toBe("activate");
    expect(normalizeEventName("")).toBe("");
  });

  it("keeps only primitive property values", () => {
    expect(
      toPayload({
        s: "text",
        n: 42,
        b: false,
        nested: { a: 1 },
        list: [1, 2],
        nothing: null,
        notFinite: Number.POSITIVE_INFINITY,
        undef: undefined
      })
    ).toEqual({ s: "text", n: 42, b: false });

    expect(toPayload(undefined)).toEqual({});
  });

  // Nothing retries and nothing reaches the user.
  it("swallows a non-2xx response", async () => {
    const fetchImpl = vi.fn(async () => new Response(null, { status: 503 }));
    const sender = makeSender(fetchImpl as unknown as typeof fetch);

    sender.sendEventData("activate", {});
    await expect(vi.runAllTimersAsync()).resolves.not.toThrow();
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("swallows a rejecting transport", async () => {
    const fetchImpl = vi.fn(async () => {
      throw new Error("ENOTFOUND");
    });
    const sender = makeSender(fetchImpl as unknown as typeof fetch);

    sender.sendEventData("activate", {});
    await expect(vi.runAllTimersAsync()).resolves.not.toThrow();
  });

  // This extension collects feature usage, not crash reports. Errors are
  // already captured as ok:false on the feature event.
  it("does not send error data", async () => {
    const fetchImpl = vi.fn(async () => okResponse());
    const sender = makeSender(fetchImpl as unknown as typeof fetch);

    sender.sendErrorData(new Error("boom"), { extra: "context" });
    await sender.flush();
    await vi.runAllTimersAsync();

    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("flushes pending events on dispose", async () => {
    const fetchImpl = vi.fn(async () => okResponse());
    const sender = makeSender(fetchImpl as unknown as typeof fetch);

    sender.sendEventData("activate", {});
    expect(fetchImpl).not.toHaveBeenCalled();

    await sender.dispose();

    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });
});
