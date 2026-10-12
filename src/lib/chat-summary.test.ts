import { describe, expect, it } from "vitest";
import type { ChatMessage, MessageCheck } from "./chat";
import { summarizeChat } from "./chat-summary";
import { newItem, type Progress } from "./srs";
import type { Word } from "./words";

const word = (id: number, hanzi: string): Word => ({
  id,
  hanzi,
  pinyin: "",
  pos: "",
  english: hanzi,
  level: 1,
  topic: "Actions",
  example: { zh: "", pinyin: "", en: "" },
});
const WORDS = [word(1, "我"), word(2, "喜欢"), word(3, "狗"), word(4, "猫"), word(5, "大"), word(6, "很"), word(7, "比"), word(8, "可爱")];
const NOBODY: Progress = { items: {} };

const check = (corrected: string, changes: MessageCheck["changes"] = [], gaps: MessageCheck["gaps"] = []): MessageCheck => ({
  corrected,
  correctedPinyin: "",
  correctedEn: "",
  changes,
  gaps,
});
const partner = (text: string): ChatMessage => ({ role: "partner", text, pinyin: "", en: "" });
const user = (text: string, c: MessageCheck): ChatMessage => ({ role: "user", text, check: c });

describe("summarizeChat", () => {
  const messages: ChatMessage[] = [
    partner("你喜欢狗吗？"),
    user("我喜欢狗。", check("我喜欢狗。")),
    partner("狗比猫可爱吗？"),
    user("狗比猫很大。", check("狗比猫大。", [{ from: "很大", to: "大", reason: "No 很 with 比." }])),
  ];

  it("counts messages and the ones that needed no fix", () => {
    const s = summarizeChat(messages, WORDS, NOBODY);
    expect([s.sent, s.clean]).toEqual([2, 1]);
  });

  it("lists words used outside corrected parts, once each, in order of first use", () => {
    expect(summarizeChat(messages, WORDS, NOBODY).wordsUsedWell.map((w) => w.hanzi)).toEqual(["我", "喜欢", "狗", "比", "猫"]);
  });

  it("lists each corrected message with its fixes", () => {
    expect(summarizeChat(messages, WORDS, NOBODY).corrections).toEqual([
      { wrong: "狗比猫很大。", right: "狗比猫大。", changes: [{ from: "很大", to: "大", reason: "No 很 with 比." }] },
    ]);
  });

  it("lists the partner's words the learner hasn't started studying", () => {
    const studyingDog: Progress = { items: { "w:3": newItem(new Date(), "2026-10-08") } };
    expect(summarizeChat([partner("狗很可爱。")], WORDS, studyingDog).partnerNewWords.map((w) => w.hanzi)).toEqual(["很", "可爱"]);
  });

  it("leaves out partner words the learner used themselves", () => {
    const s = summarizeChat([partner("我喜欢猫。"), user("我喜欢狗。", check("我喜欢狗。"))], WORDS, NOBODY);
    expect(s.partnerNewWords.map((w) => w.hanzi)).toEqual(["猫"]);
  });

  it("collects vocabulary gaps once per word", () => {
    const gap = { typed: "coffee", hanzi: "咖啡", pinyin: "kāfēi", en: "coffee" };
    const s = summarizeChat(
      [user("我要 coffee。", check("我要咖啡。", [], [gap])), user("coffee 很好。", check("咖啡很好。", [], [{ ...gap, typed: "coffee" }]))],
      WORDS,
      NOBODY,
    );
    expect(s.gaps).toEqual([gap]);
  });

  it("is empty for a conversation with no messages from the learner", () => {
    const s = summarizeChat([partner("你好！")], WORDS, NOBODY);
    expect([s.sent, s.clean, s.wordsUsedWell, s.corrections, s.gaps]).toEqual([0, 0, [], [], []]);
  });
});
