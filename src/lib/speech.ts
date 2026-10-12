/** Reads Chinese text aloud with the browser's built-in voice; silently unavailable where unsupported. */
export function speakChinese(text: string): void {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = "zh-CN";
  utterance.rate = 0.85;
  window.speechSynthesis.speak(utterance);
}
