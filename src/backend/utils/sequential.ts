/**
 * Runs `task` for each item one after another, in order, and resolves to the
 * results in the same order. Each task starts only after the previous one has
 * settled, so none overlap: this is what keeps writes to one shared file, such
 * as Git's global config, from racing. The first rejection stops the chain, so
 * later items never start. An empty list resolves to an empty array.
 *
 * Written as a promise chain rather than an `await` inside a loop (Sonar
 * S9382). Tasks are called lazily, from inside the chain.
 */
export function mapSequential<T, R>(
  items: readonly T[],
  task: (item: T) => Promise<R>
): Promise<R[]> {
  const results: R[] = Array.from({ length: items.length });
  return items
    .reduce<Promise<void>>(
      (chain, item, index) =>
        chain.then(() =>
          task(item).then((result) => {
            results[index] = result;
          })
        ),
      Promise.resolve()
    )
    .then(() => results);
}
