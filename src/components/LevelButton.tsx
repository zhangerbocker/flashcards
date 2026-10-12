"use client";

import { useSettings } from "./useSettings";

/** Tab-bar button that switches B1–B2 content on or off across the whole app. */
export function LevelButton({ className }: { className: string }) {
  const [settings, update] = useSettings();
  const on = settings.includeB1B2;
  return (
    <button
      type="button"
      onClick={() => update({ ...settings, includeB1B2: !on })}
      aria-pressed={on}
      aria-label={`Levels: ${on ? "A1 to B2" : "A1 to A2"}. Tap to ${on ? "hide" : "include"} B1–B2`}
      className={className}
    >
      <span className={`rounded-md px-1.5 text-sm font-semibold leading-5 ${on ? "bg-red-700 text-white dark:bg-red-500" : "bg-stone-200 text-stone-700 dark:bg-stone-800 dark:text-stone-200"}`}>
        {on ? "A1–B2" : "A1–A2"}
      </span>
      Levels
    </button>
  );
}
