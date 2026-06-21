import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import ru from './locales/ru.json';
import uz from './locales/uz.json';

export const SUPPORTED_LANGUAGES = ['uz', 'ru'] as const;
export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];

const LANGUAGE_STORAGE_KEY = 'rivera-language';

function getInitialLanguage(): SupportedLanguage {
  if (typeof window === 'undefined') {
    return 'uz';
  }

  try {
    const stored = window.localStorage.getItem(LANGUAGE_STORAGE_KEY);
    if (stored === 'uz' || stored === 'ru') {
      return stored;
    }
  } catch {
    return 'uz';
  }

  return 'uz';
}

void i18n.use(initReactI18next).init({
  resources: {
    uz: { translation: uz },
    ru: { translation: ru },
  },
  lng: getInitialLanguage(),
  fallbackLng: 'uz',
  interpolation: {
    escapeValue: false,
  },
});

i18n.on('languageChanged', (language) => {
  if (language !== 'uz' && language !== 'ru') {
    return;
  }

  try {
    window.localStorage.setItem(LANGUAGE_STORAGE_KEY, language);
  } catch {
    // The selected language still changes in memory if storage is unavailable.
  }
});

export default i18n;
