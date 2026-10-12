// Passcode login (server only). Passcodes are stored as scrypt hashes: OWNER_PASSCODE_HASH for the
// owner, APP_PASSCODE_HASH for guests. A session is an expiry time, a role and an id, signed with
// SESSION_SECRET (HMAC).
import { createHmac, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

/** owner: unlimited chat, new stories and sync. guest: a chat budget, progress on the device only. */
export type Role = "owner" | "guest";

export interface Identity {
  role: Role;
  /** Stable per login: the owner is "owner"; each guest login gets a random id (their budget key). */
  id: string;
}

/** Who is asking when login is switched off (local development): the owner. */
export const LOCAL_OWNER: Identity = { role: "owner", id: "owner" };

/** A fresh guest id for one login. */
export function newGuestId(): string {
  return randomBytes(12).toString("base64url");
}

export const SESSION_COOKIE = "pt_session";
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

/** A session token for `identity`, valid for 30 days from `now`. */
export function createSessionToken(secret: string, now: Date, identity: Identity): string {
  const payload = `${now.getTime() + SESSION_TTL_MS}.${identity.role}.${identity.id}`;
  return `${payload}.${sign(payload, secret)}`;
}

/** Who a session token belongs to, if it was signed with `secret` and hasn't expired; otherwise null. */
export function readSession(token: string | undefined, secret: string, now: Date): Identity | null {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 4) return null;
  const [expires, role, id, signature] = parts;
  if (!/^\d+$/.test(expires) || (role !== "owner" && role !== "guest") || !/^[\w-]+$/.test(id)) return null;
  const expected = Buffer.from(sign(`${expires}.${role}.${id}`, secret));
  const actual = Buffer.from(signature);
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected) || Number(expires) <= now.getTime()) return null;
  return { role, id };
}

/** Whether a session token was signed with `secret` and hasn't expired. */
export function isValidSession(token: string | undefined, secret: string, now: Date): boolean {
  return readSession(token, secret, now) !== null;
}

/** The identity behind a request's session cookie; the owner when login is switched off (local development). */
export function identify(request: Request, secret: string | undefined, now: Date): Identity | null {
  if (!secret) return process.env.NODE_ENV === "production" ? null : LOCAL_OWNER;
  const cookie = request.headers.get("cookie") ?? "";
  const token = cookie.split(/;\s*/).find((c) => c.startsWith(`${SESSION_COOKIE}=`))?.slice(SESSION_COOKIE.length + 1);
  return readSession(token, secret, now);
}
