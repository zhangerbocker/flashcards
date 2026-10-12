import { diffSentences } from "@/lib/answer";

/** A corrected sentence with removed text struck through and added text highlighted. */
export function Correction({ wrong, right, className = "text-3xl" }: { wrong: string; right: string; className?: string }) {
  const diff = diffSentences(wrong, right);
  return (
    <span className={`font-pt ${className}`}>
      {diff.map((d, i) =>
        d.status === "missing" ? (
          <mark key={i} className="rounded bg-emerald-200/70 px-0.5 text-inherit dark:bg-emerald-500/30">
            {d.text}
          </mark>
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
