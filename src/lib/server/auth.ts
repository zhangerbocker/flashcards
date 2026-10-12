// Single-user passcode login (server only). The passcode is stored as an scrypt hash in
// APP_PASSCODE_HASH; a session is an expiry time signed with SESSION_SECRET (HMAC).
import { createHmac, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

export const SESSION_COOKIE = "hsk_session";
export const SESSION_TTL_MS = 30 * 24 * 3_600_000;

/** "scrypt:<salt>:<hash>" in base64, for APP_PASSCODE_HASH (see scripts/hash-passcode.ts). */
export function hashPasscode(passcode: string, salt: Buffer = randomBytes(16)): string {
  return `scrypt:${salt.toString("base64")}:${scryptSync(passcode, salt, 32).toString("base64")}`;
}

/** Whether `passcode` matches the stored hash. Throws if the stored value isn't a hash this module wrote. */
export function verifyPasscode(passcode: string, stored: string): boolean {
  const [scheme, salt, hash] = stored.split(":");
  if (scheme !== "scrypt" || !salt || !hash) {
    throw new Error('APP_PASSCODE_HASH must look like "scrypt:<salt>:<hash>"; generate it with scripts/hash-passcode.ts');
  }
  const expected = Buffer.from(hash, "base64");
  const actual = scryptSync(passcode, Buffer.from(salt, "base64"), expected.length);
  return timingSafeEqual(actual, expected);
}

function sign(payload: string, secret: string): string {
  return createHmac("sha256", secret).update(payload).digest("base64url");
}

/** A session token valid for 30 days from `now`. */
export function createSessionToken(secret: string, now: Date): string {
  const expires = String(now.getTime() + SESSION_TTL_MS);
  return `${expires}.${sign(expires, secret)}`;
}

/** Whether a session token was signed with `secret` and hasn't expired. */
export function isValidSession(token: string | undefined, secret: string, now: Date): boolean {
  if (!token) return false;
  const [expires, signature] = token.split(".");
  if (!expires || !signature || !/^\d+$/.test(expires)) return false;
  const expected = Buffer.from(sign(expires, secret));
  const actual = Buffer.from(signature);
  return actual.length === expected.length && timingSafeEqual(actual, expected) && Number(expires) > now.getTime();
}
