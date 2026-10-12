import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { supabase } from '../auth';
import { LiveStage } from '../components/live-stage';
import { NextStage } from '../components/next-stage';
import { RoadStage, SeasonRoad } from '../components/season-road';
import { currentSeason, loadStandings, PilotStanding, TeamStanding } from '../data/standings';
import { Reveal } from '../reveal';

// Главная: ближайший/идущий этап, LIVE с Twitch, лидеры сезона, спонсоры
@Component({
  selector: 'app-home',
  imports: [RouterLink, TranslocoPipe, Reveal, NextStage, LiveStage, SeasonRoad],
  template: `
    <section class="hero">
      <span class="kanji" aria-hidden="true">ドリフト</span>

      <div class="container inner">
        <div class="text">
          <p class="chip rise"><span class="dot"></span>{{ 'home.chip' | transloco }}</p>
          <h1 class="display-xl rise" style="--i: 1">Sad Drift<br /><span class="accent">Series</span></h1>
          <p class="lead muted rise" style="--i: 2">{{ 'home.lead' | transloco }}</p>
          <div class="cta rise" style="--i: 3">
            <a routerLink="/stages" class="btn btn-primary">{{ 'home.toStages' | transloco }} →</a>
            <a routerLink="/standings" class="btn btn-secondary">{{ 'home.toStandings' | transloco }}</a>
          </div>
          @if (general(); as g) {
            <a class="sponsor rise" style="--i: 4" [href]="g.url" target="_blank" rel="noopener">
              <span class="sponsor-lbl">{{ 'sponsor.general' | transloco }}</span>
              @if (g.logo_url) { <img [src]="g.logo_url" [alt]="g.name" height="32" /> } @else { <span class="sponsor-name">{{ g.name }}</span> }
            </a>
          }
        </div>
        <app-next-stage
          class="rise"
          style="--i: 4"
          [stage]="next() ? stageTitle(next()!) : null"
          [startsAt]="next()?.starts_at ? toDate(next()!.starts_at!) : null"
          [registered]="nextCount()"
          [status]="next()?.status ?? 'registration'"
        />
      </div>
    </section>

    @if (live(); as l) {
      <section id="live" class="section container live">
        <p class="eyebrow" reveal>LIVE</p>
        <h2 class="display-lg" reveal>{{ stageTitle(l) }}</h2>
        <app-live-stage [stageId]="l.id" [status]="l.status" [channel]="l.twitch_channel || twitch()" />
      </section>
    }

    @if (road().length) {
      <section class="section road-sec">
        <div class="container">
          <p class="eyebrow" reveal>{{ seasonTitle() }}</p>
          <h2 class="display-lg" reveal>{{ 'road.title' | transloco }}</h2>
        </div>
        <app-season-road [stages]="road()" />
      </section>
    }

    @if (pilots().length) {
      <section class="section container">
        <p class="eyebrow" reveal>{{ seasonTitle() }}</p>
        <h2 class="display-lg" reveal>{{ 'home.leaders' | transloco }}</h2>
        <div class="leaders">
          <ol class="card board" reveal>
            <li class="bhead"><span>{{ 'home.pilots' | transloco }}</span><span class="subtle">{{ 'home.points' | transloco }}</span></li>
            @for (p of pilots(); track p.id; let i = $index) {
              <li [class.first]="i === 0">
                <span class="mono place">{{ p.place }}</span>
                @if (p.avatar_url) { <img [src]="p.avatar_url" alt="" width="36" height="36" loading="lazy" decoding="async" /> } @else { <span class="ph"></span> }
                <span class="who"><b>{{ p.nickname }}</b><span class="subtle">{{ p.team ?? '' }}</span></span>
                <span class="mono pts">{{ p.points }}</span>
              </li>
            }
          </ol>
          @if (teams().length) {
            <ol class="card board" reveal style="--i: 1">
              <li class="bhead"><span>{{ 'home.teams' | transloco }}</span><span class="subtle">{{ 'home.points' | transloco }}</span></li>
              @for (t of teams(); track t.id; let i = $index) {
                <li [class.first]="i === 0">
                  <span class="mono place">{{ t.place }}</span>
                  <span class="tlogo" [style.background-image]="t.logo_url ? 'url(' + t.logo_url + ')' : null">
                    @if (!t.logo_url) { {{ initials(t.name) }} }
                  </span>
                  <span class="who"><b>{{ t.name }}</b></span>
                  <span class="mono pts">{{ t.points }}</span>
                </li>
              }
            </ol>
          }
        </div>
        <a routerLink="/standings" class="more" reveal>{{ 'home.fullStandings' | transloco }} →</a>
      </section>
    }

    <section class="section container">
      <p class="eyebrow" reveal>{{ 'home.how.eyebrow' | transloco }}</p>
      <h2 class="display-lg" reveal>{{ 'home.how.title' | transloco }}</h2>
      <div class="steps">
        @for (step of steps; track step; let i = $index) {
          <article class="card card-hover step" reveal [style.--i]="i">
            <span class="step-no mono">0{{ i + 1 }}</span>
            <h3>{{ 'home.how.' + step + '.title' | transloco }}</h3>
            <p class="muted">{{ 'home.how.' + step + '.text' | transloco }}</p>
          </article>
        }
      </div>
    </section>

    @if (sponsors().length) {
      <section class="sponsors container" reveal>
        <p class="eyebrow">{{ 'home.partners' | transloco }}</p>
        <div class="logos">
          @for (s of sponsors(); track s.id) {
            <a [href]="s.url" target="_blank" rel="noopener" [class.gen]="s.tier === 'general'" [title]="s.name">
              @if (s.logo_url) { <img [src]="s.logo_url" [alt]="s.name" /> } @else { {{ s.name }} }
            </a>
          }
        </div>
      </section>
    }
  `,
  styles: `
    .hero {
      position: relative;
      overflow: hidden;
      min-height: calc(100svh - 64px);
      display: flex;
      align-items: center;
      padding: 64px 0 160px;
      isolation: isolate;
    }
    .inner {
      position: relative;
      width: 100%;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 48px;
    }
    @media (max-width: 900px) {
      .inner { flex-direction: column; align-items: flex-start; }
    }

    /* Во время этапа надпись загорается неоном и пульсирует; на событие эфира — вспышка */
    :host-context(html.live) .kanji {
      -webkit-text-stroke: 1.5px rgba(var(--accent-rgb), 0.8);
      filter: drop-shadow(0 0 16px rgba(var(--accent-rgb), 0.7)) drop-shadow(0 0 46px rgba(255, 92, 92, 0.25));
      animation: kanji-live 2.4s var(--ease-in-out) infinite;
    }
    :host-context(html.pulse) .kanji {
      -webkit-text-stroke-color: #ff5c5c;
      filter: drop-shadow(0 0 24px rgba(255, 92, 92, 0.8));
    }
    @keyframes kanji-live {
      0%, 100% { opacity: 0.45; }
      50% { opacity: 1; }
    }
    @media (prefers-reduced-motion: reduce) {
      :host-context(html.live) .kanji { animation: none; }
    }

    .kanji {
      position: absolute;
      right: -2vw;
      bottom: 4vw;
      z-index: -2;
      font-size: clamp(120px, 20vw, 300px);
      font-weight: 600;
      line-height: 1;
      color: transparent;
      -webkit-text-stroke: 1px rgba(var(--accent-rgb), 0.25);
      user-select: none;
      pointer-events: none;
    }

    .chip {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      margin: 0;
      padding: 6px 14px;
      border: 1px solid rgba(var(--accent-rgb), 0.35);
      border-radius: var(--r-pill);
      background: rgba(var(--accent-rgb), 0.08);
      color: var(--primary);
      font-size: 12px;
      font-weight: 500;
      letter-spacing: 1px;
      text-transform: uppercase;
      backdrop-filter: blur(6px);
    }
    .dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: var(--primary);
    }
    .dot { position: relative; }
.dot::after { content: ''; position: absolute; inset: 0; border-radius: 50%; background: var(--primary); animation: ring-out 2s ease-out infinite; }
    @keyframes ring-out { from { transform: scale(1); opacity: 0.6; } to { transform: scale(3.4); opacity: 0; } }

    h1 { margin: 20px 0 24px; }
    :host-context([data-theme='legend']) .kanji { -webkit-text-stroke-color: rgba(148, 112, 15, 0.3); }
    :host-context([data-theme='legend']) .accent { background-image: linear-gradient(100deg, #94700f 0%, #e2b84a 40%, #6b4f08 70%, #94700f 100%); filter: drop-shadow(0 0 18px rgba(226, 184, 74, 0.35)); }
    .accent {
      background: linear-gradient(100deg, var(--primary) 0%, var(--primary-hover) 45%, var(--primary) 60%, var(--primary-pressed) 100%);
      background-size: 250% 100%;
      -webkit-background-clip: text;
      background-clip: text;
      color: transparent;
      filter: drop-shadow(0 0 28px rgba(var(--accent-rgb), 0.45));
      animation: shine 2.5s var(--ease-out) 0.6s both;
    }
    @keyframes shine {
      from { background-position: 100% 0; }
      to { background-position: 0 0; }
    }
    .lead { max-width: 520px; font-size: 18px; margin: 0 0 32px; }
    .cta { display: flex; flex-wrap: wrap; gap: 12px; }

    /* Генеральный спонсор */
    .sponsor {
      display: inline-grid;
      gap: 4px;
      margin-top: 48px;
      padding: 0 0 0 16px;
      border-left: 2px solid var(--primary);
      background: none;
      color: var(--ink);
      &:hover { color: var(--primary-hover); }
    }
    .sponsor-lbl {
      font-size: 11px;
      letter-spacing: 1.5px;
      text-transform: uppercase;
      color: var(--ink-subtle);
    }
    .sponsor-name {
      font-size: 20px;
      font-weight: 600;
      letter-spacing: 0.04em;
      text-transform: uppercase;
      transition: color var(--fast);
    }

    h2 { margin: 12px 0 48px; max-width: 640px; }
    .steps {
      display: grid;
      gap: 24px;
      grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
    }
    .step {
      h3 { font-size: 20px; margin: 16px 0 8px; }
      p { margin: 0; }
    }
    .road-sec { padding-bottom: 32px; }
    .road-sec h2 { margin: 12px 0 24px; }
    .live { padding-bottom: 0; }
    .live h2 { margin: 12px 0 32px; }

    .leaders { display: grid; gap: 24px; grid-template-columns: 1.4fr 1fr; align-items: start; }
    @media (max-width: 900px) { .leaders { grid-template-columns: 1fr; } }
    .board { list-style: none; margin: 0; padding: 8px; display: grid; gap: 2px; }
    .board li { display: grid; grid-template-columns: 28px 36px 1fr auto; gap: 12px; align-items: center; padding: 10px 12px; border-radius: var(--r-md); transition: background-color var(--fast); }
    .board li:hover { background: var(--surface-2); }
    .board li.first { background: linear-gradient(90deg, var(--primary-soft), transparent); }
    .board img, .ph, .tlogo { width: 36px; height: 36px; border-radius: 50%; background: var(--surface-3) center / cover no-repeat; }
    .tlogo { border-radius: var(--r-sm); display: grid; place-items: center; font: 600 13px var(--mono); color: var(--primary); background-color: var(--primary-soft); }
    .board li.bhead {
      display: flex; justify-content: space-between; padding: 8px 12px 12px; margin-bottom: 4px;
      border-bottom: 1px solid var(--hairline); border-radius: 0;
      font-size: 12px; font-weight: 500; letter-spacing: 1.2px; text-transform: uppercase; color: var(--primary);
    }
    .board li.bhead:hover { background: none; }
    .place { color: var(--ink-subtle); }
    .first .place { color: var(--primary); }
    .who { display: grid; min-width: 0; b { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; } span { font-size: 12px; } }
    .pts { font-size: 18px; color: var(--primary); }
    .more { display: inline-block; margin-top: 24px; }

    .sponsors { padding-block: 32px 96px; text-align: center; }
    .logos { display: flex; flex-wrap: wrap; justify-content: center; align-items: center; gap: 24px 48px; margin-top: 16px; }
    .logos a { color: var(--ink-subtle); background: none; font-weight: 600; letter-spacing: 0.04em; text-transform: uppercase; transition: color var(--fast), opacity var(--fast); }
    .logos a:hover { color: var(--ink); }
    .logos a.gen { color: var(--ink); font-size: 20px; }
    .logos img { height: 36px; width: auto; opacity: 0.7; filter: grayscale(1) brightness(1.6); transition: opacity var(--fast), filter var(--fast); }
    .logos a:hover img, .logos a.gen img { opacity: 1; filter: none; }
    .sponsor img { height: 32px; width: auto; }

    .step-no {
      font-size: 48px;
      line-height: 1;
      color: transparent;
      -webkit-text-stroke: 1px var(--primary);
    }
  `,
})
export class Home implements OnInit {
  protected readonly steps = ['qual', 'bracket', 'final'];

  /** идущий этап, иначе ближайший с открытой регистрацией */
  protected readonly next = signal<StageCard | null>(null);
  protected readonly nextCount = signal(0);
  protected readonly live = computed(() => (this.next()?.status === 'qualifying' || this.next()?.status === 'battles' ? this.next() : null));
  protected readonly twitch = signal<string | null>(null);
  protected readonly pilots = signal<PilotStanding[]>([]);
  protected readonly teams = signal<TeamStanding[]>([]);
  protected readonly seasonTitle = signal('');
  protected readonly sponsors = signal<Sponsor[]>([]);
  protected readonly general = computed(() => this.sponsors().find((s) => s.tier === 'general') ?? null);
  private readonly lang = signal(inject(TranslocoService).getActiveLang());
  private readonly rawRoad = signal<(Omit<RoadStage, 'title'> & { title_ru: string; title_en: string | null })[]>([]);
  protected readonly road = computed<RoadStage[]>(() =>
    this.rawRoad().map((s) => ({ ...s, title: this.lang() === 'en' && s.title_en ? s.title_en : s.title_ru })),
  );

  constructor() {
    inject(TranslocoService).langChanges$.subscribe((l) => this.lang.set(l));
  }

  async ngOnInit() {
    const [stages, settings, sponsors, season] = await Promise.all([
      supabase.from('stages').select('id, title_ru, title_en, track, starts_at, status, twitch_channel').in('status', ['registration', 'qualifying', 'battles']).order('starts_at'),
      supabase.from('app_settings').select('twitch_channel').single(),
      supabase.from('sponsors').select('id, name, logo_url, url, tier').order('tier').order('sort'),
      currentSeason(),
    ]);
    const list = (stages.data ?? []) as StageCard[];
    const next = list.find((s) => s.status !== 'registration') ?? list[0] ?? null;
    this.next.set(next);
    this.twitch.set(settings.data?.twitch_channel ?? null);
    this.sponsors.set((sponsors.data ?? []) as Sponsor[]);
    if (next) {
      const { count } = await supabase.from('registrations').select('profile_id', { count: 'exact', head: true }).eq('stage_id', next.id).eq('status', 'registered');
      this.nextCount.set(count ?? 0);
    }
    if (season) {
      this.seasonTitle.set(season.title);
      this.loadRoad(season.id);
      const st = await loadStandings(season.id, season.team_counted);
      this.pilots.set(st.pilots.slice(0, 5));
      this.teams.set(st.teams.slice(0, 3));
    }
  }

  protected stageTitle(s: StageCard) {
    const t = this.lang() === 'en' && s.title_en ? s.title_en : s.title_ru;
    return s.track ? `${t} · ${s.track}` : t;
  }

  private async loadRoad(seasonId: number) {
    const { data: stages } = await supabase
      .from('stages')
      .select('id, ord, title_ru, title_en, track, starts_at, status')
      .eq('season_id', seasonId)
      .order('ord');
    const ids = (stages ?? []).map((s) => s.id);
    const { data: wins } = ids.length
      ? await supabase.from('stage_results').select('stage_id, pilot:profiles(nickname)').in('stage_id', ids).eq('stage_place', 1)
      : { data: [] };
    const winner = new Map(((wins ?? []) as unknown as { stage_id: number; pilot: { nickname: string } | null }[]).map((w) => [w.stage_id, w.pilot?.nickname ?? null]));
    this.rawRoad.set((stages ?? []).map((s) => ({ ...s, winner: winner.get(s.id) ?? null })));
  }

  protected initials(name: string) {
    return name.split(/\s+/).map((w) => w[0]).join('').slice(0, 2).toUpperCase();
  }

  protected toDate(iso: string) {
    return new Date(iso);
  }
}

interface StageCard {
  id: number;
  title_ru: string;
  title_en: string | null;
  track: string | null;
  starts_at: string | null;
  status: string;
  twitch_channel: string | null;
}
interface Sponsor {
  id: number;
  name: string;
  logo_url: string | null;
  url: string | null;
  tier: 'general' | 'partner';
}
