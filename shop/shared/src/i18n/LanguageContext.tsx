import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export type Language = "en" | "ta";

const STORAGE_KEY = "kumbakonam-language";

/** This is a Tamil-speaking local cafe — Tamil is the default; English is the opt-out via the toggle. */
const DEFAULT_LANGUAGE: Language = "ta";

interface LanguageContextValue {
  language: Language;
  setLanguage: (lang: Language) => void;
  toggleLanguage: () => void;
}

const LanguageContext = createContext<LanguageContextValue | null>(null);

function readStoredLanguage(): Language {
  if (typeof window === "undefined") return DEFAULT_LANGUAGE;
  const stored = window.localStorage.getItem(STORAGE_KEY);
  return stored === "ta" || stored === "en" ? stored : DEFAULT_LANGUAGE;
}

/** Wraps each app so any component/hook can read/switch English ↔ Tamil; persisted per device. */
export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>(readStoredLanguage);

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, language);
  }, [language]);

  const setLanguage = (lang: Language) => setLanguageState(lang);
  const toggleLanguage = () => setLanguageState((prev) => (prev === "en" ? "ta" : "en"));

  return (
    <LanguageContext.Provider value={{ language, setLanguage, toggleLanguage }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage(): LanguageContextValue {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error("useLanguage must be used within a LanguageProvider");
  return ctx;
}
