"use client";

import Link from "next/link";
import { useCallback, useRef, useState } from "react";
import { BottomSheet } from "./BottomSheet";
import { Questions } from "./Questions";
import { itemKey } from "@/lib/deck";
import { findStory, loadCustomStories, loadPinyinMode, markRead, savePinyinMode, wordStatus, type PinyinMode } from "@/lib/reading";
import { loadProgress, localDay, saveProgress } from "@/lib/progress-store";
import { newItem, type Progress } from "@/lib/srs";
import type { StorySentence, StoryToken } from "@/lib/story";
import { WORDS_BY_ID } from "@/lib/words";

const LONG_PRESS_MS = 450;
const PINYIN_MODES: { mode: PinyinMode; label: string }[] = [
  { mode: "all", label: "Pinyin" },
  { mode: "unknown", label: "New only" },
  { mode: "none", label: "Off" },
];

type Sheet = { kind: "word"; token: StoryToken } | { kind: "sentence"; sentence: StorySentence } | null;

function sentenceText(s: StorySentence): string {
  return s.tokens.map((t) => t.text).join("");
}

export function Reader({ id }: { id: string }) {
  const [story] = useState(() => findStory(id, loadCustomStories(window.localStorage)));
  const [progress, setProgress] = useState<Progress>(() => loadProgress(window.localStorage));
  const [pinyin, setPinyin] = useState<PinyinMode>(() => loadPinyinMode(window.localStorage));
  const [sheet, setSheet] = useState<Sheet>(null);
  const [read, setRead] = useState(false);
  const pressTimer = useRef<number | null>(null);
  const longPressed = useRef(false);

  const closeSheet = useCallback(() => setSheet(null), []);

  if (!story) {
    return (
      <div className="m-auto text-center text-stone-500">
        <p>Story not found.</p>
        <Link href="/read" className="text-red-700 underline dark:text-red-400">
          Back to the library
        </Link>
      </div>
    );
  }

  function startPress(sentence: StorySentence) {
    longPressed.current = false;
    pressTimer.current = window.setTimeout(() => {
      longPressed.current = true;
      setSheet({ kind: "sentence", sentence });
    }, LONG_PRESS_MS);
  }

  function cancelPress() {
    if (pressTimer.current !== null) window.clearTimeout(pressTimer.current);
    pressTimer.current = null;
  }

  function tapToken(token: StoryToken) {
    if (longPressed.current) return; // the long press already opened the sentence
    if (token.pinyin || token.en) setSheet({ kind: "word", token });
  }

  function addToFlashcards(wordId: number) {
    const now = new Date();
    const key = itemKey("word", wordId);
    if (progress.items[key]) return;
    const updated: Progress = { items: { ...progress.items, [key]: newItem(now, localDay(now)) } };
    saveProgress(window.localStorage, updated);
    setProgress(updated);
  }

  function showPinyin(token: StoryToken): boolean {
    if (!token.pinyin || pinyin === "none") return false;
    if (pinyin === "all") return true;
    return token.wordId === undefined || wordStatus(progress, token.wordId) !== "known";
  }

  function choosePinyin(mode: PinyinMode) {
    savePinyinMode(window.localStorage, mode);
    setPinyin(mode);
  }

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-2">
          <Link href="/read" className="text-sm text-stone-500 hover:text-stone-800 dark:hover:text-stone-200">
            ← Library
          </Link>
          <div className="flex rounded-full bg-stone-200 p-1 text-xs dark:bg-stone-800">
            {PINYIN_MODES.map(({ mode, label }) => (
              <button
                key={mode}
                type="button"
                onClick={() => choosePinyin(mode)}
                className={`rounded-full px-3 py-1 ${pinyin === mode ? "bg-white shadow-sm dark:bg-stone-950" : "text-stone-600 dark:text-stone-400"}`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        <div>
          <h1 className="font-han text-2xl">{story.title}</h1>
          <p className="text-sm text-stone-500">
            {story.titleEn} · HSK {story.level} · {story.topic}
          </p>
        </div>
      </header>

      <p className="text-xs text-stone-400">Tap a word for its meaning. Press and hold a sentence (or tap 译) to translate it.</p>

      <article className="font-han select-none text-2xl leading-[2.4] [-webkit-touch-callout:none]" onContextMenu={(e) => e.preventDefault()}>
        {story.sentences.map((sentence, si) => (
          <span
            key={si}
            onPointerDown={() => startPress(sentence)}
            onPointerUp={cancelPress}
            onPointerLeave={cancelPress}
            onPointerCancel={cancelPress}
            className="rounded transition-colors active:bg-amber-100/60 dark:active:bg-amber-500/10"
          >
            {sentence.tokens.map((token, ti) => {
              const status = token.wordId !== undefined ? wordStatus(progress, token.wordId) : undefined;
              const tappable = Boolean(token.pinyin || token.en);
              const content = showPinyin(token) ? (
                <ruby>
                  {token.text}
                  <rt className="font-sans text-[0.45em] text-stone-500">{token.pinyin}</rt>
                </ruby>
              ) : (
                token.text
              );
              return tappable ? (
                <span
                  key={ti}
                  role="button"
                  tabIndex={0}
                  onClick={() => tapToken(token)}
                  onKeyDown={(e) => e.key === "Enter" && tapToken(token)}
                  className={`cursor-pointer rounded hover:bg-stone-200/70 dark:hover:bg-stone-800 ${
                    status && status !== "known" ? "underline decoration-amber-500/70 decoration-dotted underline-offset-[6px]" : ""
                  }`}
                >
                  {content}
                </span>
              ) : (
                <span key={ti}>{content}</span>
              );
            })}
            <button
              type="button"
              aria-label="Translate sentence"
              onClick={() => setSheet({ kind: "sentence", sentence })}
              className="mx-1 align-middle text-xs text-stone-400 hover:text-red-700"
            >
              译
            </button>
          </span>
        ))}
      </article>

      <Questions story={story} />

      <button
        type="button"
        onClick={() => {
          markRead(window.localStorage, story.id);
          setRead(true);
        }}
        disabled={read}
        className="rounded-2xl bg-stone-900 py-3 font-medium text-white disabled:opacity-60 dark:bg-stone-100 dark:text-stone-900"
      >
        {read ? "Marked as read" : "Mark as read"}
      </button>

      {sheet?.kind === "word" && (
        <BottomSheet onClose={closeSheet}>
          <WordSheet token={sheet.token} progress={progress} onAdd={addToFlashcards} />
        </BottomSheet>
      )}
      {sheet?.kind === "sentence" && (
        <BottomSheet onClose={closeSheet}>
          <p className="font-han text-xl leading-relaxed">{sentenceText(sheet.sentence)}</p>
          <p className="mt-1 text-sm text-red-700 dark:text-red-400">
            {sheet.sentence.tokens.filter((t) => t.pinyin).map((t) => t.pinyin).join(" ")}
          </p>
          <p className="mt-3 text-lg">{sheet.sentence.en}</p>
        </BottomSheet>
      )}
    </div>
  );
}

function WordSheet({ token, progress, onAdd }: { token: StoryToken; progress: Progress; onAdd: (wordId: number) => void }) {
  const word = token.wordId !== undefined ? WORDS_BY_ID.get(token.wordId) : undefined;
  const status = token.wordId !== undefined ? wordStatus(progress, token.wordId) : undefined;
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-baseline gap-3">
        <span className="font-han text-4xl">{token.text}</span>
        <span className="text-xl text-red-700 dark:text-red-400">{token.pinyin}</span>
      </div>
      <p className="text-lg">{token.en}</p>
      {word && word.english !== token.en && <p className="text-sm text-stone-500">Dictionary: {word.english}</p>}
      <div className="mt-2 flex items-center justify-between gap-2">
        <span className="text-xs text-stone-500">{word ? `HSK ${word.level} · ${word.topic}` : "Name or extra word"}</span>
        {word &&
          (status === "new" ? (
            <button
              type="button"
              onClick={() => onAdd(word.id)}
              className="rounded-full bg-red-700 px-4 py-1.5 text-sm text-white dark:bg-red-500"
            >
              Add to flashcards
            </button>
          ) : (
            <span
              className={`rounded-full px-3 py-1 text-xs ${
                status === "known"
                  ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300"
                  : "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300"
              }`}
            >
              {status === "known" ? "Known" : "In your flashcards"}
            </span>
          ))}
      </div>
    </div>
  );
}
