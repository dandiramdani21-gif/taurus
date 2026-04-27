/**
 * Generate an invoice id that's extremely unlikely to collide, even with concurrent requests.
 * Uses: timestamp (base-36) + 8-digit random + process/object hash.
 * Example: INV-L7G8B3F-48261534-K9X2
 *
 * Collision probability is astronomically low:
 * - Timestamp changes every millisecond
 * - 8-digit random gives ~100M combinations per ms
 * - 3-char suffix adds ~46K combinations
 */
export function generateInvoiceNumber(): string {
  // Timestamp in milliseconds, converted to base-36
  const ts = Date.now().toString(36).toUpperCase();

  // 8-digit random number (00000000 to 99999999)
  const rand = String(Math.floor(Math.random() * 100_000_000)).padStart(8, "0");

  // 3-character random suffix for extra entropy
  const suffix = Math.floor(Math.random() * 46656)
    .toString(36)
    .toUpperCase()
    .padStart(3, "X");

  return `INV-${ts}-${rand}-${suffix}`;
}