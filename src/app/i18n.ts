import { Injectable } from '@angular/core';
import { Translation, TranslocoLoader } from '@jsverse/transloco';
import ru from '../../public/i18n/ru.json';

export const LANGS = ['ru', 'en'] as const;
export type Lang = (typeof LANGS)[number];
const KEY = 'sds-lang';

@Injectable({ providedIn: 'root' })
export class I18nLoader implements TranslocoLoader {
  // переводы собираются вместе с кодом (имя файла с хешем) — после публикации браузер не покажет старые из кэша
  async getTranslation(lang: string): Promise<Translation> {
    return lang === 'en' ? (await import('../../public/i18n/en.json')).default : ru;
  }
}

// Русский по умолчанию; выбор пилота запоминается в браузере
export function savedLang(): Lang {
  try {
    return localStorage.getItem(KEY) === 'en' ? 'en' : 'ru';
  } catch {
    return 'ru';
  }
}

export function saveLang(lang: Lang) {
  try {
    localStorage.setItem(KEY, lang);
  } catch {}
}
