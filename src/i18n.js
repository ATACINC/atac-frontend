// src/i18n.js
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

// Bundle manifest, derived from the filesystem at build time. Every locale
// that has a translation bundle on disk appears here, keyed by its lowercase
// directory name. Vite resolves import.meta.glob at build time, so this needs
// no dependency and cannot drift from the files that actually exist.
//
// IMPORTANT: this is a list of which translation bundles EXIST, NOT a statement
// of which languages are live. Liveness comes from GET /api/languages/available
// at runtime (see LanguageSelector.jsx); a bundle existing here is one of the
// two gates a language must pass to be offered, never a claim on its own.
const bundleModules = import.meta.glob('./locales/*/translation.json', { eager: true });

// './locales/en/translation.json' -> 'en'
const BUNDLES = Object.fromEntries(
  Object.entries(bundleModules).map(([path, mod]) => [path.split('/')[2], mod.default]),
);

// The bundle codes (['en','es','fr'] today), read straight from disk. Exported
// so the selector's bundle gate uses the exact same manifest -- one definition
// of "which bundles exist", and it is the filesystem.
export const BUNDLE_CODES = Object.keys(BUNDLES);

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    // resources and supportedLngs both derive from the bundle manifest above.
    resources: Object.fromEntries(
      Object.entries(BUNDLES).map(([code, translation]) => [code, { translation }]),
    ),

    // The set of bundles that exist (a manifest, not a liveness statement --
    // see the note above). Kept so i18n can load any bundle we ship strings
    // for; the runtime API decides which of these a candidate may select.
    supportedLngs: BUNDLE_CODES,

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