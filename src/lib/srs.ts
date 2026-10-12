/** Grade buttons, worst to best. */
export const Rating = { Again: 1, Hard: 2, Good: 3, Easy: 4 } as const;
export type Grade = (typeof Rating)[keyof typeof Rating];

/** new: added but never graded; learning: last graded Again/Hard; review: last graded Good/Easy. */
export type CardState = "new" | "learning" | "review";

/**
 * The review schedule of one study item (a word, grammar point or chat mistake), as
 * stored in JSON (dates as ISO strings). Each review shows one of the item's exercises
 * in turn (see deck.ts), so the item, not the exercise, decides when it comes back.
 */
export interface ItemSchedule {
  due: string;
  state: CardState;
  reps: number;
  /** Easy grades since the item was last missed; sets the Easy interval. */
  easyHits: number;
  /** Passing grades so far; picks which exercise is shown next. */
  turn: number;
  last_review?: string;
  /** Local calendar day (YYYY-MM-DD) the item was first reviewed. */
  introducedOn: string;
}

/** Schedule per item key (see deck.ts for the key format). */
export interface Progress {
  items: Record<string, ItemSchedule>;
}

const MINUTE_MS = 60 * 1000;
const DAY_MS = 24 * 60 * MINUTE_MS;

/**
 * Fixed intervals: Again 2m, Hard 10m, Good 1d, Easy 4d per Easy hit (4d, 8d, 12d, …).
 * Again resets the Easy count; Hard and Good keep it.
 */
function schedule(stored: ItemSchedule | undefined, rating: Grade): { delayMs: number; easyHits: number } {
  const easyHits = stored?.easyHits ?? 0;
  switch (rating) {
    case Rating.Again:
      return { delayMs: 2 * MINUTE_MS, easyHits: 0 };
    case Rating.Hard:
      return { delayMs: 10 * MINUTE_MS, easyHits };
    case Rating.Good:
      return { delayMs: DAY_MS, easyHits };
    case Rating.Easy:
      return { delayMs: 4 * (easyHits + 1) * DAY_MS, easyHits: easyHits + 1 };
  }
}

/**
 * Applies a grade; pass `undefined` for an item seen for the first time. A pass (Good/Easy)
 * moves on to the item's next exercise; a miss (Again/Hard) repeats the same one.
 */
export function gradeItem(stored: ItemSchedule | undefined, rating: Grade, now: Date, today: string): ItemSchedule {
  const { delayMs, easyHits } = schedule(stored, rating);
  const passed = rating === Rating.Good || rating === Rating.Easy;
  return {
    due: new Date(now.getTime() + delayMs).toISOString(),
    state: passed ? "review" : "learning",
    reps: (stored?.reps ?? 0) + 1,
    easyHits,
    turn: (stored?.turn ?? 0) + (passed ? 1 : 0),
    last_review: now.toISOString(),
    introducedOn: stored?.introducedOn ?? today,
  };
}

/** A brand-new item due now, for words the learner adds by hand (e.g. from a story). */
export function newItem(now: Date, today: string): ItemSchedule {
  return { due: now.toISOString(), state: "new", reps: 0, easyHits: 0, turn: 0, introducedOn: today };
}

function formatInterval(ms: number): string {
  const minutes = Math.max(1, Math.round(ms / 60000));
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days}d`;
  const months = Math.round(days / 30);
  if (months < 12) return `${months}mo`;
  return `${Math.round(days / 365)}y`;
}

/** Interval label each grade button would produce, e.g. { 1: "2m", 4: "8d" }. */
export function previewIntervals(stored: ItemSchedule | undefined): Record<Grade, string> {
  const grades: Grade[] = [Rating.Again, Rating.Hard, Rating.Good, Rating.Easy];
  return Object.fromEntries(grades.map((g) => [g, formatInterval(schedule(stored, g).delayMs)])) as Record<Grade, string>;
}

/** Earliest upcoming due date, for the "come back at…" message; null if nothing is scheduled. */
export function nextDueAt(progress: Progress): Date | null {
  const times = Object.values(progress.items).map((c) => new Date(c.due).getTime());
  return times.length ? new Date(Math.min(...times)) : null;
}

/** Moves the current (first) card `gap` positions back so a miss repeats soon. */
export function requeueMissed<T>(queue: readonly T[], gap: number): T[] {
  const [current, ...rest] = queue;
  if (current === undefined) return [];
  const at = Math.min(gap, rest.length);
  return [...rest.slice(0, at), current, ...rest.slice(at)];
}
