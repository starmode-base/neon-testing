/**
 * Rewrite the `sslmode` (and related) query params on a Neon connection URI.
 *
 * Neon's API returns URIs with `sslmode=require`. In pg v9 /
 * pg-connection-string v3 this mode will adopt libpq semantics (encrypt
 * without CA verification) instead of today's effective `verify-full`.
 */
export function applySslMode(
  uri: string,
  mode: "verify-full" | "require" | undefined,
): string {
  if (mode === undefined) return uri;

  const url = new URL(uri);
  url.searchParams.set("sslmode", mode);
  if (mode === "require") {
    url.searchParams.set("uselibpqcompat", "true");
  } else {
    url.searchParams.delete("uselibpqcompat");
  }
  return url.toString();
}
