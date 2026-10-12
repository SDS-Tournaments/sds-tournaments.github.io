import { effect, inject, Injectable, signal, untracked } from '@angular/core';
import { Auth, Profile } from './auth';
import { Tier, tierOf } from './components/pilot-card';
import { loadSkillRuns } from './components/pilot-showcase';
import { mergeSkills, skills } from './scoring/scoring';

export type ThemeId = 'noir' | Tier;
export interface SiteTheme {
  id: ThemeId;
  /** уровень карточки, с которого стиль открыт (NOIR — у всех) */
  tier: Tier | null;
  /** образец цвета в списке */
  swatch: string;
  /** цвет строки браузера на телефоне */
  bar: string;
}

export const THEMES: SiteTheme[] = [
  { id: 'noir', tier: null, swatch: 'linear-gradient(135deg, #0abab5, #067f7b)', bar: '#000000' },
  { id: 'bronze', tier: 'bronze', swatch: 'linear-gradient(135deg, #8a5427, #e8ad72)', bar: '#000000' },
  { id: 'silver', tier: 'silver', swatch: 'linear-gradient(135deg, #8c969c, #f4f7f8)', bar: '#000000' },
  { id: 'gold', tier: 'gold', swatch: 'linear-gradient(135deg, #b8902c, #fff2b8)', bar: '#000000' },
  { id: 'elite', tier: 'elite', swatch: 'linear-gradient(135deg, #6a2cff, #ff4fd8)', bar: '#07040d' },
  { id: 'legend', tier: 'legend', swatch: 'linear-gradient(120deg, #ff6ec7, #ffd36e, #7dffb0, #6ee7ff, #b28dff)', bar: '#f1eee7' },
];
const RANK: Tier[] = ['bronze', 'silver', 'gold', 'elite', 'legend'];

/** Стиль открыт, если его уровень не выше уровня пилота (rank: -1 — нет рейтинга, 0 — BRONZE … 4 — LEGEND) */
export function unlocked(tier: Tier | null, rank: number) {
  return !tier || RANK.indexOf(tier) <= rank;
}
/** Уровень карточки → rank для unlocked(); null (нет рейтинга) → -1 */
export function rankOf(tier: Tier | null) {
  return tier ? RANK.indexOf(tier) : -1;
}
const KEY = 'sds-theme';

/**
 * Трансляция всегда в фирменном NOIR, независимо от стиля сайта: на время пульта/оверлея стиль снимается,
 * при уходе со страницы возвращается. Возвращает функцию «вернуть как было».
 */
export function forceNoir() {
  const root = document.documentElement;
  const prev = root.dataset['theme'];
  root.dataset['theme'] = 'noir';
  return () => {
    if (prev) root.dataset['theme'] = prev;
    else delete root.dataset['theme'];
  };
}

/**
 * Стиль сайта под уровень FIFA-карточки: открыт свой уровень и все ниже (LEGEND — все, ELITE — все кроме LEGEND…).
 * Гостям и пилотам без рейтинга — только NOIR; штабу — все (проверять стили).
 * shortcut: доступ проверяется в браузере — это косметика, защищать нечего.
 */
@Injectable({ providedIn: 'root' })
export class Theme {
  private readonly auth = inject(Auth);
  /** стиль ставит ещё index.html (до отрисовки) — берём его оттуда */
  readonly current = signal<ThemeId>(THEMES.find((t) => t.id === document.documentElement.dataset['theme'])?.id ?? 'noir');
  /** наивысший открытый уровень: -1 — ничего, 0 — BRONZE … 4 — LEGEND */
  readonly rank = signal(-1);

  constructor() {
    effect(() => {
      if (!this.auth.ready()) return;
      const p = this.auth.profile();
      untracked(() => this.loadRank(p));
    });
  }

  allowed(t: SiteTheme) {
    return unlocked(t.tier, this.rank());
  }

  set(id: ThemeId) {
    const t = THEMES.find((x) => x.id === id) ?? THEMES[0];
    this.current.set(t.id);
    document.documentElement.dataset['theme'] = t.id;
    document.querySelector('meta[name=theme-color]')?.setAttribute('content', t.bar);
    try {
      localStorage.setItem(KEY, t.id);
    } catch {}
  }

  private async loadRank(p: Profile | null) {
    let rank = -1;
    if (p?.role === 'admin' || p?.role === 'staff') rank = RANK.length - 1;
    else if (p) {
      const ovr = mergeSkills(skills(await loadSkillRuns(p.id)), p.legacy)?.overall ?? null;
      rank = rankOf(ovr === null ? null : tierOf(ovr));
    }
    this.rank.set(rank);
    // уровень упал или вышли из аккаунта — недоступный стиль сбрасывается на NOIR
    const cur = THEMES.find((t) => t.id === this.current())!;
    if (!this.allowed(cur)) this.set('noir');
  }
}
