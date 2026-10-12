import { describe, expect, it } from "vitest";
import { checkAnswer, diffSentences, stripAccents } from "./answer";

describe("stripAccents", () => {
  it("removes accents and cedillas", () => {
    expect(stripAccents("Não, você começa às três")).toBe("Nao, voce comeca as tres");
  });
});

describe("checkAnswer", () => {
  it("accepts the exact Portuguese, ignoring case, punctuation and extra spaces", () => {
    expect(checkAnswer("eu  estou bem", "Eu estou bem.").correct).toBe(true);
  });

  it("accepts alternatives such as the noun without its article", () => {
    expect(checkAnswer("casa", "a casa", ["casa"]).correct).toBe(true);
    expect(checkAnswer("o casa", "a casa", ["casa"]).correct).toBe(false);
  });

  it("flags an answer that is right apart from accents, without counting it correct", () => {
    const result = checkAnswer("nao sei", "Não sei.");
    expect(result).toMatchObject({ correct: false, accentsOnly: true });
  });

  it("treats precomposed and decomposed accents as the same", () => {
    expect(checkAnswer("café", "café").correct).toBe(true);
  });

  it("rejects an empty answer", () => {
    expect(checkAnswer("", "a casa", ["casa"])).toMatchObject({ correct: false, accentsOnly: false });
  });

  it("marks missing and extra letters against the expected answer", () => {
    expect(checkAnswer("falo", "falou").diff.map((d) => [d.text, d.status])).toEqual([
      ["f", "same"],
      ["a", "same"],
      ["l", "same"],
      ["o", "same"],
      ["u", "missing"],
    ]);
  });
});

describe("diffSentences", () => {
  const render = (wrong: string, right: string) =>
    diffSentences(wrong, right)
      .map((d) => (d.status === "same" ? d.text : d.status === "missing" ? `+${d.text}` : `-${d.text}`))
      .join("");

  it("diffs word by word, keeping the spaces so the sentence reads normally", () => {
    expect(render("Eu estou de Boston.", "Eu sou de Boston.")).toBe("Eu -estou +sou de Boston.");
  });

  it("shows the corrected form of words that differ only in case or punctuation", () => {
    expect(render("eu sou de boston", "Eu sou de Boston.")).toBe("Eu sou de Boston.");
  });

  it("merges neighboring words with the same status", () => {
    expect(diffSentences("um orange juice", "um suco de laranja")).toEqual([
      { text: "um ", status: "same" },
      { text: "orange juice ", status: "extra" },
      { text: "suco de laranja", status: "missing" },
    ]);
  });

  it("marks typed English as removed and the Portuguese as added", () => {
    expect(render("Minha mother é legal", "Minha mãe é legal")).toBe("Minha -mother +mãe é legal");
  });
});
