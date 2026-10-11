import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Translation, TranslocoLoader } from '@jsverse/transloco';

export const LANGS = ['ru', 'en'] as const;
export type Lang = (typeof LANGS)[number];
const KEY = 'sds-lang';

@Injectable({ providedIn: 'root' })
export class I18nLoader implements TranslocoLoader {
  private http = inject(HttpClient);
  getTranslation(lang: string) {
    return this.http.get<Translation>(`/i18n/${lang}.json`);
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
