import { describe, expect, it } from "vitest";
import { parseVerbs, regularForms, TENSES, verbForms, VERBS } from "./verbs";
import { WORDS_BY_ID } from "./words";

describe("regularForms", () => {
  it("conjugates an -ar verb in every tense", () => {
    expect(regularForms("falar")).toEqual({
      tenses: {
        presente: ["falo", "fala", "falamos", "falam"],
        preterito: ["falei", "falou", "falamos", "falaram"],
        imperfeito: ["falava", "falava", "falávamos", "falavam"],
        futuro: ["falarei", "falará", "falaremos", "falarão"],
        condicional: ["falaria", "falaria", "falaríamos", "falariam"],
        subjpresente: ["fale", "fale", "falemos", "falem"],
        subjimperfeito: ["falasse", "falasse", "falássemos", "falassem"],
        subjfuturo: ["falar", "falar", "falarmos", "falarem"],
      },
      gerund: "falando",
      participle: "falado",
    });
  });

  it("conjugates -er and -ir verbs", () => {
    const comer = regularForms("comer")!;
    expect(comer.tenses.preterito).toEqual(["comi", "comeu", "comemos", "comeram"]);
    expect(comer.tenses.subjpresente).toEqual(["coma", "coma", "comamos", "comam"]);
    expect(comer.tenses.subjimperfeito).toEqual(["comesse", "comesse", "comêssemos", "comessem"]);
    expect([comer.gerund, comer.participle]).toEqual(["comendo", "comido"]);
    const partir = regularForms("partir")!;
    expect(partir.tenses.presente).toEqual(["parto", "parte", "partimos", "partem"]);
    expect(partir.tenses.preterito).toEqual(["parti", "partiu", "partimos", "partiram"]);
    expect(partir.tenses.subjimperfeito).toEqual(["partisse", "partisse", "partíssemos", "partissem"]);
    expect(partir.tenses.subjfuturo).toEqual(["partir", "partir", "partirmos", "partirem"]);
  });

  it("respells the stem to keep its sound", () => {
    expect(regularForms("ficar")?.tenses.preterito[0]).toBe("fiquei");
    expect(regularForms("ficar")?.tenses.subjpresente[0]).toBe("fique");
    expect(regularForms("chegar")?.tenses.subjpresente[3]).toBe("cheguem");
    expect(regularForms("começar")?.tenses.preterito[0]).toBe("comecei");
    expect(regularForms("conhecer")?.tenses.presente[0]).toBe("conheço");
    expect(regularForms("conhecer")?.tenses.subjpresente[0]).toBe("conheça");
    expect(regularForms("dirigir")?.tenses.presente[0]).toBe("dirijo");
  });

  it("returns null for infinitives without a regular ending", () => {
    expect(regularForms("pôr")).toBeNull();
  });
});

describe("verbForms", () => {
  it("lists every form once, with the participle's gender and number forms, but not the infinitive", () => {
    const forms = verbForms({ infinitive: "falar", ...regularForms("falar")! });
    expect(forms).toContain("falássemos");
    expect(forms).toEqual(expect.arrayContaining(["falando", "falado", "falada", "falados", "faladas"]));
    expect(forms).toEqual(expect.arrayContaining(["falarmos", "falarem"])); // personal infinitive
    // pôr's personal infinitive drops the accent: pormos, porem.
    expect(verbForms({ infinitive: "pôr", ...regularForms("falar")! })).toEqual(expect.arrayContaining(["pormos", "porem"]));
    expect(forms).not.toContain("falar");
    expect(new Set(forms).size).toBe(forms.length);
  });
});

describe("verb tables", () => {
  it("belong to verbs in the word list, once each", () => {
    expect(VERBS.filter((v) => WORDS_BY_ID.get(v.wordId)?.pt !== v.infinitive).map((v) => v.infinitive)).toEqual([]);
    expect(new Set(VERBS.map((v) => v.wordId)).size).toBe(VERBS.length);
  });

  it("match the regular pattern unless marked irregular", () => {
    const bad = VERBS.filter((v) => !v.irregular).flatMap((v) => {
      const regular = regularForms(v.infinitive);
      return TENSES.filter((t) => JSON.stringify(regular?.tenses[t]) !== JSON.stringify(v.tenses[t])).map((t) => `${v.infinitive} ${t}`);
    });
    expect(bad).toEqual([]);
  });

  it("list every conjugated form among the word's forms, so the reader finds them", () => {
    const bad = VERBS.flatMap((v) => {
      const forms = new Set(WORDS_BY_ID.get(v.wordId)?.forms);
      return TENSES.flatMap((t) => v.tenses[t].filter((f) => !forms.has(f) && f !== v.infinitive).map((f) => `${v.infinitive}: ${f}`));
    });
    expect(bad).toEqual([]);
  });
});

describe("parseVerbs", () => {
  it("names the malformed entry", () => {
    expect(() => parseVerbs([{ wordId: 1, infinitive: "falar", irregular: false, tenses: { presente: ["falo"] } }])).toThrow(
      /malformed verb at index 0/,
    );
  });
});
