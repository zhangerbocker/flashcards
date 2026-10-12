import type { ReactNode } from "react";
import { Correction } from "../Correction";
import type { Conversation } from "@/lib/chat";
import { summarizeChat } from "@/lib/chat-summary";
import { itemKey } from "@/lib/deck";
import type { Progress } from "@/lib/srs";
import { WORDS, type Word } from "@/lib/words";

const WORDS_BY_HANZI = new Map(WORDS.map((w) => [w.hanzi, w]));

function Section({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-stone-500">{title}</h2>
      {hint && <p className="-mt-1 text-xs text-stone-500">{hint}</p>}
      {children}
    </section>
  );
}

function WordRow({ word, progress, onAdd, typed }: { word: Word; progress: Progress; onAdd?: (id: number) => void; typed?: string }) {
  const studying = Boolean(progress.items[itemKey("word", word.id)]);
  return (
    <li className="flex items-center justify-between gap-2 text-sm">
      <span>
        {typed && <span className="text-stone-500">{typed} = </span>}
        <span className="font-han text-base">{word.hanzi}</span> <span className="text-red-700 dark:text-red-400">{word.pinyin}</span>{" "}
        <span className="text-stone-600 dark:text-stone-300">{word.english}</span>
      </span>
      {onAdd &&
        (studying ? (
          <span className="shrink-0 text-xs text-stone-500">In your flashcards</span>
        ) : (
          <button type="button" onClick={() => onAdd(word.id)} className="shrink-0 rounded-full bg-red-700 px-3 py-1 text-xs text-white dark:bg-red-500">
            Add to flashcards
          </button>
        ))}
    </li>
  );
}

/** End-of-chat review: how it went, words used well, corrections, and words to learn. */
export function ChatSummaryView({
  title,
  conversation,
  progress,
  onAddWords,
  onKeepChatting,
  onNewChat,
}: {
  title: string;
  conversation: Conversation;
  progress: Progress;
  onAddWords: (wordIds: number[]) => void;
  onKeepChatting: () => void;
  onNewChat: () => void;
}) {
  const onAddWord = (wordId: number) => onAddWords([wordId]);
  const summary = summarizeChat(conversation.messages, WORDS.filter((w) => w.level <= conversation.level), progress);
  // Words looked up that are HSK words can go into the deck; others are just shown.
  const gapRows = summary.gaps.map((g) => ({ gap: g, word: WORDS_BY_HANZI.get(g.hanzi) }));
  const toAdd = [...gapRows.flatMap((r) => (r.word ? [r.word] : [])), ...summary.partnerNewWords].filter(
    (w, i, all) => !progress.items[itemKey("word", w.id)] && all.findIndex((x) => x.id === w.id) === i,
  );

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="text-lg font-semibold">Chat summary</h1>
        <p className="text-sm text-stone-500">
          {title} · HSK {conversation.level}
        </p>
      </header>

      <p className="rounded-2xl bg-stone-100 px-4 py-3 dark:bg-stone-900">
        You sent <b>{summary.sent}</b> message{summary.sent === 1 ? "" : "s"}; <b>{summary.clean}</b> needed no corrections.
      </p>

      {summary.wordsUsedWell.length > 0 && (
        <Section title="Words you used well">
          <p className="font-han flex flex-wrap gap-1.5 text-lg">
            {summary.wordsUsedWell.map((w) => (
              <span key={w.id} title={`${w.pinyin} · ${w.english}`} className="rounded-lg bg-emerald-100 px-2 py-0.5 text-emerald-900 dark:bg-emerald-900/40 dark:text-emerald-200">
                {w.hanzi}
              </span>
            ))}
          </p>
        </Section>
      )}

      {summary.corrections.length > 0 && (
        <Section title="Corrections" hint="Each one is already in your flashcards.">
          <ul className="flex flex-col gap-3">
            {summary.corrections.map((c, i) => (
              <li key={i} className="rounded-2xl border border-stone-200 p-3 text-sm dark:border-stone-800">
                <Correction wrong={c.wrong} right={c.right} className="text-lg" />
                {c.changes.map((ch, j) => (
                  <p key={j} className="mt-1 text-stone-600 dark:text-stone-300">
                    {ch.reason}
                  </p>
                ))}
              </li>
            ))}
          </ul>
        </Section>
      )}

      {gapRows.length > 0 && (
        <Section title="Words you looked up">
          <ul className="flex flex-col gap-1.5">
            {gapRows.map(({ gap, word }) =>
              word ? (
                <WordRow key={gap.hanzi} word={word} typed={gap.typed} progress={progress} onAdd={onAddWord} />
              ) : (
                <li key={gap.hanzi} className="text-sm">
                  <span className="text-stone-500">{gap.typed} = </span>
                  <span className="font-han text-base">{gap.hanzi}</span> <span className="text-red-700 dark:text-red-400">{gap.pinyin}</span>{" "}
                  <span className="text-stone-600 dark:text-stone-300">{gap.en}</span> <span className="text-xs text-stone-500">(not an HSK {conversation.level} word)</span>
                </li>
              ),
            )}
          </ul>
        </Section>
      )}

      {summary.partnerNewWords.length > 0 && (
        <Section title="New words from your partner">
          <ul className="flex flex-col gap-1.5">
            {summary.partnerNewWords.map((w) => (
              <WordRow key={w.id} word={w} progress={progress} onAdd={onAddWord} />
            ))}
          </ul>
        </Section>
      )}

      {toAdd.length > 1 && (
        <button
          type="button"
          onClick={() => onAddWords(toAdd.map((w) => w.id))}
          className="rounded-2xl border border-red-700 py-3 font-medium text-red-700 dark:border-red-400 dark:text-red-400"
        >
          Add all {toAdd.length} new words to flashcards
        </button>
      )}

      <div className="grid grid-cols-2 gap-2">
        <button type="button" onClick={onKeepChatting} className="rounded-2xl border border-stone-300 py-3 font-medium dark:border-stone-700">
          Keep chatting
        </button>
        <button type="button" onClick={onNewChat} className="rounded-2xl bg-stone-900 py-3 font-medium text-white dark:bg-stone-100 dark:text-stone-900">
          New chat
        </button>
      </div>
    </div>
  );
}
