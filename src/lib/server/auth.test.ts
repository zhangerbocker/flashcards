import { describe, expect, it } from "vitest";
import { createSessionToken, hashPasscode, identify, isValidSession, readSession, SESSION_COOKIE, SESSION_TTL_MS, verifyPasscode } from "./auth";

const GUEST = { role: "guest", id: "g-123" } as const;

const NOW = new Date("2026-10-08T12:00:00Z");
const SECRET = "a-test-secret-that-is-long-enough";

describe("passcode", () => {
  it("accepts the right passcode and rejects others", () => {
    const stored = hashPasscode("谢谢 1234");
    expect(verifyPasscode("谢谢 1234", stored)).toBe(true);
    expect(verifyPasscode("谢谢 1235", stored)).toBe(false);
    expect(verifyPasscode("", stored)).toBe(false);
  });

  it("salts each hash", () => {
    expect(hashPasscode("same")).not.toBe(hashPasscode("same"));
  });

  it("explains a malformed stored hash", () => {
    expect(() => verifyPasscode("x", "plain-text-passcode")).toThrow(/scrypt:<salt>:<hash>/);
  });
});

describe("session", () => {
  it("is valid until it expires", () => {
    const token = createSessionToken(SECRET, NOW, GUEST);
    expect(isValidSession(token, SECRET, NOW)).toBe(true);
    expect(isValidSession(token, SECRET, new Date(NOW.getTime() + SESSION_TTL_MS + 1))).toBe(false);
  });

  it("carries who logged in", () => {
    expect(readSession(createSessionToken(SECRET, NOW, GUEST), SECRET, NOW)).toEqual(GUEST);
    expect(readSession(createSessionToken(SECRET, NOW, { role: "owner", id: "owner" }), SECRET, NOW)).toEqual({ role: "owner", id: "owner" });
  });

  it("rejects tokens signed with another secret, tampered or missing", () => {
    const token = createSessionToken(SECRET, NOW, GUEST);
    expect(isValidSession(token, "another-secret", NOW)).toBe(false);
    const [expires, role, id, signature] = token.split(".");
    expect(isValidSession(`${Number(expires) + 1000}.${role}.${id}.${signature}`, SECRET, NOW)).toBe(false);
    // A guest can't promote themselves to owner.
    expect(isValidSession(`${expires}.owner.${id}.${signature}`, SECRET, NOW)).toBe(false);
    expect(isValidSession(`${expires}.${signature}`, SECRET, NOW)).toBe(false);
    expect(isValidSession("garbage", SECRET, NOW)).toBe(false);
    expect(isValidSession(undefined, SECRET, NOW)).toBe(false);
  });
});

describe("identify", () => {
  const request = (cookie?: string) => new Request("http://localhost/api/me", { headers: cookie ? { cookie } : {} });

  it("reads the session cookie", () => {
    const token = createSessionToken(SECRET, NOW, GUEST);
    expect(identify(request(`theme=dark; ${SESSION_COOKIE}=${token}`), SECRET, NOW)).toEqual(GUEST);
    expect(identify(request(), SECRET, NOW)).toBeNull();
  });

  it("treats everyone as the owner when login is switched off outside production", () => {
    expect(identify(request(), undefined, NOW)).toEqual({ role: "owner", id: "owner" });
  });
});
