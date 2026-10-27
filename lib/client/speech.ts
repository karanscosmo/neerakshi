"use client";
import { useCallback, useEffect, useState } from "react";
import { LOCALE_BCP47, type Locale } from "@/lib/i18n/config";

/** Browser Web Speech API. `available` is false when no voice exists for the language — the Listen button then hides. */
export function useSpeech(locale: Locale) {
  const [voice, setVoice] = useState<SpeechSynthesisVoice | null>(null);
  const [speaking, setSpeaking] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    const pick = () => {
      const tag = LOCALE_BCP47[locale].toLowerCase();
      const lang = tag.split("-")[0];
      const vs = window.speechSynthesis.getVoices();
      setVoice(vs.find((v) => v.lang.toLowerCase() === tag) ?? vs.find((v) => v.lang.toLowerCase().startsWith(lang)) ?? null);
    };
    pick();
    window.speechSynthesis.addEventListener("voiceschanged", pick);
    return () => window.speechSynthesis.removeEventListener("voiceschanged", pick);
  }, [locale]);
  const speak = useCallback(
    (text: string) => {
      if (!voice) return;
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.voice = voice;
      u.lang = voice.lang;
      u.rate = 0.92;
      u.onend = () => setSpeaking(false);
      u.onerror = () => setSpeaking(false);
      setSpeaking(true);
      window.speechSynthesis.speak(u);
    },
    [voice],
  );
  const stop = useCallback(() => {
    window.speechSynthesis?.cancel();
    setSpeaking(false);
  }, []);
  return { available: Boolean(voice), speaking, speak, stop };
}
