import { checkAnswer } from "@/lib/answer";

interface Expected {
  zh: string;
  pinyin?: string;
}

/** Optional typed answer for production cards; submitting reveals the card. */
export function AnswerInput({
  value,
  acceptsPinyin,
  onChange,
  onSubmit,
}: {
  value: string;
  acceptsPinyin: boolean;
  onChange: (value: string) => void;
  onSubmit: () => void;
}) {
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit();
      }}
      onClick={(e) => e.stopPropagation()}
      className="w-full"
    >
      <input
        autoFocus
        lang="zh-CN"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={acceptsPinyin ? "Chinese or pinyin" : "Type in Chinese"}
        className="font-han w-full rounded-xl border border-stone-300 bg-white px-4 py-3 text-lg outline-none focus:border-red-700 dark:border-stone-700 dark:bg-stone-950"
      />
    </form>
  );
}

/** Shows whether the typed answer matched, with a character diff when it didn't. */
export function AnswerResult({ typed, expected }: { typed: string; expected: Expected }) {
  if (!typed.trim()) return null;
  const result = checkAnswer(typed, expected.zh, expected.pinyin);
  return (
    <div
      className={`w-full rounded-xl px-4 py-3 text-left ${
        result.correct ? "bg-emerald-50 dark:bg-emerald-900/30" : "bg-red-50 dark:bg-red-900/30"
      }`}
    >
      <p
        className={`text-sm font-medium ${
          result.correct ? "text-emerald-700 dark:text-emerald-300" : "text-red-700 dark:text-red-300"
        }`}
      >
        {result.correct ? "Correct" : "Not quite"}
      </p>
      {!result.correct && (
        <>
          <p className="font-han mt-1 text-xl">
            {result.diff.map((d, i) => (
              <span
                key={i}
                className={
                  d.status === "extra"
                    ? "text-red-600 line-through"
                    : d.status === "missing"
                      ? "rounded bg-emerald-200/70 px-0.5 dark:bg-emerald-500/30"
                      : ""
                }
              >
                {d.text}
              </span>
            ))}
          </p>
          <p className="mt-1 text-xs text-stone-500">Struck through: extra · highlighted: missing</p>
        </>
      )}
    </div>
  );
}
