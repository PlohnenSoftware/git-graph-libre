import { describe, expect, it } from "vitest";

import { mapSequential } from "@/backend/utils/sequential";

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe("mapSequential", () => {
  it("resolves to an empty array for an empty list without calling the task", async () => {
    let calls = 0;
    const result = await mapSequential([], async (item: number) => {
      calls++;
      return item;
    });
    expect(result).toEqual([]);
    expect(calls).toBe(0);
  });

  it("keeps the input order in the results, even when later tasks finish first", async () => {
    const gates = [deferred<string>(), deferred<string>(), deferred<string>()];
    const run = mapSequential(["a", "b", "c"], (item) => {
      const index = ["a", "b", "c"].indexOf(item);
      return gates[index].promise;
    });
    gates[2].resolve("c");
    gates[1].resolve("b");
    gates[0].resolve("a");
    expect(await run).toEqual(["a", "b", "c"]);
  });

  it("starts each task only after the previous one has settled", async () => {
    const events: string[] = [];
    const first = deferred<void>();
    const run = mapSequential(["one", "two"], async (item) => {
      events.push(`start ${item}`);
      if (item === "one") await first.promise;
      events.push(`end ${item}`);
    });
    await Promise.resolve();
    expect(events).toEqual(["start one"]);
    first.resolve();
    await run;
    expect(events).toEqual(["start one", "end one", "start two", "end two"]);
  });

  it("stops at the first rejection and never starts the later items", async () => {
    const started: number[] = [];
    const run = mapSequential([1, 2, 3, 4], async (item) => {
      started.push(item);
      if (item === 2) throw new Error("stop here");
      return item;
    });
    await expect(run).rejects.toThrow("stop here");
    expect(started).toEqual([1, 2]);
  });
});
