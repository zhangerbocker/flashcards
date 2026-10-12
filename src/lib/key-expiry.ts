/** Days before the API key expires that the app starts warning on every open. */
const WARN_DAYS = 7;

export type KeyExpiryNotice = { kind: "soon"; daysLeft: number; expiresOn: string } | { kind: "expired"; expiresOn: string };

/**
 * The warning to show for an API key expiring on `expiresOn` (YYYY-MM-DD, last valid day),
 * seen on local day `today`: none until a week before, then a countdown, then "expired".
 * Returns null when no expiry date is configured or it can't be read.
 */
export function keyExpiryNotice(expiresOn: string | undefined, today: string): KeyExpiryNotice | null {
  if (!expiresOn || !/^\d{4}-\d{2}-\d{2}$/.test(expiresOn) || !/^\d{4}-\d{2}-\d{2}$/.test(today)) return null;
  const daysLeft = Math.round((Date.parse(`${expiresOn}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86_400_000);
  if (Number.isNaN(daysLeft)) return null;
  if (daysLeft < 0) return { kind: "expired", expiresOn };
  return daysLeft <= WARN_DAYS ? { kind: "soon", daysLeft, expiresOn } : null;
}
