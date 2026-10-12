import { diffSentences } from "@/lib/answer";

/**
 * A corrected sentence with removed text struck through, added text highlighted, and words
 * that only needed an accent underlined in their corrected spelling.
 */
export function Correction({ wrong, right, className = "text-3xl" }: { wrong: string; right: string; className?: string }) {
  const diff = diffSentences(wrong, right);
  return (
    <span className={`font-pt ${className}`}>
      {diff.map((d, i) =>
        d.status === "missing" ? (
          <mark key={i} className="rounded bg-emerald-200/70 px-0.5 text-inherit dark:bg-emerald-500/30">
            {d.text}
          </mark>
        ) : d.status === "accent" ? (
          <span key={i} className="underline decoration-amber-500 decoration-dotted decoration-2 underline-offset-4" title="accent">
            {d.text}
          </span>
        ) : d.status === "extra" ? (
          <del key={i} className="text-red-600 dark:text-red-400">
            {d.text}
          </del>
        ) : (
          <span key={i}>{d.text}</span>
        ),
      )}
    </span>
  );
}
