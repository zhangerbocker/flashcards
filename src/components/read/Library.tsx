"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { knownShare, LIBRARY, saveCustomStory } from "@/lib/reading";
import type { Story } from "@/lib/story";
import { TOPICS, type Topic } from "@/lib/topics";
import { LEVEL_NAMES, type Level } from "@/lib/words";
import { useActiveLevels, useCustomStories, useProgress, useReadIds } from "../useSettings";

function StoryCard({ story, share, read }: { story: Story; share: number; read: boolean }) {
  return (
    <Link
      href={`/read/${story.id}`}
      className="flex items-center justify-between gap-3 rounded-[20px] border border-stone-200 bg-white px-4 py-3 shadow-[0_30px_60px_-44px_rgba(27,25,22,0.5)] transition hover:-translate-y-0.5 hover:border-red-700 dark:border-stone-800 dark:bg-stone-900"
    >
      <span className="min-w-0">
        <span className="font-pt block truncate text-lg">{story.title}</span>
        <span className="block truncate text-xs text-stone-500">
          {story.titleEn}
          {story.id.startsWith("c-") ? " · new" : ""}
        </span>
      </span>
      <span className="shrink-0 text-right text-xs">
        <span className="block text-stone-700 dark:text-stone-300">{Math.round(share * 100)}% known</span>
        {read && <span className="block text-emerald-700 dark:text-emerald-400">Read</span>}
      </span>
    </Link>
  );
}

export function Library() {
  const router = useRouter();
  const levels = useActiveLevels();
  const [chosen, setLevel] = useState<Level>(1);
  // Falls back to A1 when the chosen level is switched off.
  const level = levels.includes(chosen) ? chosen : 1;
  const progress = useProgress();
  const readIds = useReadIds();
  const custom = useCustomStories();
  const [generating, setGenerating] = useState<Topic | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function newStory(topic: Topic) {
    setGenerating(topic);
    setError(null);
    try {
      const res = await fetch("/api/stories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ level, topic }),
        signal: AbortSignal.timeout(180_000),
      });
      const data = (await res.json()) as { story?: Story; error?: string };
      if (!res.ok || !data.story) throw new Error(data.error ?? `server returned ${res.status}`);
      saveCustomStory(window.localStorage, data.story);
      router.push(`/read/${data.story.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setGenerating(null);
    }
  }

  const all = [...LIBRARY, ...custom].filter((s) => s.level === level);

  return (
    <div className="flex flex-col gap-5">
      <header className="flex items-center justify-between">
        <h1 className="font-pt text-3xl leading-tight">Reading</h1>
        <div className="flex rounded-full bg-stone-200 p-1 text-sm dark:bg-stone-800">
          {levels.map((l) => (
            <button
              key={l}
              type="button"
              onClick={() => setLevel(l)}
              className={`rounded-full px-4 py-1.5 ${level === l ? "bg-white shadow-sm dark:bg-stone-950" : "text-stone-600 dark:text-stone-400"}`}
            >
              {LEVEL_NAMES[l]}
            </button>
          ))}
        </div>
      </header>

      {error && <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-900/30 dark:text-red-300">{error}</p>}

      {TOPICS.map((topic) => {
        const stories = all.filter((s) => s.topic === topic);
        return (
          <section key={topic} className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-medium text-stone-600 dark:text-stone-400">{topic}</h2>
              <button
                type="button"
                disabled={generating !== null}
                onClick={() => newStory(topic)}
                className="rounded-full border border-stone-300 px-3 py-1 text-xs disabled:opacity-50 dark:border-stone-700"
              >
                {generating === topic ? "Writing… ~1 min" : "New story"}
              </button>
            </div>
            {stories.length ? (
              stories.map((s) => <StoryCard key={s.id} story={s} share={knownShare(s, progress)} read={readIds.has(s.id)} />)
            ) : (
              <p className="text-xs text-stone-400">No stories yet.</p>
            )}
          </section>
        );
      })}
    </div>
  );
}
