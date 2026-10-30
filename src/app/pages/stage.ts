import { DatePipe } from '@angular/common';
import { Component, computed, DestroyRef, inject, input, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from '../auth';
import { BracketTree, TreeBattle, TreePilot } from '../components/bracket-tree';
import { LiveStage } from '../components/live-stage';
import { Loader } from '../components/loader';
import { StageGroups } from '../components/stage-groups';
import { qualStandings, Round } from '../scoring/scoring';
import { pageTitle } from '../title';

interface Stage {
  id: number;
  ord: number;
  title_ru: string;
  title_en: string | null;
  description_ru: string | null;
  description_en: string | null;
  track: string | null;
  starts_at: string | null;
  battles_at?: string | null;
  status: string;
  twitch_channel: string | null;
  season: { title: string } | null;
  track_map_url?: string | null;
  zones?: { name: string; line: number; angle: number; style: number }[];
}
interface Run {
  profile_id: string;
  attempt: number;
  total: number;
  spin: boolean;
  fail?: string | null;
}
interface Result {
  profile_id: string;
  stage_place: number;
  qual_points: number;
  battle_points: number;
  total: number;
  team: { name: string } | null;
}
type Tab = 'results' | 'bracket' | 'qual';

// Страница этапа для зрителей: итоги, живая сетка, квалификация
@Component({
  selector: 'app-stage',
  imports: [RouterLink, TranslocoPipe, DatePipe, BracketTree, LiveStage, Loader, StageGroups],
  template: `
    @if (stage(); as s) {
      <section class="section container page-in">
        <a routerLink="/stages" class="back">← {{ 'nav.stages' | transloco }}</a>
        <p class="eyebrow">{{ s.season?.title }} · {{ 'road.stage' | transloco: { n: s.ord } }}</p>
        <h1 class="display-lg">{{ lang() === 'en' && s.title_en ? s.title_en : s.title_ru }}</h1>
        <p class="meta">
          <span class="badge" [class]="'st-' + s.status">{{ 'stage.status.' + s.status | transloco }}</span>
          @if (s.track) { <span>{{ s.track }}</span> }
          @if (s.starts_at) { <span class="mono">{{ 'stage.qualShort' | transloco }} {{ s.starts_at | date: 'dd.MM.yyyy · HH:mm' }}</span> }
          @if (s.battles_at) { <span class="mono">{{ 'stage.battlesShort' | transloco }} {{ s.battles_at | date: 'dd.MM.yyyy · HH:mm' }}</span> }
        </p>
        @if (description(); as d) { <p class="desc muted">{{ d }}</p> }

        <!-- трасса: карта от дизайнера + сколько баллов каждого критерия разыгрывается в зонах -->
        @if (s.track_map_url || s.zones?.length) {
          <section class="track">
            <h2 class="h2">{{ 'stage.track' | transloco }}</h2>
            @if (s.track_map_url) {
              <a class="map" [href]="s.track_map_url" target="_blank" rel="noopener">
                <img [src]="s.track_map_url" [alt]="'stage.trackMap' | transloco" loading="lazy" decoding="async" />
              </a>
            }
            @if (s.zones?.length) {
              <div class="zones-wrap card flush">
                <table class="zones">
                  <thead>
                    <tr>
                      <th></th>
                      @for (z of s.zones; track $index) { <th class="mono">{{ z.name }}</th> }
                      <th class="tot">{{ 'stage.zonesTotal' | transloco }}</th>
                    </tr>
                  </thead>
                  <tbody>
                    @for (c of crits; track c) {
                      <tr>
                        <th class="crit">{{ 'pilot.crit.' + c | transloco }}</th>
                        @for (z of s.zones; track $index) { <td class="mono">{{ z[c] }}</td> }
                        <td class="mono tot">{{ zoneTotal(s, c) }}</td>
                      </tr>
                    }
                  </tbody>
                </table>
              </div>
            }
          </section>
        }

        <!-- группы квалификации: до старта (когда штаб разбил по группам) и после квалы; во время квалы — в блоке эфира -->
        @if (!live() && s.status !== 'finished' && s.status !== 'draft') {
          <app-stage-groups class="groups" [stageId]="s.id" [status]="s.status" />
        }

        @if (live()) {
          <div class="live-wrap"><app-live-stage [stageId]="s.id" [status]="s.status" [channel]="s.twitch_channel || twitch()" /></div>
        }

        <div class="tabs" role="tablist">
          @for (t of tabs(); track t) {
            <button role="tab" [class.on]="tab() === t" [attr.aria-selected]="tab() === t" (click)="tab.set(t)">{{ 'stage.tab.' + t | transloco }}</button>
          }
        </div>

        @switch (tab()) {
          @case ('results') {
            <div class="table-wrap card flush">
              <table class="table">
                <thead><tr>
                  <th>#</th><th>{{ 'standings.pilot' | transloco }}</th><th>{{ 'standings.team' | transloco }}</th>
                  <th class="num">{{ 'stage.qualPts' | transloco }}</th><th class="num">{{ 'stage.battlePts' | transloco }}</th><th class="num">{{ 'home.points' | transloco }}</th>
                </tr></thead>
                <tbody>
                  @for (r of results(); track r.profile_id) {
                    <tr [class.podium]="r.stage_place <= 3">
                      <td class="mono place">{{ r.stage_place }}</td>
                      <td><span class="mono n">{{ p(r.profile_id).start_number ?? '' }}</span> {{ p(r.profile_id).nickname }}</td>
                      <td class="muted">{{ r.team?.name ?? '' }}</td>
                      <td class="num muted">{{ r.qual_points }}</td>
                      <td class="num muted">{{ r.battle_points }}</td>
                      <td class="num total">{{ r.total }}</td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          }
          @case ('bracket') {
            <div class="card"><app-bracket-tree [battles]="battles()" [pilots]="pilots()" [labels]="roundLabels()" /></div>
          }
          @case ('qual') {
            <div class="table-wrap card flush">
              <table class="table">
                <thead><tr>
                  <th>#</th><th>{{ 'standings.pilot' | transloco }}</th>
                  <th class="num">{{ 'stage.run' | transloco: { n: 1 } }}</th><th class="num">{{ 'stage.run' | transloco: { n: 2 } }}</th><th class="num">{{ 'stage.best' | transloco }}</th>
                </tr></thead>
                <tbody>
                  @for (q of qual(); track q.id) {
                    <tr [class.cut]="q.place === 32">
                      <td class="mono place">{{ q.place }}</td>
                      <td><span class="mono n">{{ p(q.id).start_number ?? '' }}</span> {{ p(q.id).nickname }}</td>
                      @for (a of [1, 2]; track a) {
                        @let r = runOf(q.id, a);
                        <td class="num muted">{{ r ? (r.spin ? ('stage.fail.' + (r.fail ?? 'spin') | transloco) : r.total) : '—' }}</td>
                      }
                      <td class="num total">{{ q.best }}</td>
                    </tr>
                  } @empty {
                    <tr><td colspan="5" class="subtle">{{ 'live.noScores' | transloco }}</td></tr>
                  }
                </tbody>
              </table>
            </div>
          }
        }
      </section>
    } @else if (missing()) {
      <section class="section container"><p class="subtle">{{ 'stage.notFound' | transloco }}</p></section>
    } @else {
      <app-loader />
    }
  `,
  styles: `
    .back { display: inline-block; margin-bottom: 24px; font-size: 14px; }
    h1 { margin: 12px 0 16px; }
    .meta { display: flex; flex-wrap: wrap; gap: 8px 16px; align-items: center; color: var(--ink-muted); margin: 0; }
    .desc { max-width: 720px; margin: 20px 0 0; white-space: pre-line; }
    .st-draft, .st-finished { background: var(--surface-3); color: var(--ink-muted); }
    .st-qualifying, .st-battles { background: rgba(255, 92, 92, 0.15); color: var(--error); }
    .live-wrap { margin-top: 40px; }
    .groups { margin-top: 40px; }
    /* трасса и зоны: таблица в духе макета — строки критериев, колонки зон, итог подсвечен */
    .track { margin-top: 40px; display: grid; gap: 16px; }
    .h2 { font-size: 22px; margin: 0; }
    .map { display: block; border-radius: var(--r-lg); overflow: hidden; border: 1px solid var(--hairline); background: var(--surface-1); }
    .map, .map:hover { background-size: 0 0; }
    .map img { display: block; width: 100%; height: auto; }
    .zones-wrap { overflow-x: auto; }
    .zones { width: 100%; border-collapse: separate; border-spacing: 0; text-align: center; }
    .zones th, .zones td { padding: 14px 12px; border-bottom: 1px solid var(--hairline); white-space: nowrap; }
    .zones tr:last-child td, .zones tr:last-child th { border-bottom: 0; }
    .zones thead th { font-size: 13px; font-weight: 600; color: var(--ink-muted); }
    .zones td { font-size: 16px; }
    .zones .crit { text-align: left; font-size: 14px; font-weight: 500; color: var(--ink); box-shadow: inset 2px 0 0 var(--primary); }
    /* на телефоне таблица листается вбок — названия критериев остаются на месте */
    .zones .crit, .zones thead th:first-child { position: sticky; left: 0; z-index: 1; background: var(--surface-1); }
    .zones .tot { background: rgba(var(--accent-rgb), 0.16); color: var(--primary); font-weight: 700; }
    .zones thead .tot { color: var(--ink); }
    .tabs { display: inline-flex; padding: 3px; margin: 40px 0 20px; border: 1px solid var(--hairline-strong); border-radius: var(--r-pill); background: var(--surface-1); }
    .tabs button {
      padding: 8px 18px; border: 0; border-radius: var(--r-pill); background: none; color: var(--ink-muted); font: 500 14px var(--font); cursor: pointer;
      transition: background-color var(--base), color var(--fast);
      &.on { background: var(--primary); color: var(--on-primary); }
    }
    .flush { padding: 0; }
    .place { color: var(--ink-subtle); width: 40px; }
    .podium .place { color: var(--primary); }
    .podium { background: rgba(var(--accent-rgb), 0.06); }
    .podium td:first-child { box-shadow: inset 3px 0 0 var(--primary); }
    .n { color: var(--primary); display: inline-block; min-width: 32px; }
    .total { color: var(--primary); font-weight: 600; }
    tr.cut td { border-bottom: 2px solid var(--primary); }
  `,
})
export class StagePage implements OnInit {
  readonly id = input.required<string>();
  protected readonly stage = signal<Stage | null>(null);
  protected readonly missing = signal(false);
  protected readonly twitch = signal<string | null>(null);
  protected readonly pilots = signal(new Map<string, TreePilot>());
  private readonly regs = signal<{ profile_id: string; queue_order: number | null }[]>([]);
  private readonly runs = signal<Run[]>([]);
  protected readonly battles = signal<TreeBattle[]>([]);
  protected readonly results = signal<Result[]>([]);
  protected readonly tab = signal<Tab>('qual');
  // порядок как у судей: траектория, угол, стиль
  protected readonly crits = ['line', 'angle', 'style'] as const;
  protected zoneTotal(s: Stage, c: 'line' | 'angle' | 'style') {
    return (s.zones ?? []).reduce((sum, z) => sum + (Number(z[c]) || 0), 0);
  }
  private readonly t = inject(TranslocoService);
  protected readonly lang = signal(this.t.getActiveLang());
  private sub?: RealtimeChannel;

  protected readonly live = computed(() => ['qualifying', 'battles'].includes(this.stage()?.status ?? ''));
  protected readonly description = computed(() => {
    const s = this.stage();
    return (this.lang() === 'en' && s?.description_en) || s?.description_ru || null;
  });
  protected readonly tabs = computed<Tab[]>(() => [
    ...(this.results().length ? (['results'] as Tab[]) : []),
    ...(this.battles().length ? (['bracket'] as Tab[]) : []),
    'qual',
  ]);
  protected readonly qual = computed(() =>
    qualStandings(this.regs().map((r) => ({ id: r.profile_id, queueOrder: r.queue_order ?? 1e9, runs: this.runs().filter((x) => x.profile_id === r.profile_id) }))),
  );
  protected readonly roundLabels = computed(() => {
    this.lang();
    const keys: Round[] = ['r32', 'r16', 'qf', 'sf', 'third', 'final'];
    return Object.fromEntries(keys.map((k) => [k, this.t.translate('round.' + k)])) as Record<Round, string>;
  });

  constructor() {
    this.t.langChanges$.subscribe((l) => this.lang.set(l));
    inject(DestroyRef).onDestroy(() => this.sub && supabase.removeChannel(this.sub));
  }

  async ngOnInit() {
    const id = Number(this.id());
    const [{ data: s }, settings] = await Promise.all([
      supabase.from('stages').select('id, ord, title_ru, title_en, description_ru, description_en, track, starts_at, battles_at, status, twitch_channel, track_map_url, zones, season:seasons(title)').eq('id', id).maybeSingle(),
      supabase.from('app_settings').select('twitch_channel').single(),
    ]);
    if (!s) return this.missing.set(true);
    this.twitch.set(settings.data?.twitch_channel ?? null);
    await this.load();
    // показываем этап, когда данные уже на месте — без мелькания «нет оценок»
    this.stage.set(s as unknown as Stage);
    pageTitle((s as unknown as Stage).title_ru);
    // по умолчанию — самое интересное: итоги, иначе сетка, иначе квалификация
    this.tab.set(this.tabs()[0]);
    if (this.live()) {
      const f = `stage_id=eq.${id}`;
      this.sub = supabase
        .channel(`stage-${id}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'qual_runs', filter: f }, () => this.loadRuns())
        .on('postgres_changes', { event: '*', schema: 'public', table: 'battles', filter: f }, () => this.loadBattles())
        .subscribe();
    }
  }

  private async load() {
    const id = Number(this.id());
    const [regs, runs, battles, results] = await Promise.all([
      supabase.from('registrations').select('profile_id, queue_order, profile:profiles(nickname, start_number)').eq('stage_id', id).eq('status', 'registered'),
      supabase.from('qual_runs').select('profile_id, attempt, total, spin, fail').eq('stage_id', id),
      supabase.from('battles').select('id, round, slot, leader_id, chaser_id, winner_id, omt_count, status, result').eq('stage_id', id),
      supabase.from('stage_results').select('profile_id, stage_place, qual_points, battle_points, total, team:teams(name), pilot:profiles(nickname, start_number)').eq('stage_id', id).order('stage_place'),
    ]);
    const r = (regs.data ?? []) as unknown as { profile_id: string; queue_order: number | null; profile: TreePilot | null }[];
    const res = (results.data ?? []) as unknown as (Result & { pilot: TreePilot | null })[];
    // пилоты из регистраций и итогов (итоги могут остаться после снятия регистрации)
    this.pilots.set(new Map([...res.map((x) => [x.profile_id, x.pilot] as const), ...r.map((x) => [x.profile_id, x.profile] as const)].filter((e): e is [string, TreePilot] => !!e[1])));
    this.regs.set(r);
    this.runs.set(runs.data ?? []);
    this.battles.set((battles.data ?? []) as TreeBattle[]);
    this.results.set(res);
  }

  private async loadRuns() {
    const { data } = await supabase.from('qual_runs').select('profile_id, attempt, total, spin, fail').eq('stage_id', Number(this.id()));
    this.runs.set(data ?? []);
  }

  private async loadBattles() {
    const { data } = await supabase.from('battles').select('id, round, slot, leader_id, chaser_id, winner_id, omt_count, status, result').eq('stage_id', Number(this.id()));
    this.battles.set((data ?? []) as TreeBattle[]);
  }

  protected p(id: string): TreePilot {
    return this.pilots().get(id) ?? { nickname: '?', start_number: null };
  }

  protected runOf(pid: string, attempt: number) {
    return this.runs().find((r) => r.profile_id === pid && r.attempt === attempt);
  }
}
