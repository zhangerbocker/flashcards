import { describe, expect, it } from "vitest";
import { createSessionToken, hashPasscode, isValidSession, SESSION_TTL_MS, verifyPasscode } from "./auth";

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
    const token = createSessionToken(SECRET, NOW);
    expect(isValidSession(token, SECRET, NOW)).toBe(true);
    expect(isValidSession(token, SECRET, new Date(NOW.getTime() + SESSION_TTL_MS + 1))).toBe(false);
  });

  it("rejects tokens signed with another secret, tampered or missing", () => {
    const token = createSessionToken(SECRET, NOW);
    expect(isValidSession(token, "another-secret", NOW)).toBe(false);
    const [expires, signature] = token.split(".");
    expect(isValidSession(`${Number(expires) + 1000}.${signature}`, SECRET, NOW)).toBe(false);
    expect(isValidSession("garbage", SECRET, NOW)).toBe(false);
    expect(isValidSession(undefined, SECRET, NOW)).toBe(false);
  });
});
