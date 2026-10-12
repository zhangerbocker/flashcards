// One-off import of the HSK 3.0 (2025) word list, parsed from the Mandarin Zone
// PDFs that follow the CLEC syllabus, into the app's content format.
// Usage: node scripts/import-words.mjs <parsed-list.json> <out.json>
import { readFileSync, writeFileSync } from "node:fs";

const [src, out] = process.argv.slice(2);
if (!src || !out) {
  console.error("usage: node scripts/import-words.mjs <parsed-list.json> <out.json>");
  process.exit(1);
}

// The PDF text extraction truncated or garbled a few entries; these match the
// fixes applied when the same list was reviewed in Notion.
const FIXES = {
  144: { english: "(question particle: and you? / what about?)" },
  301: { english: "(modal particle for agreement, emphasis or surprise)" },
  313: { pinyin: "bù hǎoyìsi" },
  327: { english: "to hit; to play (a ball game); to make (a phone call)" },
  332: { english: "(particle linking a verb to a degree/result complement)" },
  333: { english: "(particle that turns an adjective into an adverb)" },
  403: { english: "side; surface; noodles; (mw. for flat things)" },
  443: { english: "(mw. for long thin things: roads, rivers, fish, trousers)" },
  471: { pos: "n./adv." },
};

const raw = JSON.parse(readFileSync(src, "utf8"));
const words = raw.map((w) => {
  const word = {
    id: w.n,
    hanzi: w.hanzi,
    pinyin: w.pinyin,
    pos: w.pos,
    english: w.en,
    level: Number(w.level),
    example: { zh: w.ex, pinyin: w.ex_py, en: w.ex_en },
  };
  return { ...word, ...FIXES[w.n] };
});

const bad = words.filter((w) => !w.hanzi || !w.english || ![1, 2].includes(w.level) || w.english.includes("…"));
if (words.length !== 500 || bad.length) {
  console.error(`expected 500 clean words, got ${words.length} (${bad.length} bad)`, bad.slice(0, 3));
  process.exit(1);
}
writeFileSync(out, JSON.stringify(words, null, 1) + "\n");
console.log(`wrote ${words.length} words to ${out}`);
