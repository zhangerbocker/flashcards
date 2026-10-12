import { describe, expect, it } from "vitest";
import { checkAnswer, diffSentences, plainPinyin } from "./answer";

describe("plainPinyin", () => {
  it("strips tone marks, spaces and case", () => {
    expect(plainPinyin("Bù hǎoyìsi")).toBe("buhaoyisi");
  });

  it("maps ü to v", () => {
    expect(plainPinyin("lǜsè")).toBe("lvse");
  });
});

describe("checkAnswer", () => {
  it("accepts the exact Chinese, ignoring punctuation and spaces", () => {
    expect(checkAnswer("我 很好", "我很好。").correct).toBe(true);
  });

  it("accepts toneless pinyin when pinyin is provided", () => {
    expect(checkAnswer("pengyou", "朋友", "péngyou").correct).toBe(true);
  });

  it("does not accept pinyin for sentence cards", () => {
    expect(checkAnswer("wo hen hao", "我很好。").correct).toBe(false);
  });

  it("rejects an empty answer", () => {
    expect(checkAnswer("", "朋友", "péngyou").correct).toBe(false);
  });

  it("marks missing and extra characters", () => {
    expect(checkAnswer("狗比猫很大", "狗比猫大。").diff).toEqual([
      { text: "狗", status: "same" },
      { text: "比", status: "same" },
      { text: "猫", status: "same" },
      { text: "很", status: "extra" },
      { text: "大", status: "same" },
    ]);
  });

  it("marks characters the answer left out", () => {
    expect(checkAnswer("我好", "我很好").diff.map((d) => d.status)).toEqual(["same", "missing", "same"]);
  });
});

describe("diffSentences", () => {
  const render = (wrong: string, right: string) =>
    diffSentences(wrong, right)
      .map((d) => (d.status === "same" ? d.text : d.status === "missing" ? `+${d.text}` : `-${d.text}`))
      .join("");

  it("keeps punctuation so the corrected sentence reads normally", () => {
    expect(render("狗比猫很大。我喜欢狗。", "狗比猫大。我喜欢狗。")).toBe("狗比猫-很大。我喜欢狗。");
  });

  it("treats full-width and ASCII punctuation as the same, showing the corrected form", () => {
    expect(render("你好,我是安娜.", "你好，我是安娜。")).toBe("你好，我是安娜。");
  });

  it("drops spaces and marks typed English as removed", () => {
    expect(render("我的 mother 很好", "我妈妈很好")).toBe("我+妈+妈-的-m-o-t-h-e-r很好");
  });
});
