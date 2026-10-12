import { describe, expect, it } from "vitest";
import type { TutorTurn } from "../chat";
import { chatHandler } from "./chat-handler";
import { TutorError, type TutorClient, type TutorContext } from "./tutor";

const TURN: TutorTurn = {
  check: { corrected: "我很好。", correctedPinyin: "Wǒ hěn hǎo.", correctedEn: "I'm fine.", changes: [], gaps: [] },
  partner: { reply: "太好了！", replyPinyin: "Tài hǎo le!", replyEn: "Great!" },
};

/** Records the context it was called with and answers with fixed data. */
function fakeTutor(fail?: Error) {
  const calls: { context: TutorContext; message?: string }[] = [];
  const tutor: TutorClient = {
    async open(context) {
      calls.push({ context });
      if (fail) throw fail;
      return TURN.partner;
    },
    async respond(context, message) {
      calls.push({ context, message });
      if (fail) throw fail;
      return TURN;
    },
  };
  return { tutor, calls };
}

const post = (body: unknown) =>
  new Request("http://localhost/api/chat", { method: "POST", body: typeof body === "string" ? body : JSON.stringify(body) });

const BASE = { level: 1, scenario: "cafe", targetWordIds: [1], history: [] };

describe("chatHandler", () => {
  it("returns the opening line when there is no message", async () => {
    const { tutor } = fakeTutor();
    const res = await chatHandler(tutor)(post(BASE));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ partner: TURN.partner });
  });

  it("returns the check and reply for a message", async () => {
    const { tutor, calls } = fakeTutor();
    const res = await chatHandler(tutor)(post({ ...BASE, message: "我很好" }));
    expect(await res.json()).toEqual(TURN);
    expect(calls[0].message).toBe("我很好");
  });

  it("gives the tutor the level's words, the target words as hanzi and only recent history", async () => {
    const { tutor, calls } = fakeTutor();
    const history = Array.from({ length: 14 }, (_, i) => ({ role: i % 2 ? "user" : "partner", text: `m${i}` }));
    await chatHandler(tutor)(post({ ...BASE, history, message: "好" }));
    const { context } = calls[0];
    expect(context.allowedWords).toHaveLength(300);
    expect(context.targetWords).toEqual(["爱"]);
    expect(context.history.map((m) => m.text)).toEqual(["m4", "m5", "m6", "m7", "m8", "m9", "m10", "m11", "m12", "m13"]);
  });

  it("rejects an invalid body with 400 naming the field", async () => {
    const res = await chatHandler(fakeTutor().tutor)(post({ ...BASE, level: 5 }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/^level/);
  });

  it("rejects a body that isn't JSON", async () => {
    const res = await chatHandler(fakeTutor().tutor)(post("{nope"));
    expect(res.status).toBe(400);
  });

  it("answers 502 with the cause when the tutor fails", async () => {
    const res = await chatHandler(fakeTutor(new TutorError("timed out")).tutor)(post({ ...BASE, message: "好" }));
    expect(res.status).toBe(502);
    expect((await res.json()).error).toBe("Couldn't reach the tutor: timed out");
  });

  it("lets unexpected errors through instead of hiding them", async () => {
    await expect(chatHandler(fakeTutor(new TypeError("bug")).tutor)(post({ ...BASE, message: "好" }))).rejects.toThrow("bug");
  });
});
