import type { GrammarPoint } from "./grammar";
import type { CardState, Progress } from "./srs";
import { TOPICS, type Topic } from "./topics";
import type { Level, Word } from "./words";

/**
 * Exercise card keys encode kind, content id and face:
 *   w:<wordId>:r  word, hanzi → meaning        w:<wordId>:p  word, meaning → hanzi
 *   s:<wordId>:r  example sentence, zh → en     s:<wordId>:p  example sentence, en → zh
 *   g:<grammarId>:u  use the pattern            g:<grammarId>:f  fix the typical mistake
 *   m:<mistakeId>:f  fix a mistake from chat
 */
export type CardKind = "word" | "sentence" | "grammar" | "mistake";
export type CardFace = "r" | "p" | "u" | "f";

export interface ParsedKey {
  kind: CardKind;
  ref: string;
  face: CardFace;
}

const PREFIX: Record<CardKind, string> = { word: "w", sentence: "s", grammar: "g", mistake: "m" };
const KIND_BY_PREFIX: Record<string, CardKind> = { w: "word", s: "sentence", g: "grammar", m: "mistake" };

export function cardKey(kind: CardKind, ref: string | number, face: CardFace): string {
  return `${PREFIX[kind]}:${ref}:${face}`;
}

export function parseKey(key: string): ParsedKey {
  const [prefix, ref, face] = key.split(":");
  const kind = KIND_BY_PREFIX[prefix];
  if (!kind || !ref || !["r", "p", "u", "f"].includes(face)) throw new Error(`invalid card key "${key}"`);
  return { kind, ref, face: face as CardFace };
}

export interface Mistake {
  id: string;
  wrong: string;
  right: string;
  /** Pinyin of the corrected sentence, when the chat provided it. */
  pinyin?: string;
  /** English meaning of the corrected sentence, when the chat provided it. */
  en?: string;
  reason: string;
  createdAt: string;
}

export interface Deck {
  words: readonly Word[];
  grammar: readonly GrammarPoint[];
  mistakes: readonly Mistake[];
}

/**
 * Study items, each with one schedule (see srs.ts):
 *   w:<wordId>  a word       g:<grammarId>  a grammar point       m:<mistakeId>  a chat mistake
 * Each review of an item shows its next exercise card in turn.
 */
export type ItemKind = "word" | "grammar" | "mistake";

const ITEM_PREFIX: Record<ItemKind, string> = { word: "w", grammar: "g", mistake: "m" };

export function itemKey(kind: ItemKind, ref: string | number): string {
  return `${ITEM_PREFIX[kind]}:${ref}`;
}

/**
 * The exercise cards of an item, in the order they take turns: a word goes
 * hanzi → meaning, meaning → hanzi, then its example sentence both ways.
 */
export function exercisesOf(item: string): string[] {
  const [prefix, ref] = item.split(":");
  switch (prefix) {
    case "w":
      return [cardKey("word", ref, "r"), cardKey("word", ref, "p"), cardKey("sentence", ref, "r"), cardKey("sentence", ref, "p")];
    case "g":
      return [cardKey("grammar", ref, "u"), cardKey("grammar", ref, "f")];
    case "m":
      return [cardKey("mistake", ref, "f")];
    default:
      throw new Error(`invalid item key "${item}"`);
  }
}

/** The exercise card an item shows on its next review. */
export function currentExercise(item: string, progress: Progress): string {
  const exercises = exercisesOf(item);
  return exercises[(progress.items[item]?.turn ?? 0) % exercises.length];
}

export interface QueueSettings {
  newPerDay: number;
  newGrammarPerDay: number;
}

export interface NextCard {
  /** The item being reviewed (graded as a whole). */
  item: string;
  /** The exercise card to show for it. */
  key: string;
  isNew: boolean;
}

/** Share of a grammar point's words that must be introduced before it unlocks. */
const GRAMMAR_UNLOCK_SHARE = 0.7;
/** Learning items due within this window count as due, so misses return in-session. */
const LEARN_AHEAD_MS = 20 * 60 * 1000;

const topicRank = (t: Topic) => TOPICS.indexOf(t);

/** New-word order: by HSK level, grouped by topic, then list order. */
export function orderedWords(words: readonly Word[]): Word[] {
  return [...words].sort((a, b) => a.level - b.level || topicRank(a.topic) - topicRank(b.topic) || a.id - b.id);
}

function introduced(progress: Progress, item: string): boolean {
  return item in progress.items;
}

/** Words not yet studied, in study order. */
export function newWordItems(deck: Deck, progress: Progress): string[] {
  return orderedWords(deck.words)
    .map((w) => itemKey("word", w.id))
    .filter((k) => !introduced(progress, k));
}

/** Grammar points not yet studied whose words are mostly introduced (70%), in list order. */
export function unlockedGrammarItems(deck: Deck, progress: Progress): string[] {
  return deck.grammar
    .filter((g) => {
      const known = g.wordIds.filter((id) => introduced(progress, itemKey("word", id))).length;
      return g.wordIds.length === 0 || known / g.wordIds.length >= GRAMMAR_UNLOCK_SHARE;
    })
    .map((g) => itemKey("grammar", g.id))
    .filter((k) => !introduced(progress, k));
}

function unseenMistakes(deck: Deck, progress: Progress): string[] {
  return deck.mistakes.map((m) => itemKey("mistake", m.id)).filter((k) => !introduced(progress, k));
}

/** Words and grammar points first studied on `day` (chat mistakes don't count). */
export function introducedOn(progress: Progress, day: string): { words: number; grammar: number } {
  let words = 0;
  let grammar = 0;
  for (const [key, item] of Object.entries(progress.items)) {
    if (item.introducedOn !== day) continue;
    if (key.startsWith("w:")) words++;
    else if (key.startsWith("g:")) grammar++;
  }
  return { words, grammar };
}

function isDue(dueIso: string, state: CardState, now: Date, allowLearnAhead: boolean): boolean {
  const due = new Date(dueIso).getTime();
  const learning = state === "learning";
  return due <= now.getTime() + (allowLearnAhead && learning ? LEARN_AHEAD_MS : 0);
}

function knownItems(deck: Deck): Set<string> {
  return new Set([
    ...deck.words.map((w) => itemKey("word", w.id)),
    ...deck.grammar.map((g) => itemKey("grammar", g.id)),
    ...deck.mistakes.map((m) => itemKey("mistake", m.id)),
  ]);
}

/** Items in progress whose content still exists, soonest due first. */
function scheduledItems(deck: Deck, progress: Progress) {
  const valid = knownItems(deck);
  return Object.entries(progress.items)
    .filter(([key]) => valid.has(key))
    .sort(([, a], [, b]) => new Date(a.due).getTime() - new Date(b.due).getTime());
}

/**
 * Picks the next item of the daily session and the exercise to show for it:
 * 1. items already due, most overdue first;
 * 2. unseen chat mistakes (no quota);
 * 3. new words and unlocked grammar points, alternating, each within its daily quota;
 * 4. learning items due within the learn-ahead window.
 * Items whose content no longer exists are skipped. Returns null when done.
 */
export function nextDailyCard(
  deck: Deck,
  progress: Progress,
  now: Date,
  today: string,
  settings: QueueSettings,
): NextCard | null {
  const pick = (item: string, isNew: boolean): NextCard => ({ item, key: currentExercise(item, progress), isNew });
  const scheduled = scheduledItems(deck, progress);

  const overdue = scheduled.find(([, s]) => isDue(s.due, s.state, now, false));
  if (overdue) return pick(overdue[0], overdue[1].state === "new");

  const mistake = unseenMistakes(deck, progress)[0];
  if (mistake) return pick(mistake, true);

  const done = introducedOn(progress, today);
  const word = done.words < settings.newPerDay ? newWordItems(deck, progress)[0] : undefined;
  const grammar = done.grammar < settings.newGrammarPerDay ? unlockedGrammarItems(deck, progress)[0] : undefined;
  const fresh = done.words <= done.grammar ? (word ?? grammar) : (grammar ?? word);
  if (fresh) return pick(fresh, true);

  const ahead = scheduled.find(([, s]) => isDue(s.due, s.state, now, true));
  return ahead ? pick(ahead[0], false) : null;
}

/** Header counts: items due now, new words left today, new grammar points left today (plus unseen chat mistakes). */
export function dailyCounts(
  deck: Deck,
  progress: Progress,
  now: Date,
  today: string,
  settings: QueueSettings,
): { due: number; newWords: number; newGrammar: number } {
  const due = scheduledItems(deck, progress).filter(([, s]) => isDue(s.due, s.state, now, true)).length;
  const done = introducedOn(progress, today);
  const left = (quota: number, used: number, available: number) => Math.min(Math.max(0, quota - used), available);
  return {
    due,
    newWords: left(settings.newPerDay, done.words, newWordItems(deck, progress).length),
    newGrammar:
      unseenMistakes(deck, progress).length +
      left(settings.newGrammarPerDay, done.grammar, unlockedGrammarItems(deck, progress).length),
  };
}

export type CramKind = "words" | "sentences" | "grammar" | "mistakes";

export interface CramFilter {
  kind: CramKind;
  level: Level | "all";
  topic: Topic | "all";
  face: "r" | "p";
}

/** Card keys for a cram session matching the filter, shuffled with the injected random source. */
export function buildCramKeys(deck: Deck, filter: CramFilter, random: () => number): string[] {
  const levelOk = (level: Level) => filter.level === "all" || level === filter.level;
  const topicOk = (topic: Topic) => filter.topic === "all" || topic === filter.topic;
  let keys: string[];
  switch (filter.kind) {
    case "words":
    case "sentences": {
      const kind = filter.kind === "words" ? "word" : "sentence";
      keys = deck.words.filter((w) => levelOk(w.level) && topicOk(w.topic)).map((w) => cardKey(kind, w.id, filter.face));
      break;
    }
    case "grammar":
      keys = deck.grammar
        .filter((g) => levelOk(g.level))
        .flatMap((g) => [cardKey("grammar", g.id, "u"), cardKey("grammar", g.id, "f")]);
      break;
    case "mistakes":
      keys = deck.mistakes.map((m) => cardKey("mistake", m.id, "f"));
      break;
  }
  for (let i = keys.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [keys[i], keys[j]] = [keys[j], keys[i]];
  }
  return keys;
}
