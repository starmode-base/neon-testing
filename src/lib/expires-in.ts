/**
 * Validates the expiresIn option
 */
export function validateExpiresIn(expiresIn: number | null | undefined) {
  if (expiresIn !== null && expiresIn !== undefined) {
    if (!Number.isInteger(expiresIn)) {
      throw new Error("expiresIn must be an integer");
    }

    if (expiresIn <= 0) {
      throw new Error("expiresIn must be a positive integer");
    }

    if (expiresIn > 2592000) {
      throw new Error("expiresIn must not exceed 30 days (2,592,000 seconds)");
    }
  }
}
