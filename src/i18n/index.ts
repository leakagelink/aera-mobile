import { getLocales } from 'expo-localization';
import { useCallback } from 'react';

import { catalog, type MessageKey } from '@/i18n/catalog';
import { usePreferencesStore, type AssistantLanguage } from '@/store/preferencesStore';

export type { MessageKey };
export type AppLanguage = Exclude<AssistantLanguage, 'auto'>;

const supported: AppLanguage[] = ['en', 'hi', 'mr', 'ta', 'te', 'bn', 'gu', 'kn', 'ml', 'pa', 'ur'];

const localeTags: Record<AppLanguage, string> = {
  en: 'en',
  hi: 'hi-IN',
  mr: 'mr-IN',
  ta: 'ta-IN',
  te: 'te-IN',
  bn: 'bn-IN',
  gu: 'gu-IN',
  kn: 'kn-IN',
  ml: 'ml-IN',
  pa: 'pa-IN',
  ur: 'ur',
};

export function deviceLanguage(): AppLanguage {
  const code = getLocales()[0]?.languageCode?.toLowerCase() ?? '';
  return supported.includes(code as AppLanguage) ? (code as AppLanguage) : 'en';
}

export function appLanguage(): AppLanguage {
  const selected = usePreferencesStore.getState().assistantLanguage;
  return selected === 'auto' ? deviceLanguage() : selected;
}

export function localeTag(language = appLanguage()): string {
  return localeTags[language];
}

export function text(language: AppLanguage, key: MessageKey, vars?: Record<string, string | number>): string {
  const template = catalog[key][language] || catalog[key].en;
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (_, name: string) => String(vars[name] ?? ''));
}

export function t(key: MessageKey, vars?: Record<string, string | number>): string {
  return text(appLanguage(), key, vars);
}

export function copy(value: string | null | undefined): string | null {
  if (!value) return null;
  if (value in catalog) return t(value as MessageKey);
  return value;
}

export function useT() {
  const selected = usePreferencesStore((state) => state.assistantLanguage);
  const language: AppLanguage = selected === 'auto' ? deviceLanguage() : selected;
  const translate = useCallback(
    (key: MessageKey, vars?: Record<string, string | number>) => text(language, key, vars),
    [language],
  );
  return { language, t: translate };
}
