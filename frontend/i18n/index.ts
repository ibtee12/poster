import bn from "./bn.json";
import en from "./en.json";

export type Language = "bn" | "en";

export type TranslationKey = keyof typeof bn;

const translations: Record<Language, Record<string, string>> = {
  bn,
  en,
};

export const DEFAULT_LANGUAGE: Language = "bn";
const STORAGE_KEY = "poster_app_lang";

export function getSavedLanguage(): Language {
  if (typeof window === "undefined") return DEFAULT_LANGUAGE;
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === "bn" || saved === "en") return saved;
  } catch (e) {
    // LocalStorage unavailable
  }
  return DEFAULT_LANGUAGE;
}

export function saveLanguage(lang: Language): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, lang);
  } catch (e) {
    // Ignore storage errors
  }
}

export function translate(
  lang: Language,
  key: TranslationKey | string,
  params?: Record<string, string | number>
): string {
  const dict = translations[lang] || translations[DEFAULT_LANGUAGE];
  let text = dict[key] || translations.en[key] || key;

  if (params) {
    for (const [paramKey, value] of Object.entries(params)) {
      text = text.replace(new RegExp(`\\{${paramKey}\\}`, "g"), String(value));
    }
  }

  return text;
}
