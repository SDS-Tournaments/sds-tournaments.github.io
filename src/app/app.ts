import { Component, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { Auth, supabase } from './auth';
import { ProtestBell } from './components/protest-bell';
import { Lang, saveLang } from './i18n';
import { Live } from './live';
import { ScrollRail } from './components/scroll-rail';
import { ThemePicker } from './components/theme-picker';
import { Theme } from './theme';

@Component({
  imports: [RouterOutlet, RouterLink, RouterLinkActive, TranslocoPipe, ProtestBell, ThemePicker, ScrollRail],
  selector: 'app-root',
  styleUrl: './app.scss',
  templateUrl: './app.html',
  host: { '(window:scroll)': 'onScroll()' },
})
export class App {
  private transloco = inject(TranslocoService);
  protected readonly auth = inject(Auth);
  protected readonly live = inject(Live);
  /** стиль сайта под уровень карточки пилота (theme.ts) */
  protected readonly theme = inject(Theme);
  protected readonly lang = toSignal(this.transloco.langChanges$, { initialValue: this.transloco.getActiveLang() });
  protected readonly menuOpen = signal(false);
  /** страница прокручена — острова шапки плотнее, под ними мягкое затемнение */
  protected readonly scrolled = signal(false);
  /** 0…1: затемнение под шапкой нарастает вместе с прокруткой первых 160px */
  protected readonly shade = signal(0);
  protected readonly nav = ['standings', 'stages', 'pilots', 'teams', 'rules'];
  protected readonly year = new Date().getFullYear();
  // shortcut: проверяем адрес при загрузке — /overlay открывают напрямую в OBS, переходом изнутри сайта туда не попадают
  protected readonly bare = location.pathname.startsWith('/overlay');

  /** генеральный спонсор для подвала — из Админки → Спонсоры */
  protected readonly general = signal<{ name: string; url: string | null } | null>(null);

  constructor() {
    this.transloco.langChanges$.subscribe((l) => (document.documentElement.lang = l));
    if (!this.bare) this.live.start();
    if (!this.bare)
      supabase
        .from('sponsors')
        .select('name, url')
        .eq('tier', 'general')
        .eq('active', true)
        .order('sort')
        .limit(1)
        .maybeSingle()
        .then(({ data }) => this.general.set(data));
  }

  protected onScroll() {
    this.scrolled.set(scrollY > 8);
    this.shade.set(Math.min(scrollY / 160, 1));
  }

  setLang(lang: Lang) {
    this.transloco.setActiveLang(lang);
    saveLang(lang);
  }
}
