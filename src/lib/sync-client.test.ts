import { beforeEach, describe, expect, it } from "vitest";
import { addMistake, appendReview, loadProgress, loadSettings, saveProgress, saveSettings } from "./progress-store";
import { loadReadIds, markRead } from "./reading";
import { migrate, pgliteDb, type Db } from "./server/db";
import { stateHandler, syncHandler } from "./server/sync-handlers";
import { gradeItem, Rating } from "./srs";
import { flush, syncNow, type SyncDeps } from "./sync-client";
import { pendingOps } from "./sync-ops";

class MemoryStorage {
  private items = new Map<string, string>();
  getItem(key: string): string | null {
    return this.items.get(key) ?? null;
  }
  setItem(key: string, value: string): void {
    this.items.set(key, value);
  }
}

const T1 = new Date("2026-10-08T12:00:00.000Z");
const T2 = new Date("2026-10-09T12:00:00.000Z");
let db: Db;

beforeEach(async () => {
  db = await pgliteDb();
  await migrate(db);
});

/** A device whose fetch goes to the real handlers backed by the shared test database. */
function device(network: "online" | "offline" | "signed-out" = "online"): SyncDeps & { storage: MemoryStorage } {
  const sync = syncHandler(async () => db);
  const state = stateHandler(async () => db);
  const fakeFetch = async (path: string | URL | Request, init?: RequestInit): Promise<Response> => {
    if (network === "offline") throw new TypeError("Failed to fetch");
    if (network === "signed-out") return Response.json({ error: "Not signed in" }, { status: 401 });
    if (path === "/api/sync") return sync(new Request("http://x/api/sync", { method: "POST", body: init?.body as string }));
    if (path === "/api/state") return state();
    return new Response("not found", { status: 404 });
  };
  return { storage: new MemoryStorage(), fetch: fakeFetch as typeof fetch };
}

const grade = (rating: 3 | 4, at: Date) => gradeItem(undefined, rating, at, "2026-10-08");

describe("syncNow", () => {
  it("uploads a device's existing progress on its first sync and gives it to a new device", async () => {
    const laptop = device();
    saveProgress(laptop.storage, { items: { "w:7": grade(Rating.Good, T1) } });
    appendReview(laptop.storage, { key: "w:7:r", rating: 3, at: T1.toISOString() });
    addMistake(laptop.storage, { id: "m1", wrong: "a", right: "b", reason: "c", createdAt: "2026-10-08" });
    markRead(laptop.storage, "h1-time-1");
    expect(await syncNow(laptop)).toBe("synced");

    const phone = device();
    expect(await syncNow(phone)).toBe("synced");
    expect(loadProgress(phone.storage).items["w:7"]).toEqual(grade(Rating.Good, T1));
    expect(loadReadIds(phone.storage)).toEqual(new Set(["h1-time-1"]));
  });

  it("keeps the newer review when both devices studied the same word", async () => {
    const laptop = device();
    const phone = device();
    await syncNow(laptop);
    await syncNow(phone);
    saveProgress(phone.storage, { items: { "w:7": grade(Rating.Easy, T2) } });
    saveProgress(laptop.storage, { items: { "w:7": grade(Rating.Good, T1) } });
    await syncNow(phone);
    await syncNow(laptop);
    expect(loadProgress(laptop.storage).items["w:7"]).toEqual(grade(Rating.Easy, T2));
  });

  it("does not let a new device's default settings replace the learner's", async () => {
    const laptop = device();
    saveSettings(laptop.storage, { newPerDay: 10, newGrammarPerDay: 2, autoplayAudio: true, typeAnswers: false });
    await syncNow(laptop);
    const phone = device();
    await syncNow(phone);
    expect(loadSettings(phone.storage).newPerDay).toBe(10);
  });

  it("keeps working offline and sends the changes once back online", async () => {
    const shared = device();
    await syncNow(shared);
    const offline = { ...device("offline"), storage: shared.storage };
    saveProgress(offline.storage, { items: { "w:9": grade(Rating.Good, T1) } });
    expect(await syncNow(offline)).toBe("offline");
    expect(loadProgress(offline.storage).items["w:9"]).toBeDefined();
    expect(pendingOps(offline.storage)).toHaveLength(1);

    expect(await syncNow(shared)).toBe("synced");
    expect(pendingOps(shared.storage)).toEqual([]);
    const other = device();
    await syncNow(other);
    expect(loadProgress(other.storage).items["w:9"]).toBeDefined();
  });

  it("refills a new, empty database from a device that already synced elsewhere", async () => {
    const laptop = device();
    saveProgress(laptop.storage, { items: { "w:7": grade(Rating.Good, T1) } });
    await syncNow(laptop);
    db = await pgliteDb(); // the database is replaced by an empty one
    await migrate(db);
    expect(await syncNow(laptop)).toBe("synced");
    expect(loadProgress(laptop.storage).items["w:7"]).toBeDefined();
    const phone = device();
    await syncNow(phone);
    expect(loadProgress(phone.storage).items["w:7"]).toBeDefined();
  });

  it("reports an expired session without touching local data", async () => {
    const d = device("signed-out");
    saveProgress(d.storage, { items: { "w:7": grade(Rating.Good, T1) } });
    expect(await syncNow(d)).toBe("signed-out");
    expect(loadProgress(d.storage).items["w:7"]).toBeDefined();
  });
});

describe("outbox", () => {
  it("queues only the items that changed", () => {
    const d = device();
    saveProgress(d.storage, { items: { "w:1": grade(Rating.Good, T1), "w:2": grade(Rating.Good, T1) } });
    const before = pendingOps(d.storage).length;
    saveProgress(d.storage, { items: { "w:1": grade(Rating.Good, T1), "w:2": grade(Rating.Easy, T2) } });
    const ops = pendingOps(d.storage);
    expect(before).toBe(2);
    expect(ops.filter((o) => o.type === "item")).toHaveLength(2); // w:2's newer write replaced its queued one
    expect(ops.find((o) => o.type === "item" && o.key === "w:2")).toMatchObject({ schedule: grade(Rating.Easy, T2) });
  });

  it("empties the outbox once sent", async () => {
    const d = device();
    saveProgress(d.storage, { items: { "w:1": grade(Rating.Good, T1) } });
    expect(await flush(d)).toBe("synced");
    expect(pendingOps(d.storage)).toEqual([]);
  });
});
