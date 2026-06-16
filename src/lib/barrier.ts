/**
 * Creates a synchronization barrier that blocks until `count` callers have
 * arrived, then releases all of them simultaneously
 */
export function createBarrier(count: number) {
  let arrived = 0;
  let release: () => void;

  const barrier = new Promise<void>((resolve) => {
    release = resolve;
  });

  return async () => {
    arrived++;

    if (arrived === count) {
      release();
    }

    await barrier;
  };
}
