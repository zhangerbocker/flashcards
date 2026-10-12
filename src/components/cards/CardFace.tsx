import type { ReactNode } from "react";
import type { CardContent } from "@/lib/card-content";
import { Correction } from "../Correction";
import { Highlighted } from "./Highlighted";
import { SpeakButton } from "./SpeakButton";

function Muted({ children }: { children: ReactNode }) {
  return <p className="text-sm text-stone-500">{children}</p>;
}

function Panel({ children }: { children: ReactNode }) {
  return <div className="mt-5 w-full rounded-2xl bg-stone-50 p-4 text-left dark:bg-stone-800/60">{children}</div>;
}

function Prompt({ children }: { children: ReactNode }) {
  return <p className="mb-3 text-xs font-medium uppercase tracking-wide text-stone-400">{children}</p>;
}

function Front({ card }: { card: CardContent }) {
  switch (card.kind) {
    case "word":
      return card.face === "r" ? (
        <p className="font-han text-7xl leading-tight sm:text-8xl">{card.word.hanzi}</p>
      ) : (
        <>
          <Prompt>Say or write it in Chinese</Prompt>
          <p className="text-3xl font-medium">{card.word.english}</p>
          <Muted>{card.word.pos}</Muted>
        </>
      );
    case "sentence":
      return card.face === "r" ? (
        <Highlighted text={card.word.example.zh} parts={[card.word.hanzi]} className="text-3xl leading-relaxed" />
      ) : (
        <>
          <Prompt>Say or write it in Chinese</Prompt>
          <p className="text-2xl font-medium">{card.word.example.en}</p>
          <Muted>
            Use: {card.word.english}
          </Muted>
        </>
      );
    case "grammar":
      return card.face === "u" ? (
        <>
          <Prompt>{card.grammar.title}</Prompt>
          <p className="font-han rounded-lg bg-stone-100 px-3 py-1 text-lg dark:bg-stone-800">{card.grammar.pattern}</p>
          <p className="mt-6 text-2xl font-medium">{card.example.en}</p>
          <Muted>Say it in Chinese using the pattern</Muted>
        </>
      ) : (
        <>
          <Prompt>What&apos;s wrong? Fix it</Prompt>
          <p className="font-han text-3xl text-red-700 dark:text-red-400">{card.grammar.mistake.wrong}</p>
          <Muted>{card.grammar.title}</Muted>
        </>
      );
    case "mistake":
      return (
        <>
          <Prompt>You wrote this in chat. Fix it</Prompt>
          <p className="font-han text-3xl text-red-700 dark:text-red-400">{card.mistake.wrong}</p>
        </>
      );
  }
}

function Back({ card }: { card: CardContent }) {
  switch (card.kind) {
    case "word":
      return (
        <>
          {card.face === "p" && <p className="font-han text-7xl leading-tight">{card.word.hanzi}</p>}
          <p className="mt-2 text-2xl text-red-700 dark:text-red-400">{card.word.pinyin}</p>
          <p className="text-lg">{card.word.english}</p>
          <Muted>{card.word.pos}</Muted>
          <Panel>
            <div className="flex items-start justify-between gap-2">
              <Highlighted text={card.word.example.zh} parts={[card.word.hanzi]} className="text-xl" />
              <SpeakButton text={card.word.example.zh} label="Play example sentence" />
            </div>
            <Muted>{card.word.example.pinyin}</Muted>
            <p className="mt-1 text-sm">{card.word.example.en}</p>
          </Panel>
        </>
      );
    case "sentence":
      return (
        <>
          {card.face === "p" && (
            <Highlighted text={card.word.example.zh} parts={[card.word.hanzi]} className="text-3xl leading-relaxed" />
          )}
          <p className="mt-3 text-red-700 dark:text-red-400">{card.word.example.pinyin}</p>
          <p className="mt-1 text-lg">{card.word.example.en}</p>
          <Panel>
            <p>
              <span className="font-han text-lg">{card.word.hanzi}</span>{" "}
              <span className="text-red-700 dark:text-red-400">{card.word.pinyin}</span> · {card.word.english}
            </p>
          </Panel>
        </>
      );
    case "grammar":
      return card.face === "u" ? (
        <>
          <Highlighted text={card.example.zh} parts={card.example.highlight} className="mt-4 text-3xl leading-relaxed" />
          <p className="mt-2 text-red-700 dark:text-red-400">{card.example.pinyin}</p>
          <p className="mt-1 text-lg">{card.example.en}</p>
          <Panel>
            <p className="font-han mb-1 text-sm text-stone-500">{card.grammar.pattern}</p>
            <p className="text-sm">{card.grammar.explanation}</p>
          </Panel>
        </>
      ) : (
        <>
          <div className="mt-4">
            <Correction wrong={card.grammar.mistake.wrong} right={card.grammar.mistake.right} />
          </div>
          <p className="mt-2 text-red-700 dark:text-red-400">{card.grammar.mistake.pinyin}</p>
          <p className="mt-1 text-lg">{card.grammar.mistake.en}</p>
          <Panel>
            <p className="text-sm">{card.grammar.mistake.reason}</p>
            <p className="font-han mt-2 text-sm text-stone-500">{card.grammar.pattern}</p>
          </Panel>
        </>
      );
    case "mistake":
      return (
        <>
          <div className="mt-4">
            <Correction wrong={card.mistake.wrong} right={card.mistake.right} />
          </div>
          {card.mistake.pinyin && <p className="mt-2 text-red-700 dark:text-red-400">{card.mistake.pinyin}</p>}
          {card.mistake.en && <p className="mt-1 text-lg">{card.mistake.en}</p>}
          <Panel>
            <p className="text-sm">{card.mistake.reason}</p>
          </Panel>
        </>
      );
  }
}

export function CardFace({ card, revealed }: { card: CardContent; revealed: boolean }) {
  return (
    <div className="flex w-full flex-col items-center">
      {(!revealed || card.face === "r") && <Front card={card} />}
      {revealed && <Back card={card} />}
    </div>
  );
}
