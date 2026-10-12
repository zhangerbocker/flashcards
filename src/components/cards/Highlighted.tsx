/**
 * Renders Portuguese text with the given words or phrases emphasized (first whole-word
 * occurrence of each, ignoring case).
 */
export function Highlighted({ text, parts, className = "" }: { text: string; parts: readonly string[]; className?: string }) {
  const ranges: [number, number][] = [];
  const lower = text.toLowerCase();
  for (const part of parts) {
    if (!part) continue;
    const escaped = part.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const match = new RegExp(`(?<![\\p{L}\\p{M}])${escaped}(?![\\p{L}\\p{M}])`, "u").exec(lower);
    if (match) ranges.push([match.index, match.index + part.length]);
  }
  ranges.sort((a, b) => a[0] - b[0]);

  const pieces: { text: string; mark: boolean }[] = [];
  let cursor = 0;
  for (const [start, end] of ranges) {
    if (start < cursor) continue; // overlapping highlight; keep the first
    if (start > cursor) pieces.push({ text: text.slice(cursor, start), mark: false });
    pieces.push({ text: text.slice(start, end), mark: true });
    cursor = end;
  }
  if (cursor < text.length) pieces.push({ text: text.slice(cursor), mark: false });

  return (
    <span className={`font-pt ${className}`}>
      {pieces.map((p, i) =>
        p.mark ? (
          <mark key={i} className="rounded bg-amber-200/70 px-0.5 text-inherit dark:bg-amber-500/30">
            {p.text}
          </mark>
        ) : (
          <span key={i}>{p.text}</span>
        ),
      )}
    </span>
  );
}
