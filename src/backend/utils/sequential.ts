/**
 * Runs `task` for each item one after another, in order, and resolves to the
 * results in the same order. Each task starts only after the previous one has
 * settled, so none overlap: this is what keeps writes to one shared file, such
 * as Git's global config, from racing. The first rejection stops the chain, so
 * later items never start. An empty list resolves to an empty array.
 *
 * Written as a chain of async reducer steps rather than an `await` inside a
 * loop (Sonar S9382) or nested promises (S9381). Each step awaits the
 * previous one before calling its task, so tasks are called lazily, in order.
 */
export function mapSequential<T, R>(
  items: readonly T[],
  task: (item: T) => Promise<R>
): Promise<R[]> {
  return items.reduce<Promise<R[]>>(async (previous, item) => {
    const results = await previous;
    results.push(await task(item));
    return results;
  }, Promise.resolve([]));
}
