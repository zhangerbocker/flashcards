import { beforeEach, describe, expect, it } from "vitest";
import { gradeItem, Rating } from "../srs";
import { hashPasscode, isValidSession, readSession } from "./auth";
import { migrate, pgliteDb, type Db } from "./db";
import { loginHandler } from "./login-handler";
import { stateHandler, syncHandler } from "./sync-handlers";

const NOW = new Date("2026-10-08T12:00:00Z");
const SECRET = "a-test-secret-that-is-long-enough";
const HASH = hashPasscode("ni-hao-123");

let db: Db;
beforeEach(async () => {
  db = await pgliteDb();
  await migrate(db);
});

const post = (body: unknown) => new Request("http://localhost/api", { method: "POST", body: JSON.stringify(body) });

describe("sync and state", () => {
  it("returns what a device synced", async () => {
    const schedule = gradeItem(undefined, Rating.Know, NOW, "2026-10-08");
    const res = await syncHandler(async () => db)(post({ ops: [{ type: "item", key: "w:7", schedule }] }));
    expect(await res.json()).toEqual({ applied: 1 });
    const state = await (await stateHandler(async () => db)()).json();
    expect(state.items["w:7"]).toEqual(schedule);
  });

  it("rejects a malformed op without applying any of the batch", async () => {
    const schedule = gradeItem(undefined, Rating.Know, NOW, "2026-10-08");
    const res = await syncHandler(async () => db)(
      post({ ops: [{ type: "item", key: "w:7", schedule }, { type: "item", key: "w:8", schedule: { due: "soon" } }] }),
    );
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/^ops\.1\.schedule/);
    expect((await (await stateHandler(async () => db)()).json()).items).toEqual({});
  });

  it("rejects item keys that aren't study items", async () => {
    const schedule = gradeItem(undefined, Rating.Know, NOW, "2026-10-08");
    const res = await syncHandler(async () => db)(post({ ops: [{ type: "item", key: "x'; DROP TABLE items", schedule }] }));
    expect(res.status).toBe(400);
  });
});

describe("login", () => {
  const handler = (overrides = {}) =>
    loginHandler({ getDb: async () => db, passcodeHash: HASH, sessionSecret: SECRET, secureCookie: true, now: () => NOW, ...overrides });

  it("sets a valid, HttpOnly, Secure session cookie for the right passcode", async () => {
    const res = await handler()(post({ passcode: "ni-hao-123" }));
    expect(res.status).toBe(200);
    const cookie = res.headers.get("Set-Cookie")!;
    expect(cookie).toMatch(/HttpOnly/);
    expect(cookie).toMatch(/Secure/);
    expect(cookie).toMatch(/SameSite=Lax/);
    expect(isValidSession(cookie.split(";")[0].split("=")[1], SECRET, NOW)).toBe(true);
  });

  it("rejects a wrong passcode without a cookie", async () => {
    const res = await handler()(post({ passcode: "wrong" }));
    expect(res.status).toBe(401);
    expect(res.headers.get("Set-Cookie")).toBeNull();
  });

  it("locks out after 10 wrong attempts, even for the right passcode", async () => {
    for (let i = 0; i < 10; i++) await handler()(post({ passcode: "wrong" }));
    const res = await handler()(post({ passcode: "ni-hao-123" }));
    expect(res.status).toBe(429);
  });

  it("logs in as a guest with the shared passcode and as the owner with the owner's", async () => {
    const both = handler({ ownerPasscodeHash: hashPasscode("owner-only") });
    const token = async (passcode: string) => {
      const res = await both(post({ passcode }));
      return readSession(res.headers.get("Set-Cookie")!.split(";")[0].split("=")[1], SECRET, NOW);
    };
    expect(await token("owner-only")).toEqual({ role: "owner", id: "owner" });
    const guest = await token("ni-hao-123");
    expect(guest?.role).toBe("guest");
    // Each guest login gets its own budget.
    expect((await token("ni-hao-123"))?.id).not.toBe(guest?.id);
  });

  it("refuses to log in when login isn't configured", async () => {
    const res = await handler({ sessionSecret: undefined })(post({ passcode: "ni-hao-123" }));
    expect(res.status).toBe(503);
  });

  it("names a missing database as a setup problem, without any connection string", async () => {
    const getDb = async () => {
      throw new Error("can't reach postgres://user:secret@host/db");
    };
    const res = await handler({ getDb })(post({ passcode: "ni-hao-123" }));
    expect(res.status).toBe(503);
    const { error } = await res.json();
    expect(error).toMatch(/^Server setup problem: can't reach <url>$/);
    expect(error).not.toMatch(/secret/);
  });

  it("names a malformed passcode hash as a setup problem", async () => {
    const res = await handler({ passcodeHash: '"scrypt-oops"' })(post({ passcode: "ni-hao-123" }));
    expect(res.status).toBe(503);
    expect((await res.json()).error).toMatch(/APP_PASSCODE_HASH must look like/);
  });
});
