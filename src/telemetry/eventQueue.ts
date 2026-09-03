/**
 * Batching policy for outgoing telemetry.
 *
 * Pure with respect to VS Code — it knows nothing about the extension host, so
 * it is unit-testable with fake timers and a stub sender.
 *
 * Three rules are load-bearing and must survive future edits:
 *
 *  1. **Never throw.** This runs on the extension host. A telemetry failure
 *     must never surface to the user or break a feature that fired an event.
 *  2. **Never retry.** A dead endpoint costs the batch and nothing else. A
 *     retry loop on a user's machine is far worse than missing data.
 *  3. **Never grow without bound.** If the sender hangs, `add` keeps being
 *     called; the queue drops its oldest events rather than the process's
 *     memory.
 */

/** Property values VS Code's telemetry logger produces. */
export type TelemetryEventPayload = Record<string, string | number | boolean>;

export type QueuedTelemetryEvent = {
  name: string;
  ts: number;
  data: TelemetryEventPayload;
};

export type EventQueueOptions = {
  /** Flush as soon as this many events are queued. */
  maxBatchSize: number;
  /** Flush this long after the first event of an unflushed batch. */
  flushIntervalMs: number;
  /** Hard cap; beyond it the oldest queued events are dropped. */
  maxQueuedEvents: number;
  /** Transport. May reject; the queue swallows it. */
  send: (events: readonly QueuedTelemetryEvent[]) => Promise<void>;
};

export type EventQueue = {
  add: (event: QueuedTelemetryEvent) => void;
  flush: () => Promise<void>;
  dispose: () => Promise<void>;
  /** Test seam: how many events are waiting. */
  size: () => number;
};

export function createEventQueue(options: EventQueueOptions): EventQueue {
  let queued: QueuedTelemetryEvent[] = [];
  let timer: ReturnType<typeof setTimeout> | undefined;
  let disposed = false;

  function clearTimer() {
    if (timer !== undefined) {
      clearTimeout(timer);
      timer = undefined;
    }
  }

  async function flush(): Promise<void> {
    clearTimer();
    if (queued.length === 0) return;

    // Take the batch before awaiting so events added during the send land in
    // the next batch instead of being dropped by the reassignment below.
    const batch = queued;
    queued = [];

    try {
      await options.send(batch);
    } catch {
      // Deliberately swallowed, and deliberately not requeued. See rule 2.
    }
  }

  return {
    add(event) {
      if (disposed) return;

      queued.push(event);

      if (queued.length > options.maxQueuedEvents) {
        // Drop from the front: the newest events are the most useful, and an
        // unbounded queue on a user's machine is not an acceptable failure.
        queued = queued.slice(queued.length - options.maxQueuedEvents);
      }

      if (queued.length >= options.maxBatchSize) {
        void flush();
        return;
      }

      timer ??= setTimeout(() => void flush(), options.flushIntervalMs);
    },

    flush,

    async dispose() {
      disposed = true;
      await flush();
    },

    size: () => queued.length
  };
}
