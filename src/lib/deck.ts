import type { GrammarPoint } from "./grammar";
import { TOPICS, type Topic } from "./topics";
import { TENSES, type Tense, type Verb } from "./verbs";
import type { Level, Word } from "./words";

/**
 * Exercise card keys encode kind, content id and face:
 *   w:<wordId>:r  word, pt → meaning            w:<wordId>:p  word, meaning → pt
 *   s:<wordId>:r  example sentence, pt → en     s:<wordId>:p  example sentence, en → pt
 *   g:<grammarId>:u  use the pattern            g:<grammarId>:f  fix the typical mistake
 *   v:<wordId>-<tense>-<person>:p  conjugate a verb (person 0-3, see PERSONS)
 *   m:<mistakeId>:f  fix a mistake from chat
 */
export type CardKind = "word" | "sentence" | "grammar" | "conjugation" | "mistake";
export type CardFace = "r" | "p" | "u" | "f";

export interface ParsedKey {
  kind: CardKind;
  ref: string;
  face: CardFace;
}

const PREFIX: Record<CardKind, string> = { word: "w", sentence: "s", grammar: "g", conjugation: "v", mistake: "m" };
const KIND_BY_PREFIX: Record<string, CardKind> = { w: "word", s: "sentence", g: "grammar", v: "conjugation", m: "mistake" };

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
  /** English meaning of the corrected sentence, when the chat provided it. */
  en?: string;
  reason: string;
  createdAt: string;
}

export interface Deck {
  words: readonly Word[];
  grammar: readonly GrammarPoint[];
  verbs: readonly Verb[];
  mistakes: readonly Mistake[];
}

/**
 * Study items, each with one schedule (see srs.ts); every card belongs to one item:
 *   w:<wordId>  a word (its word and sentence cards)     g:<grammarId>  a grammar point
 *   v:<wordId>-<tense>  one tense of a verb               m:<mistakeId>  a chat mistake
 */
export type ItemKind = "word" | "grammar" | "verb" | "mistake";

const ITEM_PREFIX: Record<ItemKind, string> = { word: "w", grammar: "g", verb: "v", mistake: "m" };

export function itemKey(kind: ItemKind, ref: string | number): string {
  return `${ITEM_PREFIX[kind]}:${ref}`;
}

/** The item key for one tense of a verb. */
export function verbItemKey(wordId: number, tense: Tense): string {
  return itemKey("verb", `${wordId}-${tense}`);
}

/** The study item a card belongs to: a word's word and sentence cards share the word's item. */
export function itemOfCard(key: string): string {
  const { kind, ref } = parseKey(key);
  switch (kind) {
    case "word":
    case "sentence":
      return itemKey("word", ref);
    case "grammar":
      return itemKey("grammar", ref);
    case "conjugation":
      return itemKey("verb", ref.replace(/-\d$/, ""));
    case "mistake":
      return itemKey("mistake", ref);
  }
}

const topicRank = (t: Topic) => TOPICS.indexOf(t);

/** Study order for words never seen: by level, grouped by topic, then list order. */
export function orderedWords(words: readonly Word[]): Word[] {
  return [...words].sort((a, b) => a.level - b.level || topicRank(a.topic) - topicRank(b.topic) || a.id - b.id);
}

export type CardSetKind = "words" | "sentences" | "grammar" | "verbs" | "mistakes";

/** Which cards a session draws from. */
export interface CardFilter {
  kind: CardSetKind;
  level: Level | "all";
  topic: Topic | "all";
  face: "r" | "p";
  /** Verbs only. */
  tense?: Tense | "all";
}

/** Every card key matching the filter: words in study order, everything else in list order. */
export function matchingCards(deck: Deck, filter: CardFilter): string[] {
  const levelOk = (level: Level) => filter.level === "all" || level === filter.level;
  const topicOk = (topic: Topic) => filter.topic === "all" || topic === filter.topic;
  let keys: string[];
  switch (filter.kind) {
    case "words":
    case "sentences": {
      const kind = filter.kind === "words" ? "word" : "sentence";
      keys = orderedWords(deck.words)
        .filter((w) => levelOk(w.level) && topicOk(w.topic))
        .map((w) => cardKey(kind, w.id, filter.face));
      break;
    }
    case "grammar":
      keys = deck.grammar
        .filter((g) => levelOk(g.level))
        .flatMap((g) => [cardKey("grammar", g.id, "u"), cardKey("grammar", g.id, "f")]);
      break;
    case "verbs": {
      const levelOf = new Map(deck.words.map((w) => [w.id, w.level]));
      const tenses = !filter.tense || filter.tense === "all" ? TENSES : [filter.tense];
      keys = deck.verbs
        .filter((v) => levelOk(levelOf.get(v.wordId) ?? 1))
        .flatMap((v) => tenses.flatMap((t) => [0, 1, 2, 3].map((p) => cardKey("conjugation", `${v.wordId}-${t}-${p}`, "p"))));
      break;
    }
    case "mistakes":
      keys = deck.mistakes.map((m) => cardKey("mistake", m.id, "f"));
      break;
  }
  return keys;
}
