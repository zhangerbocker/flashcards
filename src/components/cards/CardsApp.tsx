"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Flashcard } from "./Flashcard";
import { SessionSetup } from "./SessionSetup";
import { SettingsPanel } from "./SettingsPanel";
import { useActiveLevels, useMistakes, useProgress, useSettings } from "../useSettings";
import { cardContent } from "@/lib/card-content";
import { itemKey, itemOfCard, matchingCards, type CardFilter, type Deck } from "@/lib/deck";
import { GRAMMAR } from "@/lib/grammar";
import {
  appendReview,
  loadReviews,
  localDay,
  saveProgress,
} from "@/lib/progress-store";
import {
  loadSession,
  markKnown,
  markMissed,
  saveSession,
  sessionOf,
  startSession,
  type Session,
  type SessionSize,
} from "@/lib/session";
import { speakPortuguese } from "@/lib/speech";
import { gradeItem, Rating, type Grade, type Progress } from "@/lib/srs";
import { reviewedOn, streak } from "@/lib/stats";
import { VERBS } from "@/lib/verbs";
import { LEVEL_NAMES, WORDS, type Level } from "@/lib/words";

const DEFAULT_FILTER: CardFilter = { kind: "words", level: "all", topic: "all", face: "r" };
const DEFAULT_SIZE: SessionSize = 20;

function isTypingTarget(target: EventTarget | null): boolean {
  return target instanceof HTMLElement && ["INPUT", "SELECT", "TEXTAREA"].includes(target.tagName);
}

export function CardsApp() {
  // Rendered client-only (see CardsLoader), so browser storage is available at init.
  const progress = useProgress();
  const [settings, updateSettings] = useSettings();
  const levels = useActiveLevels();
  const [reviews, setReviews] = useState(() => loadReviews(window.localStorage));
  const mistakes = useMistakes();
  // Only the levels switched on; cards of other levels stay out of new sessions.
  const deck: Deck = useMemo(
    () => ({
      levels,
      words: WORDS.filter((w) => levels.includes(w.level)),
      grammar: GRAMMAR.filter((g) => levels.includes(g.level)),
      verbs: VERBS,
      mistakes,
    }),
    [levels, mistakes],
  );
  const [session, setSession] = useState<Session | null>(() => {
    const saved = loadSession(window.localStorage);
    // Drop cards whose content has since been removed.
    return saved && { ...saved, queue: saved.queue.filter((key) => cardContent(key, deck) !== null) };
  });
  const [showSetup, setShowSetup] = useState(session === null);
  const [revealed, setRevealed] = useState(false);
  const [typed, setTyped] = useState("");
  const [showSettings, setShowSettings] = useState(false);

  const currentKey = !showSetup ? session?.queue[0] : undefined;
  // Grammar cards rotate through their examples by how often the item has been answered.
  const card = currentKey ? cardContent(currentKey, deck, progress.items[itemOfCard(currentKey)]?.reps ?? 0) : null;
  const isNew = currentKey ? (progress.items[itemOfCard(currentKey)]?.state ?? "new") === "new" : false;

  const updateSession = useCallback((next: Session | null) => {
    saveSession(window.localStorage, next);
    setSession(next);
    setRevealed(false);
    setTyped("");
  }, []);

  function begin(filter: CardFilter, size: SessionSize) {
    updateSession(startSession(deck, progress, filter, size, new Date(), Math.random));
    setShowSetup(false);
  }

  const autoplayText = settings.autoplayAudio ? card?.audio.back : undefined;
  const reveal = useCallback(() => {
    setRevealed(true);
    if (autoplayText) speakPortuguese(autoplayText);
  }, [autoplayText]);

  /** Space or a tap turns the card over, either way; the typed answer stays for the next look. */
  const flip = useCallback(() => {
    if (revealed) setRevealed(false);
    else reveal();
  }, [revealed, reveal]);

  /** Records the answer on the card's item, so later sessions put missed and due cards first. */
  const record = useCallback(
    (key: string, rating: Grade) => {
      const at = new Date();
      const item = itemOfCard(key);
      const updated: Progress = { items: { ...progress.items, [item]: gradeItem(progress.items[item], rating, at, localDay(at)) } };
      saveProgress(window.localStorage, updated);
      setReviews(appendReview(window.localStorage, { key, rating, at: at.toISOString() }));
    },
    [progress],
  );

  const know = useCallback(() => {
    if (!session || !currentKey) return;
    record(currentKey, Rating.Know);
    updateSession(markKnown(session));
  }, [session, currentKey, record, updateSession]);

  /** Back into the pile: the card keeps coming back this session until it is known. */
  const dontKnow = useCallback(() => {
    if (!session || !currentKey) return;
    record(currentKey, Rating.DontKnow);
    updateSession(markMissed(session, Math.random));
  }, [session, currentKey, record, updateSession]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (!card || isTypingTarget(e.target)) return;
      if (e.key === "ArrowRight") {
        e.preventDefault();
        know();
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        dontKnow();
      } else if (e.key === " " || e.key === "Enter") {
        e.preventDefault();
        flip();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [card, know, dontKnow, flip]);

  const learned = (level: Level) =>
    WORDS.filter((w) => w.level === level && progress.items[itemKey("word", w.id)]?.state === "review").length;
  const total = (level: Level) => WORDS.filter((w) => w.level === level).length;
  const today = localDay(new Date());
  const done = session ? session.total - session.queue.length : 0;

  return (
    <div className="flex flex-1 flex-col gap-4">
      <header className="flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => setShowSetup(true)}
          className="rounded-full border border-stone-300 px-4 py-1.5 text-sm font-medium text-stone-700 hover:border-stone-700 hover:text-stone-900 dark:border-stone-700 dark:text-stone-200 dark:hover:border-stone-300"
        >
          New session
        </button>
        <div className="flex items-center gap-2">
          {session && !showSetup && session.queue.length > 0 && (
            <p className="text-right text-xs text-stone-500 sm:text-sm">
              <b className="text-stone-800 dark:text-stone-200">{session.queue.length}</b> left ·{" "}
              <b className="text-stone-800 dark:text-stone-200">{done}</b> known
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

      {session && !showSetup && session.total > 0 && (
        <div className="h-1 overflow-hidden rounded-full bg-stone-200 dark:bg-stone-800" aria-hidden="true">
          <div className="h-full bg-red-700 transition-all dark:bg-red-400" style={{ width: `${(done / session.total) * 100}%` }} />
        </div>
      )}

      {showSettings && <SettingsPanel settings={settings} onChange={updateSettings} />}

      {showSetup ? (
        <SessionSetup
          levels={levels}
          initialFilter={session && (session.filter.level === "all" || levels.includes(session.filter.level)) ? session.filter : DEFAULT_FILTER}
          initialSize={session?.size ?? DEFAULT_SIZE}
          countFor={(filter) => matchingCards(deck, filter).length}
          onCancel={session && session.queue.length > 0 ? () => setShowSetup(false) : undefined}
          onStart={begin}
        />
      ) : card && session ? (
        <>
          <Flashcard
            card={card}
            revealed={revealed}
            isNew={isNew}
            typing={settings.typeAnswers}
            accentsOptional={settings.accentsOptional}
            typed={typed}
            onTypedChange={setTyped}
            onReveal={reveal}
            onFlip={flip}
          />
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={dontKnow}
              className="rounded-full border border-rose-200 bg-rose-50 py-3 font-medium text-rose-800 hover:bg-rose-100 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-200 dark:hover:bg-rose-950/70"
            >
              ← I don&apos;t know it
            </button>
            <button
              type="button"
              onClick={know}
              className="rounded-full border border-emerald-200 bg-emerald-50 py-3 font-medium text-emerald-800 hover:bg-emerald-100 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-200 dark:hover:bg-emerald-950/70"
            >
              I know it →
            </button>
          </div>
          <p className="hidden text-center text-xs text-stone-400 sm:block">
            → know it · ← don&apos;t know it (back into the pile until you know it) · Space to flip
          </p>
        </>
      ) : session ? (
        <SessionDone
          session={session}
          onReviewMissed={() => updateSession(sessionOf(session.missed, session.filter, Math.random))}
          onNewSession={() => setShowSetup(true)}
        />
      ) : null}

      <footer className="mt-auto flex flex-wrap items-center justify-between gap-2 text-xs text-stone-500">
        <span>Known: {levels.map((l) => `${LEVEL_NAMES[l]} ${learned(l)}/${total(l)}`).join(" · ")}</span>
        <span>
          {streak(reviews, today)}-day streak · {reviewedOn(reviews, today)} answered today
        </span>
      </footer>
    </div>
  );
}

function SessionDone({ session, onReviewMissed, onNewSession }: { session: Session; onReviewMissed: () => void; onNewSession: () => void }) {
  const firstTry = session.total - session.missed.length;
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
      <p className="font-pt text-3xl leading-tight">Session complete</p>
      <p className="text-stone-500">
        {session.total} card{session.total === 1 ? "" : "s"} · {firstTry} known on the first try
        {session.missed.length > 0 && ` · ${session.missed.length} missed at least once`}
      </p>
      <div className="flex flex-wrap justify-center gap-2">
        {session.missed.length > 0 && (
          <button
            type="button"
            onClick={onReviewMissed}
            className="rounded-full border border-stone-300 px-5 py-3 font-medium hover:border-stone-700 dark:hover:border-stone-300 dark:border-stone-700"
          >
            Go over the {session.missed.length} I missed
          </button>
        )}
        <button
          type="button"
          onClick={onNewSession}
          className="rounded-full px-5 py-3 font-medium bg-red-700 text-white hover:bg-red-800 dark:bg-red-500 dark:text-white dark:hover:bg-red-400"
        >
          New session
        </button>
      </div>
    </div>
  );
}
