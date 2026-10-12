import { beforeEach, describe, expect, it } from "vitest";
import { gradeItem, newItem, Rating, type Grade } from "../srs";
import type { SyncOp } from "../sync-ops";
import { migrate, pgliteDb, type Db } from "./db";
import { applyOps, failedLoginsSince, loadState, recordFailedLogin } from "./store";

const T1 = new Date("2026-10-08T12:00:00.000Z");
const T2 = new Date("2026-10-09T12:00:00.000Z");
const reviewed = (at: Date, rating: Grade = Rating.Know) => gradeItem(undefined, rating, at, "2026-10-08");

let db: Db;
beforeEach(async () => {
  db = await pgliteDb();
  await migrate(db);
});

describe("applyOps / loadState", () => {
  it("starts empty", async () => {
    expect(await loadState(db)).toEqual({ items: {}, reviews: [], mistakes: [], settings: null, stories: [], readIds: [] });
  });

  it("keeps the most recently reviewed schedule, whichever device sends last", async () => {
    const newer = reviewed(T2, Rating.Know);
    const older = reviewed(T1);
    await applyOps(db, [{ type: "item", key: "w:7", schedule: newer }]);
    await applyOps(db, [{ type: "item", key: "w:7", schedule: older }]);
    expect((await loadState(db)).items["w:7"]).toEqual(newer);
    await applyOps(db, [{ type: "item", key: "w:8", schedule: older }, { type: "item", key: "w:8", schedule: newer }]);
    expect((await loadState(db)).items["w:8"]).toEqual(newer);
  });

  it("does not let a word added but never reviewed replace one that was reviewed", async () => {
    const done = reviewed(T1);
    await applyOps(db, [{ type: "item", key: "w:7", schedule: done }]);
    await applyOps(db, [{ type: "item", key: "w:7", schedule: newItem(T2, "2026-10-09") }]);
    expect((await loadState(db)).items["w:7"]).toEqual(done);
  });

  it("can resend a whole batch without duplicating anything", async () => {
    const ops: SyncOp[] = [
      { type: "item", key: "w:7", schedule: reviewed(T1) },
      { type: "review", entry: { key: "w:7:r", rating: 2, at: T1.toISOString() } },
      { type: "mistake", mistake: { id: "m1", wrong: "a", right: "b", reason: "c", createdAt: "2026-10-08" } },
      { type: "read", id: "h1-time-1" },
      { type: "settings", settings: { autoplayAudio: false, typeAnswers: true } },
    ];
    await applyOps(db, ops);
    await applyOps(db, ops);
    const state = await loadState(db);
    expect(state.reviews).toEqual([{ key: "w:7:r", rating: 2, at: T1.toISOString() }]);
    expect(state.mistakes).toHaveLength(1);
    expect(state.readIds).toEqual(["h1-time-1"]);
    expect(state.settings).toEqual({ autoplayAudio: false, typeAnswers: true });
  });

  it("returns reviews oldest first", async () => {
    await applyOps(db, [
      { type: "review", entry: { key: "w:1:r", rating: 2, at: T2.toISOString() } },
      { type: "review", entry: { key: "w:2:r", rating: 1, at: T1.toISOString() } },
    ]);
    expect((await loadState(db)).reviews.map((r) => r.key)).toEqual(["w:2:r", "w:1:r"]);
  });
});

describe("failed logins", () => {
  it("counts failures inside the window only", async () => {
    await recordFailedLogin(db, new Date("2026-10-08T11:00:00Z"));
    await recordFailedLogin(db, new Date("2026-10-08T11:50:00Z"));
    await recordFailedLogin(db, new Date("2026-10-08T11:55:00Z"));
    expect(await failedLoginsSince(db, new Date("2026-10-08T11:45:00Z"))).toBe(2);
  });
});
