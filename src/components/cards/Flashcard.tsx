import type { CardContent } from "@/lib/card-content";
import { AnswerInput, AnswerResult } from "./AnswerBox";
import { CardFace } from "./CardFace";
import { SpeakButton } from "./SpeakButton";

interface FlashcardProps {
  card: CardContent;
  revealed: boolean;
  isNew: boolean;
  typing: boolean;
  typed: string;
  onTypedChange: (value: string) => void;
  onReveal: () => void;
}

export function Flashcard({ card, revealed, isNew, typing, typed, onTypedChange, onReveal }: FlashcardProps) {
  const audio = revealed ? card.audio.back : card.audio.front;
  const showInput = typing && !revealed && card.answer !== undefined;
  return (
    <div
      role={revealed || showInput ? undefined : "button"}
      tabIndex={revealed || showInput ? undefined : 0}
      onClick={revealed || showInput ? undefined : onReveal}
      className="relative flex flex-1 flex-col items-center justify-center gap-4 rounded-3xl border border-stone-200 bg-white px-6 pb-6 pt-14 text-center shadow-sm dark:border-stone-800 dark:bg-stone-900"
    >
      <div className="absolute left-4 top-4 flex flex-wrap gap-2 text-xs">
        {card.level && (
          <span className="rounded-full bg-stone-100 px-2 py-0.5 text-stone-600 dark:bg-stone-800 dark:text-stone-300">
            HSK {card.level}
          </span>
        )}
        <span className="rounded-full bg-stone-100 px-2 py-0.5 text-stone-600 dark:bg-stone-800 dark:text-stone-300">
          {card.label}
        </span>
        {isNew && (
          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">
            new
          </span>
        )}
      </div>
      {audio && (
        <div className="absolute right-3 top-3">
          <SpeakButton text={audio} label="Play audio" />
        </div>
      )}

      <CardFace card={card} revealed={revealed} />

      {showInput && (
        <AnswerInput
          value={typed}
          acceptsPinyin={card.answer?.pinyin !== undefined}
          onChange={onTypedChange}
          onSubmit={onReveal}
        />
      )}
      {revealed && card.answer && <AnswerResult typed={typed} expected={card.answer} />}
      {!revealed && !showInput && <p className="text-sm text-stone-400">Tap to reveal</p>}
    </div>
  );
}
