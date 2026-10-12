import { describe, expect, it } from "vitest";
import {
  ChatRequest,
  chooseTargetWords,
  findScenario,
  loadConversation,
  mistakeFromTurn,
  recentHistory,
  saveConversation,
  promptWords,
  systemPrompt,
  type MessageCheck,
} from "./chat";
import { gradeItem, Rating, type Progress } from "./srs";
import type { Topic } from "./topics";
import type { Level, Word } from "./words";

const NOW = new Date("2026-10-08T12:00:00Z");
const TODAY = "2026-10-08";
const cafe = findScenario("padaria")!;

function word(id: number, level: Level, topic: Topic): Word {
  return { id, pt: `palavra${id}`, pos: "n.", english: `w${id}`, level, topic, gender: "f", forms: [], example: { pt: "", en: "" } };
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
  corrected: "Eu sou de Boston.",
  correctedEn: "I am from Boston.",
  changes,
  gaps: [],
});

describe("chooseTargetWords", () => {
  const words = [word(1, 1, "Time"), word(2, 1, "Food & drink"), word(3, 2, "Food & drink"), word(4, 1, "Actions"), word(5, 1, "Food & drink")];

  it("puts words being learned first, then due ones, then studied and new words from the scenario's topics", () => {
    const progress: Progress = {
      items: {
        "w:4": { ...gradeItem(undefined, Rating.Know, NOW, TODAY), due: "2026-10-08T00:00:00Z" },
        "w:1": gradeItem(undefined, Rating.DontKnow, NOW, TODAY),
        "w:2": { ...gradeItem(undefined, Rating.Know, NOW, TODAY), due: "2026-12-01T00:00:00Z" },
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
    const prompt = systemPrompt(1, cafe, ["o café", "a água"], ["o café"]);
    expect(prompt).toContain("CEFR A1");
    expect(prompt).toContain("Brazilian Portuguese");
    expect(prompt).toContain(cafe.setting);
    expect(prompt).toContain("Target words: o café");
    expect(prompt).toContain("Allowed words: o café, a água");
  });
});

describe("promptWords", () => {
  it("lists nouns with their article so the model sees the gender", () => {
    expect(promptWords([word(1, 1, "Time")])).toEqual(["a palavra1"]);
  });
});

describe("recentHistory", () => {
  it("keeps only the newest messages", () => {
    expect(recentHistory([1, 2, 3, 4, 5], 2)).toEqual([4, 5]);
    expect(recentHistory([1], 2)).toEqual([1]);
  });
});

describe("mistakeFromTurn", () => {
  it("makes a flashcard from a corrected message, with English", () => {
    const mistake = mistakeFromTurn("Eu estou de Boston.", check([{ from: "estou", to: "sou", reason: "Origin takes ser." }]), "m1", TODAY);
    expect(mistake).toEqual({
      id: "m1",
      wrong: "Eu estou de Boston.",
      right: "Eu sou de Boston.",
      en: "I am from Boston.",
      reason: "Origin takes ser.",
      createdAt: TODAY,
    });
  });

  it("leaves out accent-only fixes when accents are optional", () => {
    const accent = { from: "cafe", to: "café", reason: "Accent on the final e." };
    const gender = { from: "uma pão", to: "um pão", reason: "Pão is masculine." };
    expect(mistakeFromTurn("Um cafe.", check([accent]), "m1", TODAY, true)).toBeNull();
    expect(mistakeFromTurn("Um cafe.", check([accent]), "m1", TODAY, false)).not.toBeNull();
    expect(mistakeFromTurn("Um cafe e uma pão.", check([accent, gender]), "m1", TODAY, true)?.reason).toBe("Pão is masculine.");
  });

  it("makes nothing when the message needed no changes", () => {
    expect(mistakeFromTurn("Eu sou de Boston.", check([]), "m1", TODAY)).toBeNull();
  });
});

describe("ChatRequest", () => {
  const valid = { level: 1, scenario: "padaria", targetWordIds: [1], history: [], message: "Oi, tudo bem?" };

  it("accepts a valid request", () => {
    expect(ChatRequest.safeParse(valid).success).toBe(true);
  });

  it("rejects an unknown scenario, a bad level and an over-long message", () => {
    expect(ChatRequest.safeParse({ ...valid, scenario: "moon" }).success).toBe(false);
    expect(ChatRequest.safeParse({ ...valid, level: 5 }).success).toBe(false);
    expect(ChatRequest.safeParse({ ...valid, message: "a".repeat(301) }).success).toBe(false);
  });

  it("rejects a blank message", () => {
    expect(ChatRequest.safeParse({ ...valid, message: "   " }).success).toBe(false);
  });
});

describe("conversation storage", () => {
  it("round-trips a conversation", () => {
    const storage = new MemoryStorage();
    const conversation = { level: 1 as const, scenario: "padaria", messages: [{ role: "partner" as const, text: "Oi!", en: "Hi!" }] };
    saveConversation(storage, conversation);
    expect(loadConversation(storage)).toEqual(conversation);
  });

  it("returns null when cleared, missing or unreadable", () => {
    const storage = new MemoryStorage();
    expect(loadConversation(storage)).toBeNull();
    saveConversation(storage, null);
    expect(loadConversation(storage)).toBeNull();
    storage.setItem("pt.chat.v1", "{oops");
    expect(loadConversation(storage)).toBeNull();
  });
});
