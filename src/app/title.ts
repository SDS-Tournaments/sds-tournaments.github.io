import { DOCUMENT, Injectable, inject } from '@angular/core';
import { Title } from '@angular/platform-browser';
import { RouterStateSnapshot, TitleStrategy } from '@angular/router';

const SITE = 'https://sds-tournaments.github.io';
export const SITE_TITLE = 'Sad Drift Series — онлайн-чемпионат по дрифту в CarX Drift Racing Online 2';

/**
 * Заголовок вкладки «Пилоты — Sad Drift Series» + адрес страницы для поисковиков и превью ссылок
 * (canonical, og:url, og:title): иначе поисковик сочтёт все страницы копией главной.
 */
@Injectable({ providedIn: 'root' })
export class SdsTitle extends TitleStrategy {
  private readonly title = inject(Title);
  private readonly doc = inject(DOCUMENT);
  override updateTitle(state: RouterStateSnapshot) {
    const t = this.buildTitle(state);
    this.title.setTitle(t ? `${t} — Sad Drift Series` : SITE_TITLE);
    const url = SITE + state.url.split(/[?#]/)[0];
    this.doc.querySelector('link[rel=canonical]')?.setAttribute('href', url);
    this.doc.querySelector('meta[property="og:url"]')?.setAttribute('content', url);
    this.doc.querySelector('meta[property="og:title"]')?.setAttribute('content', t ? `${t} — Sad Drift Series` : 'Sad Drift Series — онлайн-чемпионат по дрифту');
  }
}

/** Заголовок страницы с данными (ник пилота, название этапа или команды) — когда они загрузились */
export function pageTitle(name: string) {
  document.title = `${name} — Sad Drift Series`;
}
