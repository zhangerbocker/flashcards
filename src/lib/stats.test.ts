import { describe, expect, it } from "vitest";
import { reviewedOn, streak } from "./stats";

// Local-time timestamps so the tests don't depend on the machine's timezone.
const at = (y: number, m: number, d: number) => new Date(y, m - 1, d, 12).toISOString();
const review = (y: number, m: number, d: number) => ({ key: "w:1:r", rating: 2, at: at(y, m, d) });

describe("streak", () => {
  it("is zero with no reviews", () => {
    expect(streak([], "2026-10-08")).toBe(0);
  });

  it("counts consecutive days ending today", () => {
    expect(streak([review(2026, 10, 6), review(2026, 10, 7), review(2026, 10, 8)], "2026-10-08")).toBe(3);
  });

  it("keeps yesterday's streak alive before today's first review", () => {
    expect(streak([review(2026, 10, 6), review(2026, 10, 7)], "2026-10-08")).toBe(2);
  });

  it("breaks on a missed day", () => {
    expect(streak([review(2026, 10, 5), review(2026, 10, 7), review(2026, 10, 8)], "2026-10-08")).toBe(2);
  });

  it("crosses month boundaries", () => {
    expect(streak([review(2026, 9, 30), review(2026, 10, 1)], "2026-10-01")).toBe(2);
  });
});

describe("reviewedOn", () => {
  it("counts reviews on a given day", () => {
    expect(reviewedOn([review(2026, 10, 8), review(2026, 10, 8), review(2026, 10, 7)], "2026-10-08")).toBe(2);
  });
});
