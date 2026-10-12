import { useState } from "react";
import { SCENARIOS } from "@/lib/chat";
import { LEVEL_NAMES, type Level } from "@/lib/words";
import { useActiveLevels } from "../useSettings";

export function ChatSetup({ starting, onStart }: { starting: boolean; onStart: (level: Level, scenario: string) => void }) {
  const levels = useActiveLevels();
  const [chosen, setLevel] = useState<Level>(1);
  // Falls back to A1 when the chosen level is switched off.
  const level = levels.includes(chosen) ? chosen : 1;
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">Chat</h1>
        <div className="flex rounded-full bg-stone-200 p-1 text-sm dark:bg-stone-800">
          {levels.map((l) => (
            <button
              key={l}
              type="button"
              aria-pressed={level === l}
              onClick={() => setLevel(l)}
              className={`rounded-full px-4 py-1.5 ${level === l ? "bg-white shadow-sm dark:bg-stone-950" : "text-stone-600 dark:text-stone-400"}`}
            >
              {LEVEL_NAMES[l]}
            </button>
          ))}
        </div>
      </div>
      <p className="text-sm text-stone-500">Pick a situation. Write in Portuguese (English for words you don&apos;t know is fine) and every message gets checked.</p>
      <ul className="flex flex-col gap-2">
        {SCENARIOS.map((s) => (
          <li key={s.id}>
            <button
              type="button"
              disabled={starting}
              onClick={() => onStart(level, s.id)}
              className="w-full rounded-2xl border border-stone-200 p-4 text-left hover:border-red-300 disabled:opacity-50 dark:border-stone-800 dark:hover:border-red-900"
            >
              <span className="block font-medium">{s.title}</span>
              <span className="block text-sm text-stone-500">{s.blurb}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
