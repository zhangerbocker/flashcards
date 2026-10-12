import rawVerbs from "../../data/verbs.json";

/** Tenses drilled at A1–A2, in the order they unlock. */
export const TENSES = ["presente", "preterito", "imperfeito"] as const;
export type Tense = (typeof TENSES)[number];

export const TENSE_NAMES: Record<Tense, string> = {
  presente: "Present",
  preterito: "Past (pretérito perfeito)",
  imperfeito: "Imperfect (pretérito imperfeito)",
};

/**
 * Brazilian Portuguese persons: você/ele/ela share a form, as do vocês/eles/elas,
 * so four forms cover everyday speech (tu and vós are left out).
 */
export const PERSONS = ["eu", "você / ele / ela", "nós", "vocês / eles / elas"] as const;

export function isTense(value: unknown): value is Tense {
  return typeof value === "string" && (TENSES as readonly string[]).includes(value);
}

export interface Verb {
  /** The infinitive's entry in the word list. */
  wordId: number;
  infinitive: string;
  irregular: boolean;
  /** Four forms per tense, in PERSONS order. */
  tenses: Record<Tense, [string, string, string, string]>;
}

function isFourForms(value: unknown): value is [string, string, string, string] {
  return Array.isArray(value) && value.length === 4 && value.every((f) => typeof f === "string" && f.length > 0);
}

function isVerb(value: unknown): value is Verb {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  const tenses = v.tenses as Record<string, unknown> | undefined;
  return (
    typeof v.wordId === "number" &&
    typeof v.infinitive === "string" &&
    typeof v.irregular === "boolean" &&
    typeof tenses === "object" &&
    tenses !== null &&
    TENSES.every((t) => isFourForms(tenses[t]))
  );
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
 * Regular conjugation of an -ar/-er/-ir infinitive, used to check generated
 * tables (a regular verb must match) and to flag irregular ones.
 * Returns null for infinitives that don't end in -ar, -er or -ir (pôr).
 */
export function regularForms(infinitive: string): Record<Tense, [string, string, string, string]> | null {
  const m = /^(.*)(ar|er|ir)$/.exec(infinitive);
  if (!m) return null;
  const [, stem, ending] = m;
  if (ending === "ar") {
    // Spelling changes before -e keep the sound: ficar → fiquei, chegar → cheguei, começar → comecei.
    const preteriteEu = stem.endsWith("c")
      ? `${stem.slice(0, -1)}quei`
      : stem.endsWith("g")
        ? `${stem}uei`
        : stem.endsWith("ç")
          ? `${stem.slice(0, -1)}cei`
          : `${stem}ei`;
    return {
      presente: [`${stem}o`, `${stem}a`, `${stem}amos`, `${stem}am`],
      preterito: [preteriteEu, `${stem}ou`, `${stem}amos`, `${stem}aram`],
      imperfeito: [`${stem}ava`, `${stem}ava`, `${stem}ávamos`, `${stem}avam`],
    };
  }
  const v = ending === "er" ? "e" : "i";
  return {
    presente: [`${stem}o`, `${stem}e`, `${stem}${v}mos`, `${stem}em`],
    preterito: [`${stem}i`, `${stem}${v === "e" ? "eu" : "iu"}`, `${stem}${v}mos`, `${stem}${v}ram`],
    imperfeito: [`${stem}ia`, `${stem}ia`, `${stem}íamos`, `${stem}iam`],
  };
}
