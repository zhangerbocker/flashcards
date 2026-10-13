import { beforeEach, describe, expect, it } from "vitest";
import type { TutorTurn } from "../chat";
import { withArticle, WORDS, WORDS_BY_ID } from "../words";
import type { Identity } from "./auth";
import { GUEST_LIMIT_USD, GUEST_POOL_USD, recordGuestSpend } from "./budget";
import { chatHandler } from "./chat-handler";
import { migrate, pgliteDb, type Db } from "./db";
import { TutorError, type TutorClient, type TutorContext } from "./tutor";

const NOW = new Date("2026-10-12T12:00:00Z");
const TURN: TutorTurn = {
  check: { corrected: "Estou bem.", correctedEn: "I'm fine.", changes: [], gaps: [] },
  partner: { reply: "Que bom!", replyEn: "Great!" },
};
/** What each fake reply costs. */
const COST = 0.03;

/** Records the context it was called with and answers with fixed data at a fixed cost. */
function fakeTutor(fail?: Error) {
  const calls: { context: TutorContext; message?: string }[] = [];
  const tutor: TutorClient = {
    async open(context) {
      calls.push({ context });
      if (fail) throw fail;
      return { value: TURN.partner, costUsd: COST };
    },
    async respond(context, message) {
      calls.push({ context, message });
      if (fail) throw fail;
      return { value: TURN, costUsd: COST };
    },
  };
  return { tutor, calls };
}

const OWNER: Identity = { role: "owner", id: "owner" };
const GUEST: Identity = { role: "guest", id: "g1" };

let db: Db;
beforeEach(async () => {
  db = await pgliteDb();
  await migrate(db);
});

const handler = (tutor: TutorClient, who: Identity | null = OWNER) =>
  chatHandler(tutor, { getDb: async () => db, identify: () => who, now: () => NOW });

const post = (body: unknown) =>
  new Request("http://localhost/api/chat", { method: "POST", body: typeof body === "string" ? body : JSON.stringify(body) });

const BASE = { level: 1, scenario: "padaria", targetWordIds: [1], history: [] };

describe("chatHandler", () => {
  it("returns the opening line when there is no message", async () => {
    const res = await handler(fakeTutor().tutor)(post(BASE));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ partner: TURN.partner, budget: null });
  });

  it("returns the check and reply for a message", async () => {
    const { tutor, calls } = fakeTutor();
    const res = await handler(tutor)(post({ ...BASE, message: "Estou bem" }));
    expect(await res.json()).toEqual({ ...TURN, budget: null });
    expect(calls[0].message).toBe("Estou bem");
  });

  it("gives the tutor the level's words, the target words with articles and only recent history", async () => {
    const { tutor, calls } = fakeTutor();
    const history = Array.from({ length: 14 }, (_, i) => ({ role: i % 2 ? "user" : "partner", text: `m${i}` }));
    await handler(tutor)(post({ ...BASE, history, message: "Oi" }));
    const { context } = calls[0];
    expect(context.allowedWords).toHaveLength(WORDS.filter((w) => w.level <= 1).length);
    expect(context.targetWords).toEqual([withArticle(WORDS_BY_ID.get(1)!)]);
    expect(context.history.map((m) => m.text)).toEqual(["m4", "m5", "m6", "m7", "m8", "m9", "m10", "m11", "m12", "m13"]);
  });

  it("rejects an invalid body with 400 naming the field", async () => {
    const res = await handler(fakeTutor().tutor)(post({ ...BASE, level: 5 }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/^level/);
  });

  it("rejects a body that isn't JSON", async () => {
    const res = await handler(fakeTutor().tutor)(post("{nope"));
    expect(res.status).toBe(400);
  });

  it("answers 401 when no one is signed in", async () => {
    const res = await handler(fakeTutor().tutor, null)(post(BASE));
    expect(res.status).toBe(401);
  });

  it("answers 502 with the cause when the tutor fails", async () => {
    const res = await handler(fakeTutor(new TutorError("timed out")).tutor)(post({ ...BASE, message: "Oi" }));
    expect(res.status).toBe(502);
    expect((await res.json()).error).toBe("Couldn't reach the tutor: timed out");
  });

  it("lets unexpected errors through instead of hiding them", async () => {
    await expect(handler(fakeTutor(new TypeError("bug")).tutor)(post({ ...BASE, message: "Oi" }))).rejects.toThrow("bug");
  });
});

describe("guest budget", () => {
  it("charges a guest for each reply and reports what's left", async () => {
    const res = await handler(fakeTutor().tutor, GUEST)(post({ ...BASE, message: "Oi" }));
    const { budget } = await res.json();
    expect(budget).toMatchObject({ limitUsd: GUEST_LIMIT_USD, allowed: true });
    expect(budget.spentUsd).toBeCloseTo(COST);
    expect(budget.remainingUsd).toBeCloseTo(GUEST_LIMIT_USD - COST);
  });

  it("charges what a failed attempt cost", async () => {
    await handler(fakeTutor(new TutorError("incomplete", 0.01)).tutor, GUEST)(post({ ...BASE, message: "Oi" }));
    const res = await handler(fakeTutor().tutor, GUEST)(post(BASE));
    expect((await res.json()).budget.spentUsd).toBeCloseTo(0.01 + COST);
  });

  it("refuses a guest who has used their budget, without calling the tutor", async () => {
    await recordGuestSpend(db, GUEST.id, GUEST_LIMIT_USD, NOW);
    const { tutor, calls } = fakeTutor();
    const res = await handler(tutor, GUEST)(post({ ...BASE, message: "Oi" }));
    expect(res.status).toBe(402);
    expect((await res.json()).budget).toMatchObject({ allowed: false, reason: "guest-limit" });
    expect(calls).toHaveLength(0);
  });

  it("refuses every guest once all guests together reach the cap", async () => {
    await recordGuestSpend(db, "others", GUEST_POOL_USD, NOW);
    const res = await handler(fakeTutor().tutor, GUEST)(post(BASE));
    expect(res.status).toBe(402);
    expect((await res.json()).budget).toMatchObject({ allowed: false, reason: "pool-limit" });
  });

  it("never charges or limits the owner", async () => {
    await recordGuestSpend(db, "others", GUEST_POOL_USD, NOW);
    const res = await handler(fakeTutor().tutor, OWNER)(post({ ...BASE, message: "Oi" }));
    expect(res.status).toBe(200);
    expect((await res.json()).budget).toBeNull();
    const [row] = await db.query<{ n: number }>(`SELECT COUNT(*)::int AS n FROM guest_spend WHERE guest_id = 'owner'`);
    expect(row.n).toBe(0);
  });
});
