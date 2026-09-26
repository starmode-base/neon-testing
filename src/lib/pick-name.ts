/**
 * Pick a role or database name from the entries returned by branch creation
 *
 * A requested name must exist among the candidates. Without a request, the
 * preferred name is used when present, otherwise the first candidate.
 */
export function pickName(
  kind: "role" | "database",
  candidates: { name: string }[],
  requested: string | undefined,
  preferred: string,
): string {
  if (requested !== undefined) {
    if (!candidates.some((c) => c.name === requested)) {
      const label = kind === "role" ? "Role" : "Database";
      throw new Error(`${label} not found: ${requested}`);
    }

    return requested;
  }

  const name =
    candidates.find((c) => c.name === preferred)?.name ?? candidates[0]?.name;

  if (name === undefined) {
    throw new Error(`No ${kind} available in branch`);
  }

  return name;
}
