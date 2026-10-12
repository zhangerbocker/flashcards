"use client";

import type { Settings } from "@/lib/progress-store";

const QUOTAS = [0, 3, 5, 10, 20, 30, 50, 80];

function Toggle({ label, hint, checked, onChange }: { label: string; hint: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-start justify-between gap-3">
      <span>
        <span className="block text-sm">{label}</span>
        <span className="block text-xs text-stone-500">{hint}</span>
      </span>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="mt-1 h-4 w-4 accent-red-700" />
    </label>
  );
}

function Quota({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <label className="flex items-center justify-between gap-3 text-sm">
      {label}
      <select
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="rounded-lg border border-stone-300 bg-transparent px-2 py-1 dark:border-stone-700 dark:bg-stone-950"
      >
        {(QUOTAS.includes(value) ? QUOTAS : [...QUOTAS, value].sort((a, b) => a - b)).map((n) => (
          <option key={n} value={n}>
            {n}
          </option>
        ))}
      </select>
    </label>
  );
}

export function SettingsPanel({ settings, onChange }: { settings: Settings; onChange: (s: Settings) => void }) {
  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-stone-200 p-4 dark:border-stone-800">
      <Quota label="New words per day" value={settings.newPerDay} onChange={(v) => onChange({ ...settings, newPerDay: v })} />
      <Quota
        label="New grammar & verb drills per day"
        value={settings.newGrammarPerDay}
        onChange={(v) => onChange({ ...settings, newGrammarPerDay: v })}
      />
      <p className="-mt-2 text-xs text-stone-500">
        Each word has one schedule; its reviews take turns: word, English → Português, sentence, sentence English →
        Português. Grammar points unlock as you learn their words; a verb&apos;s conjugation drills unlock once you know
        the verb, one tense at a time.
      </p>
      <Toggle
        label="Type answers"
        hint="Type the Portuguese on English → Português, grammar and verb cards, then check it."
        checked={settings.typeAnswers}
        onChange={(v) => onChange({ ...settings, typeAnswers: v })}
      />
      <Toggle
        label="Play audio on reveal"
        hint="Reads the Portuguese aloud when you show the answer."
        checked={settings.autoplayAudio}
        onChange={(v) => onChange({ ...settings, autoplayAudio: v })}
      />
    </div>
  );
}
