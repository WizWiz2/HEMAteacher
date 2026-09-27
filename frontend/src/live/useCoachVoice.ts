import { useEffect, useRef } from "react";

export function useCoachVoice(text: string | null, enabled: boolean) {
  const last = useRef<{ text: string; at: number }>({ text: "", at: 0 });

  useEffect(() => {
    if (!enabled || !text || !("speechSynthesis" in window)) return;
    const now = performance.now();
    if (last.current.text === text && now - last.current.at < 3500) return;
    if (now - last.current.at < 1200) return;

    const spoken = clean(text);
    if (!spoken) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(spoken);
    utterance.lang = "ru-RU";
    utterance.rate = 0.92;
    utterance.volume = 0.9;
    window.speechSynthesis.speak(utterance);
    last.current = { text, at: now };
  }, [text, enabled]);
}

function clean(text: string): string {
  return text
    .replace(/·/g, ".")
    .replace(/КАМЕРА/g, "Камера")
    .replace(/ХОРОШО/g, "хорошо")
    .toLowerCase();
}
