import { describe, expect, it } from "vitest";
import type { ChatMessage, MessageCheck } from "./chat";
import { summarizeChat } from "./chat-summary";
import { newItem, type Progress } from "./srs";
import type { Word } from "./words";

const word = (id: number, pt: string, forms: string[] = []): Word => ({
  id,
  pt,
  pos: "",
  english: pt,
  level: 1,
  topic: "Actions",
  forms,
  example: { pt: "", en: "" },
});
const WORDS = [
  word(1, "eu"),
  word(2, "gostar", ["gosto", "gosta"]),
  word(3, "de", ["do", "da"]),
  word(4, "cachorro", ["cachorros"]),
  word(5, "gato", ["gatos"]),
  word(6, "ser", ["sou", "é"]),
  word(7, "estar", ["estou", "está"]),
  word(8, "bonito", ["bonita"]),
  word(9, "e"),
];
const NOBODY: Progress = { items: {} };

const check = (corrected: string, changes: MessageCheck["changes"] = [], gaps: MessageCheck["gaps"] = []): MessageCheck => ({
  corrected,
  correctedEn: "",
  changes,
  gaps,
});
const partner = (text: string): ChatMessage => ({ role: "partner", text, en: "" });
const user = (text: string, c: MessageCheck): ChatMessage => ({ role: "user", text, check: c });

describe("summarizeChat", () => {
  const messages: ChatMessage[] = [
    partner("Você gosta de cachorros?"),
    user("Eu gosto de cachorros.", check("Eu gosto de cachorros.")),
    partner("O gato é bonito?"),
    user("Eu estou de gato e cachorro.", check("Eu sou de gato e cachorro.", [{ from: "estou", to: "sou", reason: "Use ser." }])),
  ];

  it("counts messages and the ones that needed no fix", () => {
    const s = summarizeChat(messages, WORDS, NOBODY);
    expect([s.sent, s.clean]).toEqual([2, 1]);
  });

  it("lists words used outside corrected parts, once each, in order of first use", () => {
    // "e" is not inside the fix even though "estou" starts with it.
    expect(summarizeChat(messages, WORDS, NOBODY).wordsUsedWell.map((w) => w.pt)).toEqual(["eu", "gostar", "de", "cachorro", "gato", "e"]);
  });

  it("lists each corrected message with its fixes", () => {
    expect(summarizeChat(messages, WORDS, NOBODY).corrections).toEqual([
      { wrong: "Eu estou de gato e cachorro.", right: "Eu sou de gato e cachorro.", changes: [{ from: "estou", to: "sou", reason: "Use ser." }] },
    ]);
  });

  it("lists the partner's words the learner hasn't started studying", () => {
    const studyingCat: Progress = { items: { "w:5": newItem(new Date(), "2026-10-08") } };
    expect(summarizeChat([partner("O gato é bonito.")], WORDS, studyingCat).partnerNewWords.map((w) => w.pt)).toEqual(["ser", "bonito"]);
  });

  it("leaves out partner words the learner used themselves", () => {
    const s = summarizeChat([partner("Eu gosto de gatos."), user("Eu gosto de cachorros.", check("Eu gosto de cachorros."))], WORDS, NOBODY);
    expect(s.partnerNewWords.map((w) => w.pt)).toEqual(["gato"]);
  });

  it("collects vocabulary gaps once per word", () => {
    const gap = { typed: "coffee", pt: "o café", en: "coffee" };
    const s = summarizeChat(
      [user("Eu gosto de coffee.", check("Eu gosto de café.", [], [gap])), user("coffee é bom.", check("Café é bom.", [], [{ ...gap }]))],
      WORDS,
      NOBODY,
    );
    expect(s.gaps).toEqual([gap]);
  });

  it("is empty for a conversation with no messages from the learner", () => {
    const s = summarizeChat([partner("Oi!")], WORDS, NOBODY);
    expect([s.sent, s.clean, s.wordsUsedWell, s.corrections, s.gaps]).toEqual([0, 0, [], [], []]);
  });
});
