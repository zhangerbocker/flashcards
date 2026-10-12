import { describe, expect, it } from "vitest";
import { itemsFromCards, type LegacyCard } from "./legacy-progress";

const card = (due: string, extra: Partial<LegacyCard> = {}): LegacyCard => ({
  due,
  state: "review",
  reps: 2,
  easyHits: 1,
  introducedOn: "2026-10-05",
  ...extra,
});

describe("itemsFromCards", () => {
  it("keeps a word's schedule from its word card, even when a sibling card is due sooner", () => {
    const { items } = itemsFromCards({
      "w:7:r": card("2026-10-16T12:00:00.000Z"),
      "s:7:p": card("2026-10-08T12:00:00.000Z", { introducedOn: "2026-10-07" }),
    });
    expect(Object.keys(items)).toEqual(["w:7"]);
    expect(items["w:7"]).toMatchObject({ due: "2026-10-16T12:00:00.000Z", easyHits: 1, introducedOn: "2026-10-05" });
  });

  it("continues the exercise rotation after the exercises already seen", () => {
    const { items } = itemsFromCards({
      "w:7:r": card("2026-10-16T12:00:00.000Z"),
      "w:7:p": card("2026-10-17T12:00:00.000Z"),
      "s:7:r": card("2026-10-18T12:00:00.000Z", { linked: true }),
    });
    expect(items["w:7"].turn).toBe(2);
  });

  it("converts FSRS states and starts the Easy count at zero", () => {
    const { items } = itemsFromCards({
      "w:7:r": card("2026-10-16T12:00:00.000Z", { state: 2, easyHits: undefined }),
      "w:8:r": card("2026-10-16T12:00:00.000Z", { state: 3, easyHits: undefined }),
    });
    expect(items["w:7"]).toMatchObject({ state: "review", easyHits: 0 });
    expect(items["w:8"].state).toBe("learning");
  });

  it("maps first-prototype bare word ids, grammar and mistake cards to their items", () => {
    const { items } = itemsFromCards({
      "7": card("2026-10-16T12:00:00.000Z"),
      "g:h1-shi:f": card("2026-10-16T12:00:00.000Z"),
      "m:abc:f": card("2026-10-16T12:00:00.000Z"),
    });
    expect(Object.keys(items).sort()).toEqual(["g:h1-shi", "m:abc", "w:7"]);
  });

  it("ignores keys this app never wrote", () => {
    expect(itemsFromCards({ "x:1:r": card("2026-10-16T12:00:00.000Z") })).toEqual({ items: {} });
  });
});
