/** Renders Chinese text with the given substrings emphasized (first occurrence of each). */
export function Highlighted({ text, parts, className = "" }: { text: string; parts: readonly string[]; className?: string }) {
  const ranges: [number, number][] = [];
  for (const part of parts) {
    if (!part) continue;
    const start = text.indexOf(part);
    if (start >= 0) ranges.push([start, start + part.length]);
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
    <span className={`font-han ${className}`}>
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
