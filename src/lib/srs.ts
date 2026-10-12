/** The two answers to a card: "I don't know it" (←) and "I know it" (→). */
export const Rating = { DontKnow: 1, Know: 2 } as const;
export type Grade = (typeof Rating)[keyof typeof Rating];

/** new: added but never answered; learning: last answered "don't know"; review: last answered "know". */
export type CardState = "new" | "learning" | "review";

/**
 * The schedule of one study item (a word, grammar point, verb tense or chat mistake), as
 * stored in JSON (dates as ISO strings). It doesn't decide what a session shows by itself:
 * sessions put missed and due items first (see session.ts), so `due` is a priority.
 */
export interface ItemSchedule {
  due: string;
  state: CardState;
  reps: number;
  /** "Know" answers in a row since the last "don't know"; sets the next interval. */
  streak: number;
  last_review?: string;
  /** Local calendar day (YYYY-MM-DD) the item was first answered or added. */
  introducedOn: string;
}

/** Schedule per item key (see deck.ts for the key format). */
export interface Progress {
  items: Record<string, ItemSchedule>;
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** Days until a known item is due again, by streak: 1, 3, 7, 14, 30, then 60 days. */
const INTERVAL_DAYS = [1, 3, 7, 14, 30, 60];

/**
 * Applies an answer; pass `undefined` for an item seen for the first time. "Know" pushes the
 * item out by a growing interval; "don't know" resets the streak and makes it due right away,
 * so it leads the next session.
 */
export function gradeItem(stored: ItemSchedule | undefined, rating: Grade, now: Date, today: string): ItemSchedule {
  const known = rating === Rating.Know;
  const streak = known ? (stored?.streak ?? 0) + 1 : 0;
  const delayMs = known ? INTERVAL_DAYS[Math.min(streak, INTERVAL_DAYS.length) - 1] * DAY_MS : 0;
  return {
    due: new Date(now.getTime() + delayMs).toISOString(),
    state: known ? "review" : "learning",
    reps: (stored?.reps ?? 0) + 1,
    streak,
    last_review: now.toISOString(),
    introducedOn: stored?.introducedOn ?? today,
  };
}

/** A brand-new item due now, for words the learner adds by hand (e.g. from a story). */
export function newItem(now: Date, today: string): ItemSchedule {
  return { due: now.toISOString(), state: "new", reps: 0, streak: 0, introducedOn: today };
}
