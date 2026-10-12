import { describe, expect, it } from "vitest";
import { access } from "./access";
import { createSessionToken } from "./auth";

const NOW = new Date("2026-10-08T12:00:00Z");
const SECRET = "a-test-secret-that-is-long-enough";
const token = createSessionToken(SECRET, NOW);

describe("access", () => {
  it("lets a signed-in learner in everywhere", () => {
    expect(access("/cards", token, SECRET, true, NOW)).toBe("allow");
    expect(access("/api/chat", token, SECRET, true, NOW)).toBe("allow");
  });

  it("sends pages to the login screen and answers APIs with 401 when signed out", () => {
    expect(access("/cards", undefined, SECRET, true, NOW)).toBe("login");
    expect(access("/api/chat", "forged.token", SECRET, true, NOW)).toBe("unauthorized");
    expect(access("/api/stories", undefined, SECRET, true, NOW)).toBe("unauthorized");
  });

  it("always serves the login screen and app-install files", () => {
    for (const path of ["/login", "/api/login", "/manifest.webmanifest", "/sw.js", "/icon-192.png", "/apple-icon.png"]) {
      expect(access(path, undefined, SECRET, true, NOW)).toBe("allow");
    }
  });

  it("refuses everything in production when no session secret is set", () => {
    expect(access("/api/chat", undefined, undefined, true, NOW)).toBe("misconfigured");
    expect(access("/cards", undefined, undefined, true, NOW)).toBe("misconfigured");
  });

  it("runs open in development without a session secret", () => {
    expect(access("/api/chat", undefined, undefined, false, NOW)).toBe("allow");
  });
});
