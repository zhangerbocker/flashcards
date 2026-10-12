import { describe, expect, it } from "vitest";
import {
  ChatRequest,
  chooseTargetWords,
  findScenario,
  loadConversation,
  mistakeFromTurn,
  recentHistory,
  saveConversation,
  systemPrompt,
  type MessageCheck,
} from "./chat";
import { gradeItem, Rating, type Progress } from "./srs";
import type { Topic } from "./topics";
import type { Level, Word } from "./words";

const NOW = new Date("2026-10-08T12:00:00Z");
const TODAY = "2026-10-08";
const cafe = findScenario("cafe")!;

function word(id: number, level: Level, topic: Topic): Word {
  return { id, hanzi: `字${id}`, pinyin: "zì", pos: "n.", english: `w${id}`, level, topic, example: { zh: "", pinyin: "", en: "" } };
}

class MemoryStorage {
  private items = new Map<string, string>();
  getItem(key: string): string | null {
    return this.items.get(key) ?? null;
  }
  setItem(key: string, value: string): void {
    this.items.set(key, value);
  }
}

const check = (changes: MessageCheck["changes"]): MessageCheck => ({
  corrected: "狗比猫大。",
  correctedPinyin: "Gǒu bǐ māo dà.",
  correctedEn: "Dogs are bigger than cats.",
  changes,
  gaps: [],
});

describe("chooseTargetWords", () => {
  const words = [word(1, 1, "Time"), word(2, 1, "Food & drink"), word(3, 2, "Food & drink"), word(4, 1, "Actions"), word(5, 1, "Food & drink")];

  it("puts words being learned first, then due ones, then studied and new words from the scenario's topics", () => {
    const progress: Progress = {
      items: {
        "w:4": { ...gradeItem(undefined, Rating.Good, NOW, TODAY), due: "2026-10-08T00:00:00Z" },
        "w:1": gradeItem(undefined, Rating.Again, NOW, TODAY),
        "w:2": { ...gradeItem(undefined, Rating.Easy, NOW, TODAY), due: "2026-12-01T00:00:00Z" },
      },
    };
    expect(chooseTargetWords(progress, words, 1, cafe, NOW).map((w) => w.id)).toEqual([1, 4, 2, 5]);
  });

  it("leaves out words above the level", () => {
    expect(chooseTargetWords({ items: {} }, words, 1, cafe, NOW).map((w) => w.id)).toEqual([2, 5]);
  });

  it("returns at most 15 words", () => {
    const many = Array.from({ length: 30 }, (_, i) => word(i + 1, 1, "Food & drink"));
    expect(chooseTargetWords({ items: {} }, many, 1, cafe, NOW)).toHaveLength(15);
  });
});

describe("systemPrompt", () => {
  it("includes the level, scenario, target words and allowed words", () => {
    const prompt = systemPrompt(1, cafe, ["咖啡", "茶"], ["咖啡"]);
    expect(prompt).toContain("HSK 1");
    expect(prompt).toContain(cafe.setting);
    expect(prompt).toContain("Target words: 咖啡");
    expect(prompt).toContain("Allowed words: 咖啡 茶");
  });
});

describe("recentHistory", () => {
  it("keeps only the newest messages", () => {
    expect(recentHistory([1, 2, 3, 4, 5], 2)).toEqual([4, 5]);
    expect(recentHistory([1], 2)).toEqual([1]);
  });
});

describe("mistakeFromTurn", () => {
  it("makes a flashcard from a corrected message, with pinyin and English", () => {
    const mistake = mistakeFromTurn("狗比猫很大。", check([{ from: "很大", to: "大", reason: "No 很 in 比 sentences." }]), "m1", TODAY);
    expect(mistake).toEqual({
      id: "m1",
      wrong: "狗比猫很大。",
      right: "狗比猫大。",
      pinyin: "Gǒu bǐ māo dà.",
      en: "Dogs are bigger than cats.",
      reason: "No 很 in 比 sentences.",
      createdAt: TODAY,
    });
  });

  it("makes nothing when the message needed no changes", () => {
    expect(mistakeFromTurn("狗比猫大。", check([]), "m1", TODAY)).toBeNull();
  });
});

describe("ChatRequest", () => {
  const valid = { level: 1, scenario: "cafe", targetWordIds: [1], history: [], message: "你好" };

  it("accepts a valid request", () => {
    expect(ChatRequest.safeParse(valid).success).toBe(true);
  });

  it("rejects an unknown scenario, a bad level and an over-long message", () => {
    expect(ChatRequest.safeParse({ ...valid, scenario: "moon" }).success).toBe(false);
    expect(ChatRequest.safeParse({ ...valid, level: 4 }).success).toBe(false);
    expect(ChatRequest.safeParse({ ...valid, message: "好".repeat(301) }).success).toBe(false);
  });

  it("rejects a blank message", () => {
    expect(ChatRequest.safeParse({ ...valid, message: "   " }).success).toBe(false);
  });
});

describe("conversation storage", () => {
  it("round-trips a conversation", () => {
    const storage = new MemoryStorage();
    const conversation = { level: 1 as const, scenario: "cafe", messages: [{ role: "partner" as const, text: "你好！", pinyin: "Nǐ hǎo!", en: "Hi!" }] };
    saveConversation(storage, conversation);
    expect(loadConversation(storage)).toEqual(conversation);
  });

  it("returns null when cleared, missing or unreadable", () => {
    const storage = new MemoryStorage();
    expect(loadConversation(storage)).toBeNull();
    saveConversation(storage, null);
    expect(loadConversation(storage)).toBeNull();
    storage.setItem("hsk.chat.v1", "{oops");
    expect(loadConversation(storage)).toBeNull();
  });
});
