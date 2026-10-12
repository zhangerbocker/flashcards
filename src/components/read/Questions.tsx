"use client";

import { useState } from "react";
import type { Story } from "@/lib/story";

/** Multiple-choice comprehension questions; each locks after the first answer and shows the right one. */
export function Questions({ story }: { story: Story }) {
  const [answers, setAnswers] = useState<(number | null)[]>(() => story.questions.map(() => null));
  const [showEn, setShowEn] = useState<boolean[]>(() => story.questions.map(() => false));
  if (story.questions.length === 0) return null;
  const correct = answers.filter((a, i) => a === story.questions[i].answer).length;
  const done = answers.every((a) => a !== null);

  return (
    <section className="flex flex-col gap-4 border-t border-stone-200 pt-5 dark:border-stone-800">
      <h2 className="text-sm font-medium text-stone-600 dark:text-stone-400">
        Questions{done ? ` · ${correct}/${story.questions.length} correct` : ""}
      </h2>
      {story.questions.map((q, qi) => (
        <div key={qi} className="flex flex-col gap-2">
          <div className="flex items-start justify-between gap-2">
            <p className="font-pt text-lg">{q.q}</p>
            <button
              type="button"
              onClick={() => setShowEn((s) => s.map((v, i) => (i === qi ? !v : v)))}
              className="shrink-0 rounded-full border border-stone-300 px-2 py-0.5 text-xs text-stone-500 dark:border-stone-700"
            >
              EN
            </button>
          </div>
          {showEn[qi] && <p className="-mt-1 text-sm text-stone-500">{q.qEn}</p>}
          <div className="grid grid-cols-2 gap-2">
            {q.options.map((option, oi) => {
              const chosen = answers[qi];
              const state =
                chosen === null ? "idle" : oi === q.answer ? "right" : oi === chosen ? "wrong" : "idle";
              return (
                <button
                  key={oi}
                  type="button"
                  disabled={chosen !== null}
                  onClick={() => setAnswers((a) => a.map((v, i) => (i === qi ? oi : v)))}
                  className={`font-pt rounded-xl border px-3 py-2 text-left ${
                    state === "right"
                      ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-900/30"
                      : state === "wrong"
                        ? "border-red-500 bg-red-50 dark:bg-red-900/30"
                        : "border-stone-200 dark:border-stone-800"
                  }`}
                >
                  {option}
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </section>
  );
}
