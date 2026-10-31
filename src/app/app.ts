import { Component, computed, effect, inject, signal } from '@angular/core';
import { dbBusyUntil } from './db-guard';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { filter, map, take } from 'rxjs';
import { finishBoot } from './boot';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { Auth, supabase } from './auth';
import { ProtestBell } from './components/protest-bell';
import { Lang, saveLang } from './i18n';
import { Live } from './live';
import { ScrollRail } from './components/scroll-rail';
import { ThemePicker } from './components/theme-picker';
import { Theme } from './theme';
import { STAGING } from './supabase.config';

@Component({
  imports: [RouterOutlet, RouterLink, RouterLinkActive, TranslocoPipe, ProtestBell, ThemePicker, ScrollRail],
  selector: 'app-root',
  styleUrl: './app.scss',
  templateUrl: './app.html',
  host: { '(window:scroll)': 'onScroll()' },
})
export class App {
  private transloco = inject(TranslocoService);
  private router = inject(Router);
  private readonly url = toSignal(this.router.events.pipe(filter((e) => e instanceof NavigationEnd), map(() => this.router.url)), { initialValue: '' });
  /** Attack Shark в подвале — пока только на странице партнёра /attack-shark */
  protected readonly isSharkPage = computed(() => this.url().startsWith('/attack-shark'));
  /** пилот вошёл, а ник в Discord не указал — напоминание (не в кабинете — там подсвечено само поле — и не в админке/пультах) */
  protected readonly needDiscord = computed(() => !this.bare && this.auth.profile()?.discord === null && !/^\/(me|admin|judge|broadcast)/.test(this.url()));
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
  /** сайт подключён к тестовой базе — показываем метку, чтобы не перепутать с боевым */
  protected readonly staging = STAGING;
  // shortcut: проверяем адрес при загрузке — /overlay открывают напрямую в OBS, переходом изнутри сайта туда не попадают
  protected readonly bare = location.pathname.startsWith('/overlay');

  /** аварийное заграждение: сколько секунд до повтора (0 — база отвечает) */
  private readonly clock = signal(Date.now());
  protected readonly busyLeft = computed(() => Math.max(0, Math.ceil((dbBusyUntil() - this.clock()) / 1000)));
  private readonly busyTick = effect((onCleanup) => {
    if (!dbBusyUntil()) return;
    const id = setInterval(() => this.clock.set(Date.now()), 1000);
    this.clock.set(Date.now());
    onCleanup(() => clearInterval(id));
  });

  /** генеральный спонсор для подвала — из Админки → Спонсоры */
  protected readonly general = signal<{ name: string; url: string | null } | null>(null);
  /** приглашение в Discord для подвала — из Админки → Настройки */
  protected readonly discord = signal<string | null>(null);

  constructor() {
    this.transloco.langChanges$.subscribe((l) => (document.documentElement.lang = l));
    // загрузочный экран «SAD» уходит, когда первая страница открылась и её запросы к базе вернулись
    inject(Router).events.pipe(filter((e) => e instanceof NavigationEnd), take(1)).subscribe(() => finishBoot());
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
    if (!this.bare)
      supabase
        .from('app_settings')
        .select('discord_invite')
        .single()
        .then(({ data }) => this.discord.set(data?.discord_invite ?? null));
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
