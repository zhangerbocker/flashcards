import { describe, expect, it } from "vitest";
import { parseVerbs, regularForms, TENSES, VERBS } from "./verbs";
import { WORDS_BY_ID } from "./words";

describe("regularForms", () => {
  it("conjugates -ar, -er and -ir verbs", () => {
    expect(regularForms("falar")).toEqual({
      presente: ["falo", "fala", "falamos", "falam"],
      preterito: ["falei", "falou", "falamos", "falaram"],
      imperfeito: ["falava", "falava", "falávamos", "falavam"],
    });
    expect(regularForms("comer")?.preterito).toEqual(["comi", "comeu", "comemos", "comeram"]);
    expect(regularForms("partir")?.presente).toEqual(["parto", "parte", "partimos", "partem"]);
    expect(regularForms("partir")?.imperfeito).toEqual(["partia", "partia", "partíamos", "partiam"]);
  });

  it("keeps the sound in the preterite eu form", () => {
    expect(regularForms("ficar")?.preterito[0]).toBe("fiquei");
    expect(regularForms("chegar")?.preterito[0]).toBe("cheguei");
    expect(regularForms("começar")?.preterito[0]).toBe("comecei");
  });

  it("returns null for infinitives without a regular ending", () => {
    expect(regularForms("pôr")).toBeNull();
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
      return TENSES.filter((t) => JSON.stringify(regular?.[t]) !== JSON.stringify(v.tenses[t])).map((t) => `${v.infinitive} ${t}`);
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
