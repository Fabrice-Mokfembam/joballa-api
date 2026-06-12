/** Derive read-only availableForHire from availabilityStatus (never persisted). */
export function deriveAvailableForHire(
  availabilityStatus: string | null | undefined,
): boolean {
  if (!availabilityStatus) return false;
  const normalized = availabilityStatus.trim().toUpperCase();
  return normalized === 'AVAILABLE' || normalized === 'OPEN_TO_OFFERS';
}
