import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createEventQueue, type QueuedTelemetryEvent } from "@/telemetry/eventQueue";

function event(name: string): QueuedTelemetryEvent {
  return { name, ts: 0, data: {} };
}

function makeQueue(overrides: Partial<Parameters<typeof createEventQueue>[0]> = {}) {
  const sent: QueuedTelemetryEvent[][] = [];
  const queue = createEventQueue({
    maxBatchSize: 3,
    flushIntervalMs: 1000,
    maxQueuedEvents: 10,
    send: async (events) => {
      sent.push([...events]);
    },
    ...overrides
  });
  return { queue, sent };
}

describe("telemetry event queue", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("flushes as soon as the batch size is reached", async () => {
    const { queue, sent } = makeQueue();

    queue.add(event("a"));
    queue.add(event("b"));
    expect(sent).toHaveLength(0);

    queue.add(event("c"));
    await vi.runAllTimersAsync();

    expect(sent).toHaveLength(1);
    expect(sent[0].map((e) => e.name)).toEqual(["a", "b", "c"]);
    expect(queue.size()).toBe(0);
  });

  it("flushes a partial batch once the interval elapses", async () => {
    const { queue, sent } = makeQueue();

    queue.add(event("a"));
    expect(sent).toHaveLength(0);

    await vi.advanceTimersByTimeAsync(999);
    expect(sent).toHaveLength(0);

    await vi.advanceTimersByTimeAsync(1);
    expect(sent).toHaveLength(1);
    expect(sent[0].map((e) => e.name)).toEqual(["a"]);
  });

  // A telemetry failure must never surface to the user or break the feature
  // that fired the event.
  it("swallows a rejecting sender", async () => {
    const { queue } = makeQueue({
      send: async () => {
        throw new Error("network down");
      }
    });

    queue.add(event("a"));
    await expect(vi.runAllTimersAsync()).resolves.not.toThrow();
    await expect(queue.flush()).resolves.toBeUndefined();
  });

  // Retrying on a user's machine is worse than losing data.
  it("does not requeue events after a failed send", async () => {
    let attempts = 0;
    const { queue } = makeQueue({
      send: async () => {
        attempts++;
        throw new Error("network down");
      }
    });

    queue.add(event("a"));
    await vi.runAllTimersAsync();
    expect(attempts).toBe(1);
    expect(queue.size()).toBe(0);

    await vi.advanceTimersByTimeAsync(60_000);
    expect(attempts).toBe(1);
  });

  // If the sender hangs, add() keeps being called; memory must not follow.
  it("drops the oldest events past the hard cap", async () => {
    const { queue } = makeQueue({
      maxBatchSize: 1000,
      maxQueuedEvents: 5,
      send: async () => {}
    });

    for (let i = 0; i < 12; i++) queue.add(event(`e${i}`));

    expect(queue.size()).toBe(5);

    await queue.flush();
  });

  it("keeps the newest events when dropping", async () => {
    const { queue, sent } = makeQueue({ maxBatchSize: 1000, maxQueuedEvents: 3 });

    for (let i = 0; i < 6; i++) queue.add(event(`e${i}`));
    await queue.flush();

    expect(sent[0].map((e) => e.name)).toEqual(["e3", "e4", "e5"]);
  });

  it("does nothing when flushed empty", async () => {
    const { queue, sent } = makeQueue();

    await queue.flush();

    expect(sent).toHaveLength(0);
  });

  // Events added while a send is in flight belong to the next batch, not the
  // void.
  it("keeps events added during a send", async () => {
    let release: (() => void) | undefined;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const sent: QueuedTelemetryEvent[][] = [];

    const queue = createEventQueue({
      maxBatchSize: 1,
      flushIntervalMs: 1000,
      maxQueuedEvents: 10,
      send: async (events) => {
        sent.push([...events]);
        await gate;
      }
    });

    queue.add(event("first"));
    queue.add(event("second"));

    release?.();
    await vi.runAllTimersAsync();

    expect(sent.flat().map((e) => e.name)).toContain("second");
  });

  it("flushes on dispose and ignores later events", async () => {
    const { queue, sent } = makeQueue();

    queue.add(event("a"));
    await queue.dispose();

    expect(sent).toHaveLength(1);

    queue.add(event("b"));
    expect(queue.size()).toBe(0);
  });
});
