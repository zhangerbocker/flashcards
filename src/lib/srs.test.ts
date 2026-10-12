import { describe, expect, it } from "vitest";
import { gradeItem, newItem, nextDueAt, previewIntervals, Rating, requeueMissed, type Grade, type Progress, type ItemSchedule } from "./srs";

const NOW = new Date("2026-10-08T12:00:00Z");
const TODAY = "2026-10-08";

const hours = (card: ItemSchedule) => (new Date(card.due).getTime() - NOW.getTime()) / 3_600_000;

/** Grades a fresh card with each rating in turn, all at NOW. */
function gradeAll(ratings: Grade[]): ItemSchedule {
  return ratings.reduce<ItemSchedule | undefined>((card, r) => gradeItem(card, r, NOW, TODAY), undefined)!;
}

describe("gradeItem", () => {
  it("records the day a card was first introduced", () => {
    expect(gradeItem(undefined, Rating.Good, NOW, TODAY).introducedOn).toBe(TODAY);
  });

  it("keeps the original introduction day on later reviews", () => {
    const first = gradeItem(undefined, Rating.Good, NOW, "2026-10-01");
    expect(gradeItem(first, Rating.Good, NOW, TODAY).introducedOn).toBe("2026-10-01");
  });

  it("schedules Again in 2 minutes and Hard in 10 minutes, still learning", () => {
    expect(hours(gradeAll([Rating.Again])) * 60).toBe(2);
    expect(gradeAll([Rating.Hard])).toMatchObject({ state: "learning" });
    expect(hours(gradeAll([Rating.Hard])) * 60).toBe(10);
  });

  it("schedules Good in 1 day, in review", () => {
    expect(gradeAll([Rating.Good])).toMatchObject({ state: "review" });
    expect(hours(gradeAll([Rating.Good]))).toBe(24);
  });

  it("grows Easy by 4 days per Easy hit", () => {
    expect([1, 2, 3, 4, 5].map((n) => hours(gradeAll(Array(n).fill(Rating.Easy))) / 24)).toEqual([4, 8, 12, 16, 20]);
  });

  it("moves to the next exercise on a pass and repeats the same one on a miss", () => {
    expect(gradeAll([Rating.Good, Rating.Easy]).turn).toBe(2);
    expect(gradeAll([Rating.Good, Rating.Again, Rating.Hard]).turn).toBe(1);
  });

  it("keeps the Easy count through Hard and Good, and resets it on Again", () => {
    expect(hours(gradeAll([Rating.Easy, Rating.Good, Rating.Hard, Rating.Easy])) / 24).toBe(8);
    expect(hours(gradeAll([Rating.Easy, Rating.Easy, Rating.Again, Rating.Easy])) / 24).toBe(4);
  });
});

describe("previewIntervals", () => {
  it("shows 2m / 10m / 1d / 4d for a new card", () => {
    expect(previewIntervals(undefined)).toEqual({ 1: "2m", 2: "10m", 3: "1d", 4: "4d" });
  });

  it("shows the grown Easy interval after four Easy hits", () => {
    const card = gradeAll(Array(4).fill(Rating.Easy));
    expect(previewIntervals(card)).toEqual({ 1: "2m", 2: "10m", 3: "1d", 4: "20d" });
  });
});

describe("nextDueAt", () => {
  it("returns null with no cards", () => {
    expect(nextDueAt({ items: {} })).toBeNull();
  });

  it("returns the earliest due date", () => {
    const card = gradeItem(undefined, Rating.Good, NOW, TODAY);
    const progress: Progress = {
      items: { a: { ...card, due: "2026-10-10T00:00:00.000Z" }, b: { ...card, due: "2026-10-09T00:00:00.000Z" } },
    };
    expect(nextDueAt(progress)?.toISOString()).toBe("2026-10-09T00:00:00.000Z");
  });
});

describe("requeueMissed", () => {
  it("reinserts a missed card a few positions later", () => {
    expect(requeueMissed([1, 2, 3, 4, 5, 6], 3)).toEqual([2, 3, 4, 1, 5, 6]);
  });

  it("appends to the end when the queue is short", () => {
    expect(requeueMissed([1, 2], 3)).toEqual([2, 1]);
  });

  it("keeps a single-card queue repeating", () => {
    expect(requeueMissed([7], 3)).toEqual([7]);
  });
});

describe("newItem", () => {
  it("is a new item due now, introduced today", () => {
    const card = newItem(NOW, TODAY);
    expect(card.state).toBe("new");
    expect(card.due).toBe(NOW.toISOString());
    expect(card.introducedOn).toBe(TODAY);
  });
});
