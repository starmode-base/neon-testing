/**
 * Create a lazy singleton from a factory function
 */
export function lazySingleton<T>(factory: () => T): () => T {
  let instance: T | undefined;
  return () => {
    instance ??= factory();
    return instance;
  };
}
