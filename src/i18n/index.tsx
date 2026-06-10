import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import en from "../locales/en.json";
import zhCN from "../locales/zh_CN.json";
import ja from "../locales/ja.json";
import ko from "../locales/ko.json";
import es from "../locales/es.json";
import fr from "../locales/fr.json";
import de from "../locales/de.json";
import pt from "../locales/pt.json";
import ru from "../locales/ru.json";
import ar from "../locales/ar.json";

export type Locale =
  | "en"
  | "zh_CN"
  | "ja"
  | "ko"
  | "es"
  | "fr"
  | "de"
  | "pt"
  | "ru"
  | "ar";

export const LOCALE_NAMES: Record<Locale, string> = {
  en: "English",
  zh_CN: "简体中文",
  ja: "日本語",
  ko: "한국어",
  es: "Español",
  fr: "Français",
  de: "Deutsch",
  pt: "Português",
  ru: "Русский",
  ar: "العربية",
};

export const RTL_LOCALES = new Set<Locale>(["ar"]);

interface TranslationRecord {
  [key: string]: string | TranslationRecord;
}

const LOCALES: Record<Locale, TranslationRecord> = {
  en,
  zh_CN: zhCN,
  ja,
  ko,
  es,
  fr,
  de,
  pt,
  ru,
  ar,
};

export const ALL_LOCALES: Locale[] = Object.keys(LOCALES) as Locale[];

function getNestedValue(
  obj: TranslationRecord,
  path: string,
): string | undefined {
  const parts = path.split(".");
  let current: unknown = obj;
  for (const part of parts) {
    if (current === null || current === undefined || typeof current !== "object")
      return undefined;
    current = (current as TranslationRecord)[part];
  }
  return typeof current === "string" ? current : undefined;
}

function resolve(
  locale: TranslationRecord,
  fallback: TranslationRecord,
  key: string,
  vars?: Record<string, string | number>,
): string {
  let text = getNestedValue(locale, key) ?? getNestedValue(fallback, key) ?? key;
  if (vars) {
    for (const [varName, value] of Object.entries(vars)) {
      text = text.replace(new RegExp(`\\{${varName}\\}`, "g"), String(value));
    }
  }
  return text;
}

const LOCALE_STORAGE_KEY = "browsmemory-locale";

function detectLocale(): Locale {
  try {
    // Check localStorage first
    const stored = localStorage.getItem(LOCALE_STORAGE_KEY);
    if (stored && stored in LOCALES) return stored as Locale;
    // Fall back to navigator.language
    const lang = navigator.language?.replace("-", "_") ?? "";
    if (lang in LOCALES) return lang as Locale;
    const prefix = lang.split("_")[0];
    if (prefix in LOCALES) return prefix as Locale;
  } catch {
    // navigator not available (test env)
  }
  return "en";
}

export type TranslateFn = (
  key: string,
  vars?: Record<string, string | number>,
) => string;

interface I18nContextValue {
  t: TranslateFn;
  locale: Locale;
  setLocale: (locale: Locale) => void;
}

const I18nContext = createContext<I18nContextValue>({
  t: (key) => key,
  locale: "en",
  setLocale: () => {},
});

export function I18nProvider({
  children,
  locale: initialLocale,
}: {
  children: ReactNode;
  locale?: Locale;
}) {
  const [resolvedLocale, setResolvedLocale] = useState<Locale>(
    initialLocale ?? detectLocale(),
  );

  const setLocale = useCallback((newLocale: Locale) => {
    try {
      localStorage.setItem(LOCALE_STORAGE_KEY, newLocale);
    } catch {
      // localStorage not available
    }
    setResolvedLocale(newLocale);
  }, []);

  // Sync locale changes across pages (e.g. options iframe → sidepanel)
  useEffect(() => {
    if (initialLocale) return; // skip if locale is forced (e.g. tests)
    const onStorage = (e: StorageEvent) => {
      if (e.key === LOCALE_STORAGE_KEY && e.newValue && e.newValue in LOCALES) {
        setResolvedLocale(e.newValue as Locale);
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [initialLocale]);

  const localeData = LOCALES[resolvedLocale] ?? LOCALES.en;

  const t: TranslateFn = useCallback(
    (key, vars) => resolve(localeData, LOCALES.en, key, vars),
    [localeData],
  );

  const value = useMemo(
    () => ({ t, locale: resolvedLocale, setLocale }),
    [t, resolvedLocale, setLocale],
  );

  return (
    <I18nContext.Provider value={value}>
      <div dir={RTL_LOCALES.has(resolvedLocale) ? "rtl" : "ltr"}>
        {children}
      </div>
    </I18nContext.Provider>
  );
}

export function useT(): TranslateFn {
  return useContext(I18nContext).t;
}

export function useLocale(): Locale {
  return useContext(I18nContext).locale;
}

export function useSetLocale(): (locale: Locale) => void {
  return useContext(I18nContext).setLocale;
}
