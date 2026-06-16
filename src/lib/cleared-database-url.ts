/**
 * Sentinel written to `DATABASE_URL` to clear it, instead of `delete`.
 *
 * Keeps the value a string for consumers that type `DATABASE_URL` as required
 * (so the library never has to fight their env typing), and is an invalid
 * connection string so a test that forgot `neonTesting()` fails loudly rather
 * than silently reaching a real database.
 */
export const CLEARED_DATABASE_URL = `neon-testing: DATABASE_URL cleared, call neonTesting()`;
