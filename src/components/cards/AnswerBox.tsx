import { checkAnswer } from "@/lib/answer";

interface Expected {
  pt: string;
  alternatives?: string[];
}

/** Optional typed answer for production cards; submitting reveals the card. */
export function AnswerInput({
  value,
  onChange,
  onSubmit,
}: {
  value: string;
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
        lang="pt-BR"
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck={false}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Type in Portuguese"
        className="font-pt w-full rounded-xl border border-stone-300 bg-white px-4 py-3 text-lg outline-none focus:border-red-700 dark:border-stone-700 dark:bg-stone-950"
      />
    </form>
  );
}

/** Shows whether the typed answer matched, with a character diff when it didn't. */
export function AnswerResult({ typed, expected }: { typed: string; expected: Expected }) {
  if (!typed.trim()) return null;
  const result = checkAnswer(typed, expected.pt, expected.alternatives);
  const tone = result.correct ? "emerald" : result.accentsOnly ? "amber" : "red";
  const styles = {
    emerald: ["bg-emerald-50 dark:bg-emerald-900/30", "text-emerald-700 dark:text-emerald-300"],
    amber: ["bg-amber-50 dark:bg-amber-900/30", "text-amber-800 dark:text-amber-300"],
    red: ["bg-red-50 dark:bg-red-900/30", "text-red-700 dark:text-red-300"],
  }[tone];
  return (
    <div className={`w-full rounded-xl px-4 py-3 text-left ${styles[0]}`}>
      <p className={`text-sm font-medium ${styles[1]}`}>
        {result.correct ? "Correct" : result.accentsOnly ? "Almost: check the accents" : "Not quite"}
      </p>
      {!result.correct && (
        <>
          <p className="font-pt mt-1 text-xl">
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
