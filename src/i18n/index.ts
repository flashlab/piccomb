import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import LanguageDetector from 'i18next-browser-languagedetector'
import zh from './locales/zh.json'
import ja from './locales/ja.json'
import en from './locales/en.json'

void i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      zh: { translation: zh },
      ja: { translation: ja },
      en: { translation: en },
    },
    supportedLngs: ['zh', 'ja', 'en'],
    fallbackLng: 'zh',
    interpolation: { escapeValue: false },
    detection: {
      order: ['localStorage', 'navigator'],
      caches: ['localStorage'],
      lookupLocalStorage: 'piccomb-lang',
    },
  })

export default i18n
