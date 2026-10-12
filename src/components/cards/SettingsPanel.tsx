"use client";

import type { Settings } from "@/lib/progress-store";

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

export function SettingsPanel({ settings, onChange }: { settings: Settings; onChange: (s: Settings) => void }) {
  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-stone-200 p-4 dark:border-stone-800">
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
