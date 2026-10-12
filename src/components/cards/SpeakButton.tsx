import { speakChinese } from "@/lib/speech";

export function SpeakButton({ text, label }: { text: string; label: string }) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        speakChinese(text);
      }}
      aria-label={label}
      className="shrink-0 rounded-full p-2 text-stone-400 hover:bg-stone-100 hover:text-stone-700 dark:hover:bg-stone-800 dark:hover:text-stone-200"
    >
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
        <path d="M11 5 6 9H2v6h4l5 4V5Z" />
        <path d="M15.5 8.5a5 5 0 0 1 0 7M19 5a10 10 0 0 1 0 14" />
      </svg>
    </button>
  );
}
