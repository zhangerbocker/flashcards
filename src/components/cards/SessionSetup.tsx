import { useState } from "react";
import type { CardFilter, CardSetKind } from "@/lib/deck";
import { SESSION_SIZES, type SessionSize } from "@/lib/session";
import { TOPICS, type Topic } from "@/lib/topics";
import { TENSE_NAMES, TENSES, type Tense } from "@/lib/verbs";
import { LEVEL_NAMES, LEVELS, type Level } from "@/lib/words";

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
  initialFilter: CardFilter;
  initialSize: SessionSize;
  /** Cards available for a filter, shown next to "All". */
  countFor: (filter: CardFilter) => number;
  /** Shown only when a session is in progress: lets the learner go back to it. */
  onCancel?: () => void;
  onStart: (filter: CardFilter, size: SessionSize) => void;
}

/** The "New session" screen: what to study and how many cards. */
export function SessionSetup({ initialFilter, initialSize, countFor, onCancel, onStart }: SessionSetupProps) {
  const [filter, setFilter] = useState<CardFilter>(initialFilter);
  const [size, setSize] = useState<SessionSize>(initialSize);
  const available = countFor(filter);
  const hasTopics = filter.kind === "words" || filter.kind === "sentences";
  const cards = size === "all" ? available : Math.min(size, available);

  return (
    <div className="flex flex-col gap-5 rounded-2xl border border-stone-200 p-4 dark:border-stone-800">
      <h2 className="text-lg font-semibold">New session</h2>

      <section className="flex flex-col gap-2">
        <h3 className="text-xs font-medium uppercase tracking-wide text-stone-500">Study</h3>
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
              <option value="all">All levels</option>
              {LEVELS.map((l) => (
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
                <button
                  type="button"
                  onClick={() => setFilter({ ...filter, face: filter.face === "r" ? "p" : "r" })}
                  className={selectClass}
                >
                  {filter.face === "r" ? "Português → English" : "English → Português"}
                </button>
              </>
            )}
          </div>
        )}
      </section>

      <section className="flex flex-col gap-2">
        <h3 className="text-xs font-medium uppercase tracking-wide text-stone-500">Cards</h3>
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
            className="flex-1 rounded-2xl border border-stone-300 py-3 font-medium dark:border-stone-700"
          >
            Back to session
          </button>
        )}
        <button
          type="button"
          disabled={cards === 0}
          onClick={() => onStart(filter, size)}
          className="flex-1 rounded-2xl bg-stone-900 py-3 font-medium text-white disabled:opacity-40 dark:bg-stone-100 dark:text-stone-900"
        >
          {cards === 0 ? "No cards match" : `Start · ${cards} card${cards === 1 ? "" : "s"}`}
        </button>
      </div>
    </div>
  );
}
