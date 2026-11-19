"use client";

import { createContext, useContext, useEffect, useState } from "react";

type Language = "vi" | "en";
type Theme = "light" | "dark";
type PreferenceState = { language: Language; theme: Theme; setLanguage: (value: Language) => void; setTheme: (value: Theme) => void };
const Preferences = createContext<PreferenceState | null>(null);

export function PreferencesProvider({ children }: { children: React.ReactNode }) {
  const [language, updateLanguage] = useState<Language>("en");
  const [theme, updateTheme] = useState<Theme>("light");
  useEffect(() => {
    const sync = () => {
      try {
        updateLanguage(localStorage.getItem("stylese-language") === "vi" ? "vi" : "en");
        updateTheme(localStorage.getItem("stylese-theme") === "dark" ? "dark" : "light");
      } catch { /* Preferences remain usable for this session. */ }
    };
    Promise.resolve().then(sync);
    window.addEventListener("storage", sync);
    return () => window.removeEventListener("storage", sync);
  }, []);
  useEffect(() => { document.documentElement.lang = language; document.documentElement.dataset.theme = theme; }, [language, theme]);
  const setLanguage = (value: Language) => { updateLanguage(value); try { localStorage.setItem("stylese-language", value); } catch {} };
  const setTheme = (value: Theme) => { updateTheme(value); try { localStorage.setItem("stylese-theme", value); } catch {} };
  return <Preferences.Provider value={{ language, theme, setLanguage, setTheme }}>{children}</Preferences.Provider>;
}

export function usePreferences() {
  const preferences = useContext(Preferences);
  if (!preferences) throw new Error("PreferencesProvider is missing");
  return preferences;
}
