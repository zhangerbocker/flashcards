import { describe, expect, it } from "vitest";
import { gradeItem, newItem, Rating, type Grade, type ItemSchedule } from "./srs";

const NOW = new Date("2026-10-08T12:00:00Z");
const TODAY = "2026-10-08";

const days = (item: ItemSchedule) => (new Date(item.due).getTime() - NOW.getTime()) / 86_400_000;

/** Answers a fresh item with each rating in turn, all at NOW. */
function gradeAll(ratings: Grade[]): ItemSchedule {
  return ratings.reduce<ItemSchedule | undefined>((item, r) => gradeItem(item, r, NOW, TODAY), undefined)!;
}

describe("gradeItem", () => {
  it("records the day an item was first answered and keeps it", () => {
    const first = gradeItem(undefined, Rating.Know, NOW, "2026-10-01");
    expect(first.introducedOn).toBe("2026-10-01");
    expect(gradeItem(first, Rating.Know, NOW, TODAY).introducedOn).toBe("2026-10-01");
  });

  it("makes a missed item due right away, still learning", () => {
    expect(gradeAll([Rating.DontKnow])).toMatchObject({ state: "learning", streak: 0, due: NOW.toISOString() });
  });

  it("pushes a known item out by 1, 3, 7, 14, 30 and then 60 days", () => {
    expect([1, 2, 3, 4, 5, 6, 7].map((n) => days(gradeAll(Array(n).fill(Rating.Know))))).toEqual([1, 3, 7, 14, 30, 60, 60]);
    expect(gradeAll([Rating.Know])).toMatchObject({ state: "review", streak: 1 });
  });

  it("starts the streak over after a miss", () => {
    expect(days(gradeAll([Rating.Know, Rating.Know, Rating.DontKnow, Rating.Know]))).toBe(1);
  });

  it("counts every answer", () => {
    expect(gradeAll([Rating.Know, Rating.DontKnow, Rating.Know]).reps).toBe(3);
  });
});

describe("newItem", () => {
  it("is due now and unanswered", () => {
    expect(newItem(NOW, TODAY)).toEqual({ due: NOW.toISOString(), state: "new", reps: 0, streak: 0, introducedOn: TODAY });
  });
});
