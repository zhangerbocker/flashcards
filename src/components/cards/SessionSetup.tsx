import { useState } from "react";
import type { CardFilter, CardSetKind } from "@/lib/deck";
import { SESSION_SIZES, type SessionSize } from "@/lib/session";
import { TOPICS, type Topic } from "@/lib/topics";
import { TENSE_NAMES, TENSES, type Tense } from "@/lib/verbs";
import { LEVEL_NAMES, type Level } from "@/lib/words";

const KINDS: { kind: CardSetKind; label: string }[] = [
  { kind: "words", label: "Words" },
  { kind: "sentences", label: "Sentences" },
  { kind: "grammar", label: "Grammar" },
  { kind: "verbs", label: "Verbs" },
  { kind: "mistakes", label: "Mistakes" },
];

const selectClass =
  "rounded-lg border border-stone-300 bg-transparent px-2 py-1 text-sm dark:border-stone-700 dark:bg-stone-950";

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={`rounded-full px-3 py-1 text-sm ${
        active ? "bg-red-700 text-white dark:bg-red-500" : "bg-stone-100 text-stone-600 dark:bg-stone-800 dark:text-stone-300"
      }`}
    >
      {children}
    </button>
  );
}

interface SessionSetupProps {
  /** The levels switched on. */
  levels: readonly Level[];
  initialFilter: CardFilter;
  initialSize: SessionSize;
  /** Cards available for a filter, shown next to "All". */
  countFor: (filter: CardFilter) => number;
  /** Shown only when a session is in progress: lets the learner go back to it. */
  onCancel?: () => void;
  onStart: (filter: CardFilter, size: SessionSize) => void;
}

/** The "New session" screen: what to study and how many cards. */
export function SessionSetup({ levels, initialFilter, initialSize, countFor, onCancel, onStart }: SessionSetupProps) {
  const [filter, setFilter] = useState<CardFilter>(initialFilter);
  const [size, setSize] = useState<SessionSize>(initialSize);
  const available = countFor(filter);
  const hasTopics = filter.kind === "words" || filter.kind === "sentences";
  const cards = size === "all" ? available : Math.min(size, available);

  return (
    <div className="flex flex-col gap-5 rounded-[22px] border border-stone-200 bg-white p-5 shadow-[0_30px_60px_-44px_rgba(27,25,22,0.5)] dark:border-stone-800 dark:bg-stone-900">
      <h2 className="font-pt text-3xl leading-tight">New session</h2>

      <section className="flex flex-col gap-2">
        <h3 className="font-mono text-[11px] font-medium uppercase tracking-[0.18em] text-red-700 dark:text-red-400">Study</h3>
        <div className="flex flex-wrap gap-1">
          {KINDS.map(({ kind, label }) => (
            <Chip key={kind} active={filter.kind === kind} onClick={() => setFilter({ ...filter, kind })}>
              {label}
            </Chip>
          ))}
        </div>
        {filter.kind !== "mistakes" && (
          <div className="flex flex-wrap items-center gap-2">
            <select
              aria-label="Level"
              value={String(filter.level)}
              onChange={(e) =>
                setFilter({ ...filter, level: e.target.value === "all" ? "all" : (Number(e.target.value) as Level) })
              }
              className={selectClass}
            >
              <option value="all">
                {levels.map((l) => LEVEL_NAMES[l]).join(" + ")}
              </option>
              {levels.map((l) => (
                <option key={l} value={l}>
                  {LEVEL_NAMES[l]}
                </option>
              ))}
            </select>
            {filter.kind === "verbs" && (
              <select
                aria-label="Tense"
                value={filter.tense ?? "all"}
                onChange={(e) => setFilter({ ...filter, tense: e.target.value as Tense | "all" })}
                className={selectClass}
              >
                <option value="all">All tenses</option>
                {TENSES.map((t) => (
                  <option key={t} value={t}>
                    {TENSE_NAMES[t]}
                  </option>
                ))}
              </select>
            )}
            {hasTopics && (
              <>
                <select
                  aria-label="Topic"
                  value={filter.topic}
                  onChange={(e) => setFilter({ ...filter, topic: e.target.value as Topic | "all" })}
                  className={selectClass}
                >
                  <option value="all">All topics</option>
                  {TOPICS.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </>
            )}
          </div>
        )}
      </section>

      {hasTopics && (
        <section className="flex flex-col gap-2">
          <h3 className="font-mono text-[11px] font-medium uppercase tracking-[0.18em] text-red-700 dark:text-red-400">Direction</h3>
          <div className="flex flex-wrap gap-1">
            <Chip active={filter.face === "r"} onClick={() => setFilter({ ...filter, face: "r" })}>
              Português → English
            </Chip>
            <Chip active={filter.face === "p"} onClick={() => setFilter({ ...filter, face: "p" })}>
              English → Português
            </Chip>
          </div>
          <p className="text-xs text-stone-500">
            {filter.face === "r"
              ? "See the Portuguese, recall what it means."
              : "See the meaning, recall the Portuguese (turn on “Type answers” in settings to type it)."}
          </p>
        </section>
      )}

      <section className="flex flex-col gap-2">
        <h3 className="font-mono text-[11px] font-medium uppercase tracking-[0.18em] text-red-700 dark:text-red-400">Cards</h3>
        <div className="flex flex-wrap gap-1">
          {SESSION_SIZES.map((n) => (
            <Chip key={n} active={size === n} onClick={() => setSize(n)}>
              {n}
            </Chip>
          ))}
          <Chip active={size === "all"} onClick={() => setSize("all")}>
            All ({available})
          </Chip>
        </div>
        <p className="text-xs text-stone-500">
          Cards you missed last time come first, then words you added, cards due again, new cards, and finally cards you
          already know.
        </p>
      </section>

      <div className="flex gap-2">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 rounded-full border border-stone-300 py-3 font-medium hover:border-stone-700 dark:hover:border-stone-300 dark:border-stone-700"
          >
            Back to session
          </button>
        )}
        <button
          type="button"
          disabled={cards === 0}
          onClick={() => onStart(filter, size)}
          className="flex-1 rounded-full py-3 font-medium bg-red-700 text-white hover:bg-red-800 dark:bg-red-500 dark:text-white dark:hover:bg-red-400 disabled:opacity-40"
        >
          {cards === 0 ? "No cards match" : `Start · ${cards} card${cards === 1 ? "" : "s"}`}
        </button>
      </div>
    </div>
  );
}
