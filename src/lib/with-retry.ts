/**
 * Reusable API call wrapper with automatic retry on 423 errors with exponential
 * backoff
 *
 * https://neon.com/docs/reference/typescript-sdk#error-handling
 * https://neon.com/docs/changelog/2022-07-20
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: {
    maxRetries: number;
    baseDelayMs: number;
  },
): Promise<T> {
  if (!Number.isInteger(options.maxRetries) || options.maxRetries <= 0) {
    throw new Error("maxRetries must be a positive integer");
  }

  if (!Number.isInteger(options.baseDelayMs) || options.baseDelayMs <= 0) {
    throw new Error("baseDelayMs must be a positive integer");
  }

  for (let attempt = 1; attempt <= options.maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error: any) {
      const status = error?.response?.status;

      // Retry on 423 (resource locked) with exponential backoff
      if (status === 423 && attempt < options.maxRetries) {
        const delay = options.baseDelayMs * Math.pow(2, attempt - 1);

        console.log(
          `API call failed with 423, retrying in ${delay}ms (attempt ${attempt}/${options.maxRetries})`,
        );
        await new Promise((resolve) => setTimeout(resolve, delay));

        continue;
      }

      // Surface Neon API error details that are otherwise buried in the Axios error
      if (error?.response?.data?.code) {
        const { code, message } = error.response.data;
        throw new Error(
          `Neon API error - HTTP ${status} - ${code} - ${message}`,
          { cause: error },
        );
      }

      // Non-API errors (network, timeouts, etc.) pass through as-is
      throw error;
    }
  }
  throw new Error("apiCallWithRetry reached unexpected end");
}
