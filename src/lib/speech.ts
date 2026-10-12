/** Reads Brazilian Portuguese aloud with the browser's built-in voice; silently unavailable where unsupported. */
export function speakPortuguese(text: string): void {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = "pt-BR";
  // Prefer an installed Brazilian voice; some browsers otherwise fall back to a European one.
  const voice = window.speechSynthesis.getVoices().find((v) => v.lang.replace("_", "-") === "pt-BR");
  if (voice) utterance.voice = voice;
  utterance.rate = 0.9;
  window.speechSynthesis.speak(utterance);
}
