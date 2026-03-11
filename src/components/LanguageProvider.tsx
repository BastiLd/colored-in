import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  DEFAULT_LANGUAGE,
  LANGUAGE_STORAGE_KEY,
  type Language,
  translate,
} from "@/lib/translations";

type LanguageContextValue = {
  language: Language;
  setLanguage: (language: Language) => Promise<void>;
  t: (key: string, fallback?: string) => string;
};

const LanguageContext = createContext<LanguageContextValue | null>(null);

function normalizeLanguage(value: string | null | undefined): Language {
  return value === "de" ? "de" : "en";
}

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<Language>(DEFAULT_LANGUAGE);

  const loadUserLanguage = useCallback(async (userId: string) => {
    const { data } = await supabase
      .from("user_settings")
      .select("language_preference")
      .eq("user_id", userId)
      .maybeSingle();

    const nextLanguage = normalizeLanguage((data as { language_preference?: string } | null)?.language_preference);
    setLanguageState(nextLanguage);
    localStorage.setItem(LANGUAGE_STORAGE_KEY, nextLanguage);
  }, []);

  useEffect(() => {
    const storedLanguage = normalizeLanguage(localStorage.getItem(LANGUAGE_STORAGE_KEY));
    setLanguageState(storedLanguage);

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        if (session?.user) {
          void loadUserLanguage(session.user.id);
        }
      }
    );

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        void loadUserLanguage(session.user.id);
      }
    });

    return () => subscription.unsubscribe();
  }, [loadUserLanguage]);

  const setLanguage = useCallback(async (nextLanguage: Language) => {
    setLanguageState(nextLanguage);
    localStorage.setItem(LANGUAGE_STORAGE_KEY, nextLanguage);

    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) {
      return;
    }

    await supabase
      .from("user_settings")
      .upsert(
        {
          user_id: session.user.id,
          language_preference: nextLanguage,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id" }
      );
  }, []);

  const value = useMemo<LanguageContextValue>(
    () => ({
      language,
      setLanguage,
      t: (key, fallback) => translate(language, key, fallback),
    }),
    [language, setLanguage]
  );

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error("useLanguage must be used within a LanguageProvider");
  }
  return context;
}
