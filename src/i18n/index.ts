/**
 * i18n setup — English + Simplified Chinese (zh-Hans) with a live runtime toggle.
 *
 * i18next + react-i18next + expo-localization, persisted via AsyncStorage.
 * Calling i18n.changeLanguage('zh-Hans' | 'en') re-renders every useTranslation
 * consumer instantly (no restart — neither language is RTL).
 *
 * Imported once at the top of app/_layout.tsx so it runs before any screen.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getLocales } from 'expo-localization';
import i18n, { type LanguageDetectorAsyncModule } from 'i18next';
import { initReactI18next } from 'react-i18next';

import en from './locales/en.json';
import zhHans from './locales/zh-Hans.json';

const STORAGE_KEY = 'app.lang';
export const SUPPORTED_LANGS = ['en', 'zh-Hans'] as const;
export type Lang = (typeof SUPPORTED_LANGS)[number];

const languageDetector: LanguageDetectorAsyncModule = {
  type: 'languageDetector',
  async: true,
  detect: async () => {
    try {
      const saved = await AsyncStorage.getItem(STORAGE_KEY);
      if (saved) return saved;
    } catch {
      // ignore storage errors — fall back to device locale
    }
    const device = getLocales()[0];
    return device?.languageTag?.toLowerCase().startsWith('zh') ? 'zh-Hans' : 'en';
  },
  cacheUserLanguage: async (lng) => {
    try {
      await AsyncStorage.setItem(STORAGE_KEY, lng);
    } catch {
      // best-effort persistence
    }
  },
};

i18n
  .use(languageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: en },
      'zh-Hans': { translation: zhHans },
    },
    fallbackLng: 'en',
    supportedLngs: SUPPORTED_LANGS as unknown as string[],
    interpolation: { escapeValue: false },
    react: { useSuspense: false },
  });

/** Toggle between the two supported languages (persists automatically). */
export function toggleLanguage() {
  const next: Lang = i18n.language === 'zh-Hans' ? 'en' : 'zh-Hans';
  i18n.changeLanguage(next);
}

export default i18n;
