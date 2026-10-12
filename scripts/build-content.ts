// Builds the app's content from the hand-written drafts in data/drafts/ and data/irregular-verbs.json:
//   data/words.json    every word, with ids kept stable across rebuilds and verb forms filled in
//   data/verbs.json    a conjugation table for every verb (regular verbs computed, irregular from the file)
//   data/grammar.json  grammar points, with the words their examples use
//   data/stories.json  stories, tokenized and glossed
//
// Run in this folder:
//   npx tsx scripts/build-content.ts            build everything (fails on any problem)
//   npx tsx scripts/build-content.ts --check    report problems without writing
//   npx tsx scripts/build-content.ts --check stories/b1-   only check drafts whose path contains "stories/b1-"
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { buildLexicon, lookupForm, segment, unknownTokens } from "../src/lib/segment";
import { loadExtras } from "../src/lib/server/extras";
import { buildStory, draftProblems, type Gloss, type StoryDraft, type StoryQuestion } from "../src/lib/story";
import { isTopic, TOPICS, type Topic } from "../src/lib/topics";
import { isConjugation, regularForms, verbForms, type Conjugation, type Verb } from "../src/lib/verbs";
import { isLevel, type Gender, type Level, type Word } from "../src/lib/words";
import type { GrammarPoint } from "../src/lib/grammar";

const DATA = "data";
const DRAFTS = path.join(DATA, "drafts");

const args = process.argv.slice(2);
const checkOnly = args.includes("--check");
const only = args.find((a) => !a.startsWith("--"));

const problems: string[] = [];
const problem = (where: string, message: string) => problems.push(`${where}: ${message}`);

function readJson<T>(file: string): T {
  try {
    return JSON.parse(readFileSync(file, "utf8")) as T;
  } catch (err) {
    throw new Error(`${file}: ${err instanceof Error ? err.message : err}`);
  }
}

function draftFiles(kind: string): string[] {
  const dir = path.join(DRAFTS, kind);
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => f.endsWith(".json"))
    .sort()
    .map((f) => path.join(dir, f));
}

// ---------------------------------------------------------------- words

interface WordDraft {
  pt: string;
  pos: string;
  english: string;
  level: Level;
  topic: Topic;
  gender?: Gender;
  forms?: string[];
  example: { pt: string; en: string };
}

/** Words with the same written form and a similar part of speech are one entry (keeps the lowest level). */
const posClass = (pos: string) => (pos.startsWith("v.") ? "v" : pos.startsWith("n.") ? "n" : pos.startsWith("adj") ? "adj" : pos);
const wordKey = (pt: string, pos: string) => `${lookupForm(pt)}|${posClass(pos)}`;

function loadWordDrafts(): (WordDraft & { file: string })[] {
  return draftFiles("words").flatMap((file) => {
    const entries = readJson<unknown[]>(file);
    if (!Array.isArray(entries)) {
      problem(file, "must be a JSON array");
      return [];
    }
    return entries.flatMap((e, i) => {
      const w = e as WordDraft;
      const where = `${file}[${i}] ${w?.pt ?? ""}`;
      const bad: string[] = [];
      if (typeof w.pt !== "string" || !w.pt.trim()) bad.push("pt");
      if (typeof w.pos !== "string") bad.push("pos");
      if (typeof w.english !== "string" || !w.english.trim()) bad.push("english");
      if (!isLevel(w.level)) bad.push("level (1-4)");
      if (!isTopic(w.topic)) bad.push(`topic (one of ${TOPICS.join(", ")})`);
      if (w.gender !== undefined && !["m", "f", "mf"].includes(w.gender)) bad.push("gender (m, f or mf)");
      if (w.forms !== undefined && (!Array.isArray(w.forms) || !w.forms.every((f) => typeof f === "string"))) bad.push("forms");
      if (typeof w.example?.pt !== "string" || typeof w.example?.en !== "string") bad.push("example {pt, en}");
      if (bad.length) {
        problem(where, `bad or missing ${bad.join(", ")}`);
        return [];
      }
      if (posClass(w.pos) === "n" && !w.pos.includes("adj") && !w.gender) problem(where, "nouns need a gender");
      return [{ ...w, pt: w.pt.normalize("NFC").trim(), file }];
    });
  });
}

/** A preposition + what it merges with, for phrases ending in one (apesar de → apesar disso, perto da). */
const CONTRACTIONS: Record<string, string[]> = {
  de: ["do", "da", "dos", "das", "dele", "dela", "deles", "delas", "disso", "disto", "daquilo", "deste", "desta", "desse", "dessa", "daquele", "daquela", "daqui", "dali", "dum", "duma"],
  em: ["no", "na", "nos", "nas", "nele", "nela", "neles", "nelas", "nisso", "nisto", "naquilo", "neste", "nesta", "nesse", "nessa", "naquele", "naquela", "num", "numa"],
  a: ["ao", "aos", "à", "às", "àquele", "àquela", "àquilo"],
  por: ["pelo", "pela", "pelos", "pelas"],
};

function contractedForms(pt: string): string[] {
  const m = /^(.+) (de|em|a|por)$/.exec(lookupForm(pt));
  return m ? CONTRACTIONS[m[2]].map((c) => `${m[1]} ${c}`) : [];
}

function buildWords(irregular: Record<string, Conjugation>): { words: Word[]; verbs: Verb[] } {
  const drafts = loadWordDrafts();
  const existing = existsSync(path.join(DATA, "words.json")) ? readJson<Word[]>(path.join(DATA, "words.json")) : [];
  const idByKey = new Map(existing.map((w) => [wordKey(w.pt, w.pos), w.id]));
  let nextId = Math.max(0, ...existing.map((w) => w.id)) + 1;

  // Lowest level wins for duplicates; the first draft at that level supplies the entry,
  // and the others' inflected forms are added to it.
  const byKey = new Map<string, WordDraft & { file: string }>();
  for (const d of [...drafts].sort((a, b) => a.level - b.level)) {
    const key = wordKey(d.pt, d.pos);
    const kept = byKey.get(key);
    if (!kept) byKey.set(key, { ...d, forms: [...(d.forms ?? [])] });
    else kept.forms = [...(kept.forms ?? []), ...(d.forms ?? [])];
  }

  // Conjugation tables by infinitive, for verbs in the list and for phrases that start with one
  // (valer a pena → valeria a pena, vale a pena).
  const tableOf = (inf: string) => irregular[inf] ?? regularForms(inf);
  const listedVerbs = new Set([...byKey.values()].filter((d) => d.pos.split("/").some((p) => p.trim() === "v.")).map((d) => d.pt));
  const phraseForms = (pt: string): string[] => {
    const [first, ...rest] = pt.split(" ");
    if (rest.length === 0 || !(listedVerbs.has(first) || first in irregular)) return [];
    const table = tableOf(first);
    return table ? [first, ...verbForms({ ...table, infinitive: first })].map((f) => `${f} ${rest.join(" ")}`) : [];
  };

  const words: Word[] = [];
  const verbs: Verb[] = [];
  for (const d of byKey.values()) {
    const key = wordKey(d.pt, d.pos);
    const id = idByKey.get(key) ?? nextId++;
    let forms = (d.forms ?? []).map((f) => f.normalize("NFC").toLowerCase().trim()).filter(Boolean);
    // "v." or a combination such as "n./v." (o jantar / jantar): conjugate it.
    if (d.pos.split("/").some((part) => part.trim() === "v.")) {
      const table = irregular[d.pt] ?? regularForms(d.pt);
      if (!table) {
        problem(`${d.file} ${d.pt}`, "irregular infinitive with no entry in data/irregular-verbs.json");
      } else {
        verbs.push({ wordId: id, infinitive: d.pt, irregular: d.pt in irregular, ...table });
        forms = [...verbForms({ ...table, infinitive: d.pt }), ...forms];
      }
    }
    forms = [...new Set([...forms, ...phraseForms(d.pt), ...contractedForms(d.pt)])].filter((f) => f !== d.pt.toLowerCase());
    const word: Word = {
      id,
      pt: d.pt,
      pos: d.pos,
      english: d.english,
      level: d.level,
      topic: d.topic,
      ...(d.gender ? { gender: d.gender } : {}),
      forms,
      example: d.example,
    };
    // The example must use the word in some form.
    const sentence = ` ${lookupForm(d.example.pt).replace(/[^\p{L}\p{M} ]/gu, " ").replace(/\s+/g, " ")} `;
    if (![d.pt, ...forms].some((f) => sentence.includes(` ${lookupForm(f)} `))) {
      problem(`${d.file} ${d.pt}`, `example doesn't use the word: "${d.example.pt}"`);
    }
    words.push(word);
  }
  const topicRank = (t: Topic) => TOPICS.indexOf(t);
  words.sort((a, b) => a.level - b.level || topicRank(a.topic) - topicRank(b.topic) || a.id - b.id);
  verbs.sort((a, b) => a.wordId - b.wordId);
  return { words, verbs };
}

function loadIrregular(): Record<string, Conjugation> {
  const file = path.join(DATA, "irregular-verbs.json");
  const raw = readJson<Record<string, unknown>>(file);
  const out: Record<string, Conjugation> = {};
  for (const [inf, table] of Object.entries(raw)) {
    if (inf.startsWith("_")) continue;
    if (!isConjugation(table)) problem(file, `${inf}: needs all 8 tenses (4 forms each), gerund and participle`);
    else out[inf.normalize("NFC")] = table;
  }
  return out;
}

// ---------------------------------------------------------------- grammar

type GrammarDraft = Omit<GrammarPoint, "wordIds">;

function buildGrammar(words: readonly Word[], extras: ReadonlySet<string>): GrammarPoint[] {
  const out: GrammarPoint[] = [];
  const ids = new Set<string>();
  for (const file of draftFiles("grammar")) {
    for (const g of readJson<GrammarDraft[]>(file)) {
      const where = `${file} ${g.id}`;
      if (ids.has(g.id)) problem(where, "duplicate id");
      ids.add(g.id);
      if (!isLevel(g.level)) problem(where, "level must be 1-4");
      if (!Array.isArray(g.examples) || g.examples.length < 2) problem(where, "needs at least 2 examples");
      if (!g.mistake || g.mistake.wrong === g.mistake.right) problem(where, "mistake.wrong must differ from mistake.right");
      const lexicon = buildLexicon(words.filter((w) => w.level <= g.level), extras);
      const wordIds = new Set<number>();
      for (const e of g.examples ?? []) {
        for (const h of e.highlight ?? []) if (!e.pt.toLowerCase().includes(h.toLowerCase())) problem(where, `highlight "${h}" is not in "${e.pt}"`);
        for (const t of segment(e.pt, lexicon)) if (t.wordId !== undefined) wordIds.add(t.wordId);
        const bad = unknownTokens(e.pt, lexicon, extras);
        if (bad.length) problem(where, `"${e.pt}" uses words not in the list at this level: ${[...new Set(bad)].join(", ")}`);
      }
      out.push({ ...g, wordIds: [...wordIds] });
    }
  }
  return out.sort((a, b) => a.level - b.level);
}

// ---------------------------------------------------------------- stories

interface StorySentenceDraft {
  pt: string;
  en: string;
  /** Contextual English for words whose dictionary meaning would mislead (fui → "I went"). */
  glosses?: Record<string, string>;
}

interface StoryFileDraft {
  id: string;
  level: Level;
  topic: Topic;
  title: string;
  titleEn: string;
  sentences: StorySentenceDraft[];
  questions: StoryQuestion[];
}

function buildStories(words: readonly Word[], extras: ReadonlySet<string>, extraGlosses: ReadonlyMap<string, Gloss>) {
  const out = [];
  const ids = new Set<string>();
  const dictionary = new Map(words.map((w) => [w.id, { en: w.english }]));
  for (const file of draftFiles("stories")) {
    const drafts = readJson<StoryFileDraft[]>(file);
    for (const s of drafts) {
      const where = `${file} ${s.id}`;
      if (ids.has(s.id)) problem(where, "duplicate id");
      ids.add(s.id);
      if (!isLevel(s.level) || !isTopic(s.topic)) {
        problem(where, "bad level or topic");
        continue;
      }
      const lexicon = buildLexicon(words.filter((w) => w.level <= s.level), extras);
      const draft: StoryDraft = { title: s.title, titleEn: s.titleEn, sentences: s.sentences.map(({ pt, en }) => ({ pt, en })), questions: s.questions };
      for (const issue of draftProblems(draft, { level: s.level, lexicon, extras })) problem(where, issue);
      // One gloss per non-punctuation token: the sentence's own gloss, else the dictionary's, else the extra's.
      const glosses = s.sentences.map((sentence) => {
        const own = new Map(Object.entries(sentence.glosses ?? {}).map(([k, v]) => [lookupForm(k), v]));
        return segment(sentence.pt, lexicon)
          .filter((t) => t.kind !== "punct")
          .map((t) => ({
            en:
              own.get(lookupForm(t.text)) ??
              (t.wordId !== undefined ? dictionary.get(t.wordId)?.en : undefined) ??
              extraGlosses.get(t.text)?.en ??
              t.text,
          }));
      });
      out.push(buildStory(s.id, s.level, s.topic, draft, glosses, lexicon, dictionary, extraGlosses));
    }
  }
  return out;
}

// ---------------------------------------------------------------- main

const irregular = loadIrregular();
const { words, verbs } = buildWords(irregular);
const { extras, extraGlosses } = loadExtras();
const grammar = buildGrammar(words, extras);
const stories = buildStories(words, extras, extraGlosses);

const shown = only ? problems.filter((p) => p.includes(only)) : problems;
const count = (level: Level) => words.filter((w) => w.level === level).length;
console.log(
  `words: A1 ${count(1)}, A2 ${count(2)}, B1 ${count(3)}, B2 ${count(4)} (${words.length}) · verbs ${verbs.length} ` +
    `(${verbs.filter((v) => v.irregular).length} irregular) · grammar ${grammar.length} · stories ${stories.length}`,
);
if (shown.length) {
  console.log(`\n${shown.length} problem${shown.length === 1 ? "" : "s"}:\n- ${shown.join("\n- ")}`);
}
if (checkOnly) process.exit(shown.length ? 1 : 0);
if (problems.length) {
  console.error("\nNot writing: fix the problems above first.");
  process.exit(1);
}
const write = (name: string, value: unknown) => writeFileSync(path.join(DATA, name), JSON.stringify(value, null, 1) + "\n");
write("words.json", words);
write("verbs.json", verbs);
write("grammar.json", grammar);
write("stories.json", stories);
console.log("Wrote data/words.json, verbs.json, grammar.json, stories.json");
