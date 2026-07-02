// Evaluate promises in parallel, with at most maxParallel running at any time
function toRejectionError(reason: unknown) {
  return reason instanceof Error ? reason : new Error("Promise evaluation failed");
}

export function evalPromises<X, Y>(
  data: X[],
  maxParallel: number,
  createPromise: (val: X) => Promise<Y>
) {
  return new Promise<Y[]>((resolve, reject) => {
    if (data.length === 1) {
      createPromise(data[0])
        .then((v) => resolve([v]))
        .catch((error: unknown) => reject(toRejectionError(error)));
    } else if (data.length === 0) {
      resolve([]);
    } else {
      let results: Y[] = Array.from({ length: data.length }),
        nextPromise = 0,
        rejected = false,
        completed = 0;
      function startNext() {
        const cur = nextPromise;
        nextPromise++;
        createPromise(data[cur])
          .then((result) => {
            if (!rejected) {
              results[cur] = result;
              completed++;
              if (nextPromise < data.length) startNext();
              else if (completed === data.length) resolve(results);
            }
          })
          .catch((error: unknown) => {
            reject(toRejectionError(error));
            rejected = true;
          });
      }
      for (let i = 0; i < maxParallel && i < data.length; i++) startNext();
    }
  });
}
