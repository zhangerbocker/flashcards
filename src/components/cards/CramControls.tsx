import type { CramFilter, CramKind } from "@/lib/deck";
import { TOPICS, type Topic } from "@/lib/topics";
import { TENSE_NAMES, TENSES, type Tense } from "@/lib/verbs";
import { LEVEL_NAMES, LEVELS, type Level } from "@/lib/words";

const KINDS: { kind: CramKind; label: string }[] = [
  { kind: "words", label: "Words" },
  { kind: "sentences", label: "Sentences" },
  { kind: "grammar", label: "Grammar" },
  { kind: "verbs", label: "Verbs" },
  { kind: "mistakes", label: "Mistakes" },
];

const selectClass =
  "rounded-lg border border-stone-300 bg-transparent px-2 py-1 text-sm dark:border-stone-700 dark:bg-stone-950";

interface CramControlsProps {
  filter: CramFilter;
  mistakeCount: number;
  remaining: number;
  onChange: (filter: CramFilter) => void;
}

export function CramControls({ filter, mistakeCount, remaining, onChange }: CramControlsProps) {
  const hasTopics = filter.kind === "words" || filter.kind === "sentences";
  return (
    <div className="flex flex-col gap-2 rounded-2xl border border-stone-200 p-3 dark:border-stone-800">
      <div className="flex flex-wrap gap-1">
        {KINDS.map(({ kind, label }) => (
          <button
            key={kind}
            type="button"
            onClick={() => onChange({ ...filter, kind })}
            className={`rounded-full px-3 py-1 text-sm ${
              filter.kind === kind
                ? "bg-red-700 text-white dark:bg-red-500"
                : "bg-stone-100 text-stone-600 dark:bg-stone-800 dark:text-stone-300"
            }`}
          >
            {label}
            {kind === "mistakes" ? ` (${mistakeCount})` : ""}
          </button>
        ))}
      </div>
      {filter.kind !== "mistakes" && (
        <div className="flex flex-wrap items-center gap-2">
          <select
            aria-label="Level"
            value={String(filter.level)}
            onChange={(e) =>
              onChange({ ...filter, level: e.target.value === "all" ? "all" : (Number(e.target.value) as Level) })
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
              onChange={(e) => onChange({ ...filter, tense: e.target.value as Tense | "all" })}
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
                onChange={(e) => onChange({ ...filter, topic: e.target.value as Topic | "all" })}
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
                onClick={() => onChange({ ...filter, face: filter.face === "r" ? "p" : "r" })}
                className={selectClass}
              >
                {filter.face === "r" ? "Português → English" : "English → Português"}
              </button>
            </>
          )}
          <span className="ml-auto text-xs text-stone-500">{remaining} left</span>
        </div>
      )}
    </div>
  );
}
