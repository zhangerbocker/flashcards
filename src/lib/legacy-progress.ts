import { exercisesOf } from "./deck";
import type { CardState, ItemSchedule, Progress } from "./srs";

/** A card as saved by earlier versions, which scheduled every exercise card separately. */
export interface LegacyCard {
  due: string;
  /** FSRS saved a number (New, Learning, Review, Relearning); the fixed scheduler a name. */
  state: number | CardState;
  reps: number;
  easyHits?: number;
  last_review?: string;
  introducedOn: string;
  /** Scheduled from its word card without the learner seeing it. */
  linked?: boolean;
}

const FSRS_STATES: CardState[] = ["new", "learning", "review", "learning"];

/** "w:7:r" and "s:7:p" belong to word item "w:7"; the first prototype keyed word cards by bare id. */
function itemOf(cardKey: string): string {
  if (/^\d+$/.test(cardKey)) return `w:${cardKey}`;
  const [prefix, ref] = cardKey.split(":");
  return `${prefix === "s" ? "w" : prefix}:${ref}`;
}

function cardKeyOf(legacyKey: string): string {
  return /^\d+$/.test(legacyKey) ? `w:${legacyKey}:r` : legacyKey;
}

/**
 * Converts per-card progress into per-item schedules. An item keeps the schedule of
 * its first exercise (the word card, grammar "use" card), or of its latest-due card
 * if that one was never studied, so a word that was already scheduled days out stays
 * that way. Its exercise rotation continues after the exercises the learner had seen.
 */
export function itemsFromCards(cards: Record<string, LegacyCard>): Progress {
  const byItem = new Map<string, Map<string, LegacyCard>>();
  for (const [key, card] of Object.entries(cards)) {
    const item = itemOf(key);
    if (!byItem.has(item)) byItem.set(item, new Map());
    byItem.get(item)!.set(cardKeyOf(key), card);
  }

  const items: Record<string, ItemSchedule> = {};
  for (const [item, itemCards] of byItem) {
    let exercises: string[];
    try {
      exercises = exercisesOf(item);
    } catch {
      continue; // not a card key this app ever wrote
    }
    const latest = [...itemCards.values()].sort((a, b) => b.due.localeCompare(a.due))[0];
    const source = itemCards.get(exercises[0]) ?? latest;
    const seen = exercises.filter((e) => itemCards.has(e) && !itemCards.get(e)!.linked).length;
    items[item] = {
      due: source.due,
      state: typeof source.state === "number" ? (FSRS_STATES[source.state] ?? "learning") : source.state,
      reps: source.reps,
      easyHits: source.easyHits ?? 0,
      turn: seen,
      ...(source.last_review ? { last_review: source.last_review } : {}),
      introducedOn: [...itemCards.values()].map((c) => c.introducedOn).sort()[0],
    };
  }
  return { items };
}
