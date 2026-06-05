/**
 * Error handler: Suppress Neon WebSocket "Connection terminated unexpectedly"
 * error
 */
export const neonWsErrorHandler = (error: Error) => {
  const isNeonWsClose =
    error.message.includes("Connection terminated unexpectedly") &&
    error.stack?.includes("@neondatabase/serverless");

  if (isNeonWsClose) {
    // Swallow this specific Neon WS termination error
    return;
  }

  // For any other error, detach and rethrow
  throw error;
};
