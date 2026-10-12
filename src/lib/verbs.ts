import rawVerbs from "../../data/verbs.json";
import type { Level } from "./levels";

/** Tenses drilled, in the order they are learned. */
export const TENSES = [
  "presente",
  "preterito",
  "imperfeito",
  "futuro",
  "condicional",
  "subjpresente",
  "subjimperfeito",
  "subjfuturo",
] as const;
export type Tense = (typeof TENSES)[number];

export const TENSE_NAMES: Record<Tense, string> = {
  presente: "Present",
  preterito: "Past (pretérito perfeito)",
  imperfeito: "Imperfect (pretérito imperfeito)",
  futuro: "Future (futuro do presente)",
  condicional: "Conditional (futuro do pretérito)",
  subjpresente: "Present subjunctive",
  subjimperfeito: "Imperfect subjunctive",
  subjfuturo: "Future subjunctive",
};

/** The level at which each tense is introduced. */
export const TENSE_LEVEL: Record<Tense, Level> = {
  presente: 1,
  preterito: 1,
  imperfeito: 2,
  futuro: 3,
  condicional: 3,
  subjpresente: 3,
  subjimperfeito: 4,
  subjfuturo: 4,
};

/** The word that usually introduces a subjunctive, shown before the person (que eu fale, se eu falasse). */
export const TENSE_CUE: Partial<Record<Tense, string>> = { subjpresente: "que", subjimperfeito: "se", subjfuturo: "quando" };

/**
 * Brazilian Portuguese persons: você/ele/ela share a form, as do vocês/eles/elas,
 * so four forms cover everyday speech (tu and vós are left out).
 */
export const PERSONS = ["eu", "você / ele / ela", "nós", "vocês / eles / elas"] as const;

export function isTense(value: unknown): value is Tense {
  return typeof value === "string" && (TENSES as readonly string[]).includes(value);
}

export type FourForms = [string, string, string, string];

export interface Conjugation {
  /** Four forms per tense, in PERSONS order. */
  tenses: Record<Tense, FourForms>;
  gerund: string;
  participle: string;
}

export interface Verb extends Conjugation {
  /** The infinitive's entry in the word list. */
  wordId: number;
  infinitive: string;
  irregular: boolean;
}

function isFourForms(value: unknown): value is FourForms {
  return Array.isArray(value) && value.length === 4 && value.every((f) => typeof f === "string" && f.length > 0);
}

/** Whether a value is a complete conjugation table (every tense, gerund and participle). */
export function isConjugation(value: unknown): value is Conjugation {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  const tenses = v.tenses as Record<string, unknown> | undefined;
  return (
    typeof tenses === "object" &&
    tenses !== null &&
    TENSES.every((t) => isFourForms(tenses[t])) &&
    typeof v.gerund === "string" &&
    typeof v.participle === "string"
  );
}

function isVerb(value: unknown): value is Verb {
  if (!isConjugation(value)) return false;
  const v = value as unknown as Record<string, unknown>;
  return typeof v.wordId === "number" && typeof v.infinitive === "string" && typeof v.irregular === "boolean";
}

/** Validates verb tables at the content boundary; throws naming the first bad entry. */
export function parseVerbs(raw: unknown): Verb[] {
  if (!Array.isArray(raw)) throw new Error(`verb list must be an array, got ${typeof raw}`);
  raw.forEach((entry, i) => {
    if (!isVerb(entry)) throw new Error(`malformed verb at index ${i}: ${JSON.stringify(entry).slice(0, 200)}`);
  });
  return raw as Verb[];
}

export const VERBS: Verb[] = parseVerbs(rawVerbs);

/**
 * Every written form of a verb (each tense, the personal infinitive, gerund, participle and its
 * gender/number forms), without the infinitive.
 */
export function verbForms(verb: Conjugation & { infinitive: string }): string[] {
  const p = verb.participle;
  const participles = /o$/.test(p) ? [p, `${p.slice(0, -1)}a`, `${p}s`, `${p.slice(0, -1)}as`] : [p];
  // Personal infinitive: para nós irmos, antes de eles fazerem (pôr → pormos, porem).
  const personal = [`${verb.infinitive}mos`, `${verb.infinitive}em`].map((f) => f.replace(/^(.*)ô(r)/, "$1o$2"));
  const all = [...TENSES.flatMap((t) => verb.tenses[t]), ...personal, verb.gerund, ...participles];
  return [...new Set(all)].filter((f) => f !== verb.infinitive);
}

const ACCENTED: Record<string, string> = { a: "á", e: "ê", i: "í" };

/**
 * Regular conjugation of an -ar/-er/-ir infinitive, with the spelling changes that keep
 * the sound (ficar → fiquei/fique, chegar → cheguei, começar → comecei, conhecer → conheço/conheça,
 * proteger → protejo). Used to fill in regular verbs and to check tables marked regular.
 * Returns null for infinitives that don't end in -ar, -er or -ir (pôr).
 */
export function regularForms(infinitive: string): Conjugation | null {
  const m = /^(.*)(ar|er|ir)$/.exec(infinitive);
  if (!m) return null;
  const [, stem, ending] = m;
  const v = ending[0];
  // Stem before e (for -ar) or before o/a (for -er/-ir), respelled to keep the consonant's sound.
  const beforeE = stem.replace(/c$/, "qu").replace(/g$/, "gu").replace(/ç$/, "c");
  const beforeOA = stem.replace(/c$/, "ç").replace(/g$/, "j");

  const presente: FourForms =
    ending === "ar"
      ? [`${stem}o`, `${stem}a`, `${stem}amos`, `${stem}am`]
      : [`${beforeOA}o`, `${stem}e`, `${stem}${v}mos`, `${stem}em`];
  const preterito: FourForms =
    ending === "ar"
      ? [`${beforeE}ei`, `${stem}ou`, `${stem}amos`, `${stem}aram`]
      : [`${stem}i`, `${stem}${v === "e" ? "eu" : "iu"}`, `${stem}${v}mos`, `${stem}${v}ram`];
  const imperfeito: FourForms =
    ending === "ar"
      ? [`${stem}ava`, `${stem}ava`, `${stem}ávamos`, `${stem}avam`]
      : [`${stem}ia`, `${stem}ia`, `${stem}íamos`, `${stem}iam`];
  const subjStem = ending === "ar" ? beforeE : beforeOA;
  const sv = ending === "ar" ? "e" : "a";
  const pastBase = `${stem}${v}`; // falaram → fala-, comeram → come-, partiram → parti-
  return {
    tenses: {
      presente,
      preterito,
      imperfeito,
      futuro: [`${infinitive}ei`, `${infinitive}á`, `${infinitive}emos`, `${infinitive}ão`],
      condicional: [`${infinitive}ia`, `${infinitive}ia`, `${infinitive}íamos`, `${infinitive}iam`],
      subjpresente: [`${subjStem}${sv}`, `${subjStem}${sv}`, `${subjStem}${sv}mos`, `${subjStem}${sv}m`],
      subjimperfeito: [`${pastBase}sse`, `${pastBase}sse`, `${stem}${ACCENTED[v]}ssemos`, `${pastBase}ssem`],
      subjfuturo: [`${pastBase}r`, `${pastBase}r`, `${pastBase}rmos`, `${pastBase}rem`],
    },
    gerund: `${stem}${v}ndo`,
    participle: `${stem}${ending === "ar" ? "a" : "i"}do`,
  };
}
