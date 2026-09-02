"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";
import { createTranslator, DEFAULT_LOCALE, type I18nCatalog, type Translator, type UiLocale } from "@egocapture/core/i18n";

const I18nContext = createContext<Translator>(createTranslator(DEFAULT_LOCALE));

export function I18nProvider({ locale, catalog, children }: { locale: UiLocale; catalog: I18nCatalog; children: ReactNode }) {
  const translator = useMemo(() => createTranslator(locale, catalog), [locale, catalog]);
  return <I18nContext.Provider value={translator}>{children}</I18nContext.Provider>;
}

export function useI18n(): Translator {
  return useContext(I18nContext);
}

export function useTranslations(): Translator["t"] {
  return useI18n().t;
}
