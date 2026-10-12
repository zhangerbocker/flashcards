import { z } from "zod";
import { sameButAccents } from "./answer";
import { itemKey, type Mistake } from "./deck";
import type { KeyValueStorage } from "./progress-store";
import type { Progress } from "./srs";
import type { Topic } from "./topics";
import { LEVEL_NAMES, LevelSchema, type Level } from "./levels";
import { withArticle, type Word } from "./words";

export interface Scenario {
  id: string;
  title: string;
  /** One line for the learner, on the setup screen. */
  blurb: string;
  /** Who the partner is and what the conversation is about (goes into the prompt). */
  setting: string;
  /** Topics whose words fit the scenario, used to pick target words. */
  topics: Topic[];
}

export const SCENARIOS: readonly Scenario[] = [
  {
    id: "padaria",
    title: "At a padaria",
    blurb: "Order coffee and a pão de queijo at a bakery in São Paulo.",
    setting: "You work at the counter of a padaria (bakery-café) in São Paulo. The learner is ordering something to drink and eat.",
    topics: ["Food & drink", "Numbers & measures"],
  },
  {
    id: "weekend",
    title: "Weekend plans",
    blurb: "Tell a friend what you did or will do on the weekend.",
    setting: "You are the learner's Brazilian friend. You are talking about what each of you did or will do on the weekend.",
    topics: ["Time", "Actions", "Places & directions"],
  },
  {
    id: "work",
    title: "Work and studying Portuguese",
    blurb: "Chat with a new colleague about work, school and learning Portuguese.",
    setting: "You are a new Brazilian colleague. You are chatting about work, school and why the learner is learning Portuguese.",
    topics: ["School & work", "Time"],
  },
  {
    id: "family",
    title: "Family and friends",
    blurb: "A classmate asks about your family and friends.",
    setting: "You are the learner's Brazilian classmate. You are asking about their family and friends.",
    topics: ["People & family", "Descriptions"],
  },
  {
    id: "rio",
    title: "Getting around Rio",
    blurb: "Ask a local for directions and tips on a trip to Rio de Janeiro.",
    setting: "You are a friendly local in Rio de Janeiro. The learner is a visitor asking for directions, how to get places, and what to see.",
    topics: ["Places & directions", "Daily life & transport", "Weather & colors"],
  },
];

export function findScenario(id: string): Scenario | undefined {
  return SCENARIOS.find((s) => s.id === id);
}

/** What the partner says, with English for the "?" toggle. */
export const PartnerLine = z.object({
  reply: z.string().describe("Your reply in Brazilian Portuguese: 1-3 short sentences"),
  replyEn: z.string().describe("Natural English translation of reply"),
});
export type PartnerLine = z.infer<typeof PartnerLine>;

export const MessageCheck = z.object({
  corrected: z.string().describe("The learner's message as correct, natural Brazilian Portuguese; unchanged if it was already fine"),
  correctedEn: z.string().describe("English meaning of corrected"),
  changes: z
    .array(
      z.object({
        from: z.string().describe("The learner's wrong text"),
        to: z.string().describe("The fixed text"),
        reason: z.string().describe("One short English sentence explaining the fix"),
      }),
    )
    .describe("One entry per real mistake; empty when the message was fine"),
  gaps: z
    .array(
      z.object({
        typed: z.string().describe("The English (or other non-Portuguese) word the learner typed"),
        pt: z.string().describe("The Portuguese word, in dictionary form (nouns with their article: a casa)"),
        en: z.string(),
      }),
    )
    .describe("Words the learner wrote in English because they didn't know the Portuguese"),
});
export type MessageCheck = z.infer<typeof MessageCheck>;

/** One learner turn: the check of their message, then the partner's reply. */
export const TutorTurn = z.object({ check: MessageCheck, partner: PartnerLine });
export type TutorTurn = z.infer<typeof TutorTurn>;

export const ChatMessage = z.discriminatedUnion("role", [
  z.object({ role: z.literal("user"), text: z.string(), check: MessageCheck.optional() }),
  z.object({ role: z.literal("partner"), text: z.string(), en: z.string() }),
]);
export type ChatMessage = z.infer<typeof ChatMessage>;

/** Limits on what the browser may send, so one request can't run up the bill. */
export const MAX_MESSAGE_CHARS = 300;
const MAX_HISTORY = 60;
const MAX_TARGET_WORDS = 15;
/** Messages of history sent to the model (the newest ones). */
export const CONTEXT_MESSAGES = 10;

export const ChatRequest = z.object({
  level: LevelSchema,
  scenario: z.string().refine((id) => findScenario(id) !== undefined, "unknown scenario"),
  targetWordIds: z.array(z.number().int()).max(MAX_TARGET_WORDS),
  history: z
    .array(z.object({ role: z.enum(["user", "partner"]), text: z.string().max(1000) }))
    .max(MAX_HISTORY),
  /** The learner's new message; omitted to get the partner's opening line. */
  message: z.string().trim().min(1).max(MAX_MESSAGE_CHARS).optional(),
});
export type ChatRequest = z.infer<typeof ChatRequest>;

/**
 * Up to 15 words for the partner to work in, at or below the level, in priority order:
 * words being learned, then words due for review, then other studied words from the
 * scenario's topics, then unstudied words from those topics.
 */
export function chooseTargetWords(progress: Progress, words: readonly Word[], level: Level, scenario: Scenario, now: Date): Word[] {
  const eligible = words.filter((w) => w.level <= level);
  const item = (w: Word) => progress.items[itemKey("word", w.id)];
  const onTopic = (w: Word) => scenario.topics.includes(w.topic);
  const tiers: ((w: Word) => boolean)[] = [
    (w) => item(w)?.state === "learning",
    (w) => item(w)?.state === "review" && new Date(item(w)!.due).getTime() <= now.getTime(),
    (w) => item(w) !== undefined && onTopic(w),
    (w) => item(w) === undefined && onTopic(w) && w.level === level,
  ];
  const chosen: Word[] = [];
  for (const inTier of tiers) {
    for (const w of eligible) {
      if (chosen.length === MAX_TARGET_WORDS) return chosen;
      if (inTier(w) && !chosen.includes(w)) chosen.push(w);
    }
  }
  return chosen;
}

/** What the partner may use at each level. */
const LEVEL_GRAMMAR: Record<Level, string> = {
  1: "the present, ir + infinitive for the future, and the simple past (pretérito perfeito)",
  2: "the present, ir + infinitive, the pretérito perfeito and imperfeito, and simple commands",
  3: "everything up to A2 plus the simple future, the conditional, the present subjunctive (espero que, talvez) and the compound past (tinha feito)",
  4: "any tense, including the imperfect and future subjunctive (se eu tivesse, quando você puder) and the personal infinitive",
};

export function systemPrompt(level: Level, scenario: Scenario, allowedWords: readonly string[], targetWords: readonly string[]): string {
  return `You are a friendly conversation partner for an adult English speaker learning Brazilian Portuguese at CEFR ${LEVEL_NAMES[level]}.

Scenario: ${scenario.setting}

Your reply:
- Brazilian Portuguese only (você, not tu; Brazilian vocabulary and word order), 1-3 short sentences, warm and natural, usually ending with one follow-up question. Stay in the scenario.
- Keep to the allowed words and their inflected forms (conjugations, plurals, feminines); names, numbers and punctuation are fine. Use only the grammar a ${LEVEL_NAMES[level]} learner knows: ${LEVEL_GRAMMAR[level]}. Work in the target words when they fit naturally.
- Never explain grammar or mention mistakes in the reply; the correction is shown separately.

Checking the learner's message:
- corrected: their message as correct, natural Brazilian Portuguese, with the smallest edits that keep their meaning. If it is already correct, or just an equally natural alternative, return it unchanged with no changes. Missing accents (nao for não, voce for você) and wrong gender or agreement are real mistakes; capitalization and final punctuation are not.
- changes: one entry per real mistake (from, to, reason in one short English sentence).
- gaps: wherever they typed an English word instead of a Portuguese one, give the Portuguese word. Put that word in corrected, but don't count it in changes: it is a vocabulary gap, not a mistake.

Target words: ${targetWords.join(", ") || "(none)"}

Allowed words: ${allowedWords.join(", ")}`;
}

/** The allowed-word list for the prompt: nouns with their article, so the model sees genders. */
export function promptWords(words: readonly Word[]): string[] {
  return words.map(withArticle);
}

/** The newest history messages for the model's context. */
export function recentHistory<T>(history: readonly T[], count = CONTEXT_MESSAGES): T[] {
  return history.slice(Math.max(0, history.length - count));
}

/**
 * The fixes that count as mistakes: all of them, or, when accents are optional, those that
 * aren't just a missing or wrong accent (cafe → café).
 */
export function countedChanges(check: MessageCheck, accentsOptional: boolean): MessageCheck["changes"] {
  return accentsOptional ? check.changes.filter((c) => !sameButAccents(c.from, c.to)) : check.changes;
}

/** A flashcard for a corrected message, or null when there was nothing (that counts) to fix. */
export function mistakeFromTurn(wrong: string, check: MessageCheck, id: string, createdAt: string, accentsOptional = false): Mistake | null {
  const changes = countedChanges(check, accentsOptional);
  if (changes.length === 0) return null;
  return {
    id,
    wrong,
    right: check.corrected,
    en: check.correctedEn,
    reason: changes.map((c) => c.reason).join(" "),
    createdAt,
  };
}

export interface Conversation {
  level: Level;
  scenario: string;
  messages: ChatMessage[];
  /** The learner ended it; the summary is showing. */
  ended?: boolean;
}

const CHAT_KEY = "pt.chat.v1";

const SavedConversation = z.object({
  level: LevelSchema,
  scenario: z.string().refine((id) => findScenario(id) !== undefined),
  messages: z.array(ChatMessage),
  ended: z.boolean().optional(),
});

/** The conversation in progress, kept so switching tabs doesn't lose it; null if none or unreadable. */
export function loadConversation(storage: KeyValueStorage): Conversation | null {
  const raw = storage.getItem(CHAT_KEY);
  if (raw === null) return null;
  try {
    const parsed = SavedConversation.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : null;
  } catch (err) {
    if (!(err instanceof SyntaxError)) throw err;
    return null;
  }
}

export function saveConversation(storage: KeyValueStorage, conversation: Conversation | null): void {
  storage.setItem(CHAT_KEY, conversation === null ? "null" : JSON.stringify(conversation));
}
