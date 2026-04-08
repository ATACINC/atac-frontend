// src/i18n.js
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

// Import locale files directly (Vite handles JSON imports natively)
import enTranslation from './locales/en/translation.json';
import esTranslation from './locales/es/translation.json';
import frTranslation from './locales/fr/translation.json';

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: enTranslation },
      es: { translation: esTranslation },
      fr: { translation: frTranslation },
    },

    // Supported languages at launch
    supportedLngs: ['en', 'es', 'fr'],

    // Fall back to English if a string isn't translated yet
    fallbackLng: 'en',

    // Default to English — detector overrides if user has a saved preference
    lng: 'en',

    // Language detection: check localStorage first, then browser
    detection: {
      order: ['localStorage', 'navigator'],
      lookupLocalStorage: 'atac_language',
      caches: ['localStorage'],
    },

    interpolation: {
      escapeValue: false, // React already escapes
    },

    react: {
      useSuspense: false, // Prevents blank screen on slow loads
    },
  });

export default i18n;