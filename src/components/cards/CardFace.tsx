import type { ReactNode } from "react";
import type { CardContent } from "@/lib/card-content";
import { PERSONS, TENSE_CUE, TENSE_NAMES, type Verb } from "@/lib/verbs";
import { withArticle } from "@/lib/words";
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
  return <p className="mb-3 font-mono text-[11px] font-medium uppercase tracking-[0.18em] text-red-700 dark:text-red-400">{children}</p>;
}

/** Present and preterite side by side, for a verb's word card. */
function VerbTable({ verb }: { verb: Verb }) {
  return (
    <table className="font-pt mt-3 w-full text-left text-base">
      <thead>
        <tr className="font-sans text-xs uppercase tracking-wide text-stone-400">
          <th className="pb-1 font-medium" />
          <th className="pb-1 font-medium">Present</th>
          <th className="pb-1 font-medium">Past</th>
        </tr>
      </thead>
      <tbody>
        {PERSONS.map((person, i) => (
          <tr key={person}>
            <td className="py-0.5 pr-3 font-sans text-sm text-stone-500">{person}</td>
            <td className="py-0.5 pr-3">{verb.tenses.presente[i]}</td>
            <td className="py-0.5">{verb.tenses.preterito[i]}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function Front({ card }: { card: CardContent }) {
  switch (card.kind) {
    case "word":
      return card.face === "r" ? (
        <p className="font-pt text-5xl leading-tight sm:text-6xl">{withArticle(card.word)}</p>
      ) : (
        <>
          <Prompt>Say or write it in Portuguese</Prompt>
          <p className="text-3xl font-medium">{card.word.english}</p>
          <Muted>{card.word.pos}</Muted>
        </>
      );
    case "sentence":
      return card.face === "r" ? (
        <Highlighted text={card.word.example.pt} parts={[card.word.pt, ...card.word.forms]} className="text-3xl leading-relaxed" />
      ) : (
        <>
          <Prompt>Say or write it in Portuguese</Prompt>
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
          <p className="font-pt rounded-lg bg-stone-100 px-3 py-1 text-lg dark:bg-stone-800">{card.grammar.pattern}</p>
          <p className="mt-6 text-2xl font-medium">{card.example.en}</p>
          <Muted>Say it in Portuguese using the pattern</Muted>
        </>
      ) : (
        <>
          <Prompt>What&apos;s wrong? Fix it</Prompt>
          <p className="font-pt text-3xl text-red-700 dark:text-red-400">{card.grammar.mistake.wrong}</p>
          <Muted>{card.grammar.title}</Muted>
        </>
      );
    case "conjugation":
      return (
        <>
          <Prompt>{TENSE_NAMES[card.tense]}</Prompt>
          <p className="font-pt text-4xl">{card.verb.infinitive}</p>
          <Muted>{card.word.english}</Muted>
          <p className="font-pt mt-6 text-3xl">
            {TENSE_CUE[card.tense] && <span className="text-stone-400">{TENSE_CUE[card.tense]} </span>}
            {PERSONS[card.person]} <span className="text-stone-400">…</span>
          </p>
        </>
      );
    case "mistake":
      return (
        <>
          <Prompt>You wrote this in chat. Fix it</Prompt>
          <p className="font-pt text-3xl text-red-700 dark:text-red-400">{card.mistake.wrong}</p>
        </>
      );
  }
}

function Back({ card }: { card: CardContent }) {
  switch (card.kind) {
    case "word":
      return (
        <>
          {card.face === "p" && <p className="font-pt text-5xl leading-tight">{withArticle(card.word)}</p>}
          <p className="mt-2 text-lg">{card.word.english}</p>
          <Muted>{card.word.pos}</Muted>
          {card.verb && (
            <Panel>
              <VerbTable verb={card.verb} />
            </Panel>
          )}
          <Panel>
            <div className="flex items-start justify-between gap-2">
              <Highlighted text={card.word.example.pt} parts={[card.word.pt, ...card.word.forms]} className="text-xl" />
              <SpeakButton text={card.word.example.pt} label="Play example sentence" />
            </div>
            <p className="mt-1 text-sm">{card.word.example.en}</p>
          </Panel>
        </>
      );
    case "sentence":
      return (
        <>
          {card.face === "p" && (
            <Highlighted text={card.word.example.pt} parts={[card.word.pt, ...card.word.forms]} className="text-3xl leading-relaxed" />
          )}
          <p className="mt-3 text-lg">{card.word.example.en}</p>
          <Panel>
            <p>
              <span className="font-pt text-lg">{withArticle(card.word)}</span> · {card.word.english}
            </p>
          </Panel>
        </>
      );
    case "grammar":
      return card.face === "u" ? (
        <>
          <Highlighted text={card.example.pt} parts={card.example.highlight} className="mt-4 text-3xl leading-relaxed" />
          <p className="mt-2 text-lg">{card.example.en}</p>
          <Panel>
            <p className="font-pt mb-1 text-sm text-stone-500">{card.grammar.pattern}</p>
            <p className="text-sm">{card.grammar.explanation}</p>
          </Panel>
        </>
      ) : (
        <>
          <div className="mt-4">
            <Correction wrong={card.grammar.mistake.wrong} right={card.grammar.mistake.right} />
          </div>
          <p className="mt-2 text-lg">{card.grammar.mistake.en}</p>
          <Panel>
            <p className="text-sm">{card.grammar.mistake.reason}</p>
            <p className="font-pt mt-2 text-sm text-stone-500">{card.grammar.pattern}</p>
          </Panel>
        </>
      );
    case "conjugation":
      return (
        <>
          <p className="font-pt mt-4 text-4xl">
            {TENSE_CUE[card.tense] && <span className="text-stone-400">{TENSE_CUE[card.tense]} </span>}
            {PERSONS[card.person].split(" / ")[0]} <span className="text-red-700 dark:text-red-400">{card.form}</span>
          </p>
          <Panel>
            <p className="mb-2 font-mono text-[11px] font-medium uppercase tracking-[0.18em] text-red-700 dark:text-red-400">
              {card.verb.infinitive} · {TENSE_NAMES[card.tense]}
              {card.verb.irregular && " · irregular"}
            </p>
            <table className="font-pt w-full text-base">
              <tbody>
                {PERSONS.map((person, i) => (
                  <tr key={person} className={i === card.person ? "font-semibold" : "text-stone-600 dark:text-stone-300"}>
                    <td className="py-0.5 pr-3 text-sm text-stone-500">{person}</td>
                    <td className="py-0.5">{card.verb.tenses[card.tense][i]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Panel>
        </>
      );
    case "mistake":
      return (
        <>
          <div className="mt-4">
            <Correction wrong={card.mistake.wrong} right={card.mistake.right} />
          </div>
          {card.mistake.en && <p className="mt-2 text-lg">{card.mistake.en}</p>}
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
