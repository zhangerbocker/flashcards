import type { ChatMessage, MessageCheck } from "./chat";
import { itemKey } from "./deck";
import { buildLexicon, segment } from "./segment";
import type { Progress } from "./srs";
import type { Word } from "./words";

export interface ChatSummary {
  /** Messages the learner sent (and got checked). */
  sent: number;
  /** Of those, how many needed no correction. */
  clean: number;
  /** HSK words the learner wrote outside any corrected part, in order of first use. */
  wordsUsedWell: Word[];
  corrections: { wrong: string; right: string; changes: MessageCheck["changes"] }[];
  /** Words the learner typed in pinyin or English, one entry per Chinese word. */
  gaps: MessageCheck["gaps"];
  /** HSK words the partner used that the learner hasn't studied or used in the chat, in order of first use. */
  partnerNewWords: Word[];
}

/** What a finished conversation showed about the learner's Chinese; no model call needed. */
export function summarizeChat(messages: readonly ChatMessage[], words: readonly Word[], progress: Progress): ChatSummary {
  const lexicon = buildLexicon(words);
  const byId = new Map(words.map((w) => [w.id, w]));
  const wordsIn = (text: string) => segment(text, lexicon).flatMap((t) => (t.kind === "word" && t.wordId !== undefined ? [t] : []));

  const usedWell = new Map<number, Word>();
  const partnerNew = new Map<number, Word>();
  const gaps = new Map<string, MessageCheck["gaps"][number]>();
  const corrections: ChatSummary["corrections"] = [];
  let sent = 0;
  let clean = 0;

  // Words the learner wrote themselves (including corrected and looked-up forms) aren't new to them.
  const learnerWords = new Set(
    messages.flatMap((m) =>
      m.role === "user" ? [m.text, m.check?.corrected ?? "", ...(m.check?.gaps.map((g) => g.hanzi) ?? [])].flatMap(wordsIn).map((t) => t.wordId!) : [],
    ),
  );

  for (const m of messages) {
    if (m.role === "partner") {
      for (const t of wordsIn(m.text)) {
        const id = t.wordId!;
        if (!progress.items[itemKey("word", id)] && !learnerWords.has(id) && !partnerNew.has(id)) partnerNew.set(id, byId.get(id)!);
      }
      continue;
    }
    if (!m.check) continue;
    sent++;
    const { changes } = m.check;
    if (changes.length === 0) clean++;
    else corrections.push({ wrong: m.text, right: m.check.corrected, changes });
    for (const g of m.check.gaps) if (!gaps.has(g.hanzi)) gaps.set(g.hanzi, g);
    for (const t of wordsIn(m.text)) {
      const insideFix = changes.some((c) => c.from.includes(t.text));
      if (!insideFix && !usedWell.has(t.wordId!)) usedWell.set(t.wordId!, byId.get(t.wordId!)!);
    }
  }
  return {
    sent,
    clean,
    wordsUsedWell: [...usedWell.values()],
    corrections,
    gaps: [...gaps.values()],
    partnerNewWords: [...partnerNew.values()],
  };
}
