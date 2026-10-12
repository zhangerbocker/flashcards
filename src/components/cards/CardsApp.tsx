"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Flashcard } from "./Flashcard";
import { CramControls } from "./CramControls";
import { SettingsPanel } from "./SettingsPanel";
import { cardContent } from "@/lib/card-content";
import { buildCramKeys, dailyCounts, itemKey, nextDailyCard, type CramFilter, type Deck } from "@/lib/deck";
import { GRAMMAR } from "@/lib/grammar";
import {
  appendReview,
  loadMistakes,
  loadProgress,
  loadReviews,
  loadSettings,
  localDay,
  saveProgress,
  saveSettings,
  type Settings,
} from "@/lib/progress-store";
import { speakChinese } from "@/lib/speech";
import { gradeItem, nextDueAt, previewIntervals, Rating, requeueMissed, type Grade, type Progress } from "@/lib/srs";
import { reviewedOn, streak } from "@/lib/stats";
import { WORDS, type Level } from "@/lib/words";

type Mode = "daily" | "cram";

const GRADES: { rating: Grade; label: string; key: string; tone: string }[] = [
  { rating: Rating.Again, label: "Again", key: "1", tone: "bg-red-600 hover:bg-red-700" },
  { rating: Rating.Hard, label: "Hard", key: "2", tone: "bg-amber-600 hover:bg-amber-700" },
  { rating: Rating.Good, label: "Good", key: "3", tone: "bg-emerald-600 hover:bg-emerald-700" },
  { rating: Rating.Easy, label: "Easy", key: "4", tone: "bg-sky-600 hover:bg-sky-700" },
];

const CRAM_REPEAT_GAP = 3;
const EXTRA_BATCH = 10;
const GRAMMAR_BATCH = 5;
const DEFAULT_CRAM: CramFilter = { kind: "words", level: 1, topic: "all", face: "r" };

function isTypingTarget(target: EventTarget | null): boolean {
  return target instanceof HTMLElement && ["INPUT", "SELECT", "TEXTAREA"].includes(target.tagName);
}

export function CardsApp() {
  // Rendered client-only (see CardsLoader), so browser storage is available at init.
  const [progress, setProgress] = useState<Progress>(() => loadProgress(window.localStorage));
  const [settings, setSettings] = useState<Settings>(() => loadSettings(window.localStorage));
  const [reviews, setReviews] = useState(() => loadReviews(window.localStorage));
  const [mistakes] = useState(() => loadMistakes(window.localStorage));
  const [now, setNow] = useState<Date>(() => new Date());
  const [mode, setMode] = useState<Mode>("daily");
  const [revealed, setRevealed] = useState(false);
  const [typed, setTyped] = useState("");
  const [extra, setExtra] = useState({ words: 0, grammar: 0 });
  const [showSettings, setShowSettings] = useState(false);
  const [cramFilter, setCramFilter] = useState<CramFilter>(DEFAULT_CRAM);
  const [cramQueue, setCramQueue] = useState<string[]>([]);
  const [cramSeen, setCramSeen] = useState(0);

  const deck: Deck = useMemo(() => ({ words: WORDS, grammar: GRAMMAR, mistakes }), [mistakes]);
  const today = localDay(now);
  const daily = useMemo(() => {
    const quotas = {
      newPerDay: settings.newPerDay + extra.words,
      newGrammarPerDay: settings.newGrammarPerDay + extra.grammar,
    };
    return {
      next: nextDailyCard(deck, progress, now, today, quotas),
      counts: dailyCounts(deck, progress, now, today, quotas),
    };
  }, [deck, progress, now, today, settings, extra]);

  // The clock only advances when the learner acts (grading, "Check again"), so the
  // card on screen never changes by itself; cards that came due meanwhile are
  // picked next, when the current card is graded.
  const currentItem = mode === "daily" ? daily.next?.item : undefined;
  const currentKey = mode === "daily" ? daily.next?.key : cramQueue[0];
  const isNew = mode === "daily" ? Boolean(daily.next?.isNew) : false;
  const card = currentKey
    ? cardContent(currentKey, deck, currentItem ? (progress.items[currentItem]?.reps ?? 0) : 0)
    : null;

  const intervals = useMemo(
    () => (currentItem ? previewIntervals(progress.items[currentItem]) : null),
    [currentItem, progress],
  );

  const startCram = useCallback(
    (filter: CramFilter) => {
      setCramFilter(filter);
      setCramQueue(buildCramKeys(deck, filter, Math.random));
      setCramSeen(0);
      setRevealed(false);
      setTyped("");
    },
    [deck],
  );

  const autoplayText = settings.autoplayAudio ? card?.audio.back : undefined;
  const reveal = useCallback(() => {
    setRevealed(true);
    if (autoplayText) speakChinese(autoplayText);
  }, [autoplayText]);

  const grade = useCallback(
    (rating: Grade) => {
      if (!currentKey) return;
      setRevealed(false);
      setTyped("");
      if (mode === "cram") {
        setCramQueue((q) => (rating === Rating.Again ? requeueMissed(q, CRAM_REPEAT_GAP) : q.slice(1)));
        setCramSeen((n) => n + 1);
        return;
      }
      if (!currentItem) return;
      const at = new Date();
      const updated: Progress = {
        items: { ...progress.items, [currentItem]: gradeItem(progress.items[currentItem], rating, at, localDay(at)) },
      };
      saveProgress(window.localStorage, updated);
      setProgress(updated);
      setReviews(appendReview(window.localStorage, { key: currentKey, rating, at: at.toISOString() }));
      setNow(at);
    },
    [currentKey, currentItem, mode, progress],
  );

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (!card || isTypingTarget(e.target)) return;
      if (e.key === " " || e.key === "Enter") {
        e.preventDefault();
        if (revealed) grade(Rating.Good);
        else reveal();
        return;
      }
      if (!revealed) return;
      const match = GRADES.find((g) => g.key === e.key);
      if (match && (mode === "daily" || match.rating === Rating.Again || match.rating === Rating.Good)) grade(match.rating);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [card, revealed, grade, reveal, mode]);

  function updateSettings(next: Settings) {
    saveSettings(window.localStorage, next);
    setSettings(next);
  }

  const learned = (level: Level) =>
    WORDS.filter((w) => w.level === level && progress.items[itemKey("word", w.id)]?.state === "review").length;

  return (
    <div className="flex flex-1 flex-col gap-4">
      <header className="flex items-center justify-between gap-2">
        <div className="flex rounded-full bg-stone-200 p-1 text-sm dark:bg-stone-800">
          {(["daily", "cram"] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => {
                setMode(m);
                setRevealed(false);
                setTyped("");
                if (m === "cram" && cramQueue.length === 0) startCram(cramFilter);
              }}
              className={`rounded-full px-4 py-1.5 capitalize ${
                mode === m ? "bg-white shadow-sm dark:bg-stone-950" : "text-stone-600 dark:text-stone-400"
              }`}
            >
              {m}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          {mode === "daily" && (
            <p className="text-right text-xs leading-tight text-stone-500 sm:text-sm">
              <b className="text-stone-800 dark:text-stone-200">{daily.counts.due}</b> due ·{" "}
              <b className="text-stone-800 dark:text-stone-200">{daily.counts.newWords}</b> new ·{" "}
              <b className="text-stone-800 dark:text-stone-200">{daily.counts.newGrammar}</b> grammar
            </p>
          )}
          <button
            type="button"
            aria-label="Settings"
            aria-expanded={showSettings}
            onClick={() => setShowSettings((s) => !s)}
            className="rounded-full p-2 text-stone-500 hover:bg-stone-200 dark:hover:bg-stone-800"
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12M20 18h0" />
              <circle cx="16" cy="6" r="2" />
              <circle cx="10" cy="12" r="2" />
              <circle cx="18" cy="18" r="2" />
            </svg>
          </button>
        </div>
      </header>

      {showSettings && <SettingsPanel settings={settings} onChange={updateSettings} />}

      {mode === "cram" && (
        <CramControls filter={cramFilter} mistakeCount={mistakes.length} remaining={cramQueue.length} onChange={startCram} />
      )}

      {card ? (
        <>
          <Flashcard
            card={card}
            revealed={revealed}
            isNew={isNew}
            typing={settings.typeAnswers}
            typed={typed}
            onTypedChange={setTyped}
            onReveal={reveal}
          />
          {revealed ? (
            mode === "daily" ? (
              <div className="grid grid-cols-4 gap-2">
                {GRADES.map((g) => (
                  <button
                    key={g.rating}
                    type="button"
                    onClick={() => grade(g.rating)}
                    className={`flex flex-col items-center rounded-2xl py-3 text-white ${g.tone}`}
                  >
                    <span className="font-medium">{g.label}</span>
                    <span className="text-xs opacity-80">{intervals?.[g.rating]}</span>
                  </button>
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => grade(Rating.Again)}
                  className="rounded-2xl bg-red-600 py-3 font-medium text-white hover:bg-red-700"
                >
                  Again
                </button>
                <button
                  type="button"
                  onClick={() => grade(Rating.Good)}
                  className="rounded-2xl bg-emerald-600 py-3 font-medium text-white hover:bg-emerald-700"
                >
                  Got it
                </button>
              </div>
            )
          ) : (
            <button
              type="button"
              onClick={reveal}
              className="rounded-2xl bg-stone-900 py-3 font-medium text-white dark:bg-stone-100 dark:text-stone-900"
            >
              Show answer
            </button>
          )}
          <p className="hidden text-center text-xs text-stone-400 sm:block">
            Space to reveal · 1–4 to grade{mode === "cram" ? " (1 = again, 3 = got it)" : ""}
          </p>
        </>
      ) : mode === "daily" ? (
        <DailyDone
          progress={progress}
          onCheckAgain={() => setNow(new Date())}
          onMoreWords={() => setExtra((e) => ({ ...e, words: e.words + EXTRA_BATCH }))}
          onMoreGrammar={() => setExtra((e) => ({ ...e, grammar: e.grammar + GRAMMAR_BATCH }))}
        />
      ) : (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
          {cramSeen > 0 ? (
            <>
              <p className="text-lg font-semibold">Cram round done</p>
              <p className="text-stone-500">{cramSeen} cards reviewed</p>
              <button
                type="button"
                onClick={() => startCram(cramFilter)}
                className="rounded-2xl bg-stone-900 px-6 py-3 font-medium text-white dark:bg-stone-100 dark:text-stone-900"
              >
                Shuffle again
              </button>
            </>
          ) : (
            <p className="text-stone-500">
              {cramFilter.kind === "mistakes"
                ? "No mistakes yet. Corrections from the chat will show up here."
                : "No cards match this filter."}
            </p>
          )}
        </div>
      )}

      <footer className="flex flex-wrap items-center justify-between gap-2 text-xs text-stone-500">
        <span>
          Learned: HSK 1 {learned(1)}/300 · HSK 2 {learned(2)}/200 · HSK 3 {learned(3)}/500
        </span>
        <span>
          {streak(reviews, today)}-day streak · {reviewedOn(reviews, today)} reviewed today
        </span>
      </footer>
    </div>
  );
}

function DailyDone({
  progress,
  onCheckAgain,
  onMoreWords,
  onMoreGrammar,
}: {
  progress: Progress;
  onCheckAgain: () => void;
  onMoreWords: () => void;
  onMoreGrammar: () => void;
}) {
  const next = nextDueAt(progress);
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
      <p className="text-lg font-semibold">Done for now</p>
      {next && (
        <p className="text-stone-500">
          Next review {next.toLocaleString(undefined, { weekday: "short", hour: "numeric", minute: "2-digit" })}
        </p>
      )}
      <div className="flex flex-wrap justify-center gap-2">
        <button
          type="button"
          onClick={onCheckAgain}
          className="rounded-2xl border border-stone-300 px-5 py-3 font-medium dark:border-stone-700"
        >
          Check again
        </button>
        <button
          type="button"
          onClick={onMoreWords}
          className="rounded-2xl bg-stone-900 px-5 py-3 font-medium text-white dark:bg-stone-100 dark:text-stone-900"
        >
          {EXTRA_BATCH} more words
        </button>
        <button
          type="button"
          onClick={onMoreGrammar}
          className="rounded-2xl border border-stone-300 px-5 py-3 font-medium dark:border-stone-700"
        >
          {GRAMMAR_BATCH} more grammar
        </button>
      </div>
    </div>
  );
}
