import { Component, computed, DestroyRef, inject, input, OnInit, signal } from '@angular/core';
import { DomSanitizer } from '@angular/platform-browser';
import { TranslocoPipe } from '@jsverse/transloco';
import { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from '../auth';
import { qualStandings } from '../scoring/scoring';
import { Loader } from './loader';
import { PredictionPoll } from './prediction-poll';
import { loadPredictionCounts, PredictionCount, RUN_PICKS, runTarget } from '../predict';
import { mockStage } from '../overlay/mock';

interface Pilot {
  nickname: string;
  start_number: number | null;
  avatar_url?: string | null;
}
interface Battle {
  id: number;
  round: string;
  slot: number;
  leader_id: string | null;
  chaser_id: string | null;
  winner_id: string | null;
  status: string;
  omt_count: number;
}
const ORDER = ['r32', 'r16', 'qf', 'sf', 'third', 'final'];

// Прямой эфир этапа на главной: Twitch + живые данные (топ квалификации или текущая дуэль)
@Component({
  selector: 'app-live-stage',
  imports: [TranslocoPipe, Loader, PredictionPoll],
  template: `
    <div class="wrap">
      <div class="player">
        @if (playerUrl(); as url) {
          <iframe [src]="url" allowfullscreen title="Twitch"></iframe>
        } @else {
          <div class="noplayer subtle">{{ 'live.noStream' | transloco }}</div>
        }
      </div>

      <aside class="card side" [class.fill]="status() === 'qualifying' && !top().length">
        @if (!loaded()) {
          <app-loader [inline]="true" />
        } @else {
        @if (status() === 'battles') {
          <div class="head">
            <p class="eyebrow">{{ 'live.battle' | transloco }}</p>
            @if (current(); as b) {
              <span class="pill">{{ 'round.' + b.round | transloco }}</span>
              @if (b.omt_count) { <span class="pill omt">OMT {{ b.omt_count }}</span> }
            }
          </div>
          @if (current(); as b) {
            <div class="vs">
              @for (pid of [b.leader_id, b.chaser_id]; track $index) {
                <div class="pl">
                  <span class="role">{{ ($index === 0 ? 'live.leader' : 'live.chaser') | transloco }}</span>
                  @if (p(pid).avatar_url) { <img [src]="p(pid).avatar_url" alt="" width="44" height="44" loading="lazy" decoding="async" /> } @else { <span class="ava"></span> }
                  <span class="plate">#{{ p(pid).start_number ?? '—' }}</span>
                  <span class="nick" [title]="p(pid).nickname">{{ p(pid).nickname }}</span>
                </div>
              }
              <span class="x">VS</span>
            </div>
          } @else {
            <p class="subtle">{{ 'live.waiting' | transloco }}</p>
          }
          @if (current(); as b) {
            <app-prediction-poll [stageId]="stageId()" [battleId]="b.id" [leaderName]="p(b.leader_id).nickname" [chaserName]="p(b.chaser_id).nickname" [counts]="predCounts()" [demo]="!!demo()" [forcePick]="demo()?.pick ?? null" (voted)="loadCounts()" />
          }
          @if (upNext().length) {
            <div class="block">
              <p class="lbl">{{ 'live.next' | transloco }}</p>
              @for (b of upNext(); track b.round + b.slot) {
                <p class="row"><span class="mono n">#{{ p(b.leader_id).start_number ?? '—' }}</span> {{ p(b.leader_id).nickname }} <span class="subtle">vs</span> <span class="mono n">#{{ p(b.chaser_id).start_number ?? '—' }}</span> {{ p(b.chaser_id).nickname }}</p>
              }
            </div>
          }
          @if (last(); as l) {
            <div class="block last">
              <p class="lbl">{{ 'live.lastWin' | transloco }} · {{ 'round.' + l.round | transloco }}</p>
              <p class="row"><b class="win">{{ l.winner }}</b>&nbsp;<span class="subtle">{{ 'live.beat' | transloco }}</span> {{ l.loser }}</p>
            </div>
          }
        } @else {
          @if (runT(); as t) {
            <div class="poll-top">
              <app-prediction-poll [stageId]="stageId()" [pilotId]="t.profileId" [attempt]="t.attempt" [pilotName]="p(t.profileId).nickname" [counts]="predCounts()" [demo]="!!demo()" [forcePick]="demo()?.pick ?? null" (voted)="loadCounts()" />
            </div>
          }
          <p class="eyebrow">{{ 'live.qual' | transloco }}</p>
          <ol class="top">
            @for (r of top(); track r.id) {
              <li class="rise-row">
                <span class="mono pl-place">{{ r.place }}</span>
                <span class="mono n">{{ p(r.id).start_number ?? '—' }}</span>
                <span class="nick">{{ p(r.id).nickname }}</span>
                <span class="mono score">{{ r.best }}</span>
              </li>
            } @empty {
              <!-- пока никто не проехал: понятная заглушка + «скелет» будущей таблицы -->
              <li class="empty">
                <span class="pulse" aria-hidden="true"></span>
                <span><b>{{ 'live.noScores' | transloco }}</b><small>{{ 'live.noScoresHint' | transloco }}</small></span>
              </li>
              @for (i of [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]; track i) {
                <li class="ghost" aria-hidden="true"><span class="mono pl-place">{{ i }}</span><span class="bar" [style.width.%]="84 - i * 7" [style.animation-delay.ms]="i * 120"></span></li>
              }
            }
          </ol>
        }
        }
      </aside>
    </div>
  `,
  styles: `
    .wrap { display: grid; gap: 16px; grid-template-columns: 1fr 340px; align-items: stretch; }
    @media (max-width: 900px) { .wrap { grid-template-columns: 1fr; } }
    .player { aspect-ratio: 16 / 9; border-radius: var(--r-lg); overflow: hidden; border: 1px solid var(--hairline-strong); background: var(--surface-1); }
    iframe { width: 100%; height: 100%; border: 0; display: block; }
    .noplayer { height: 100%; display: grid; place-items: center; }
    .side { display: flex; flex-direction: column; gap: 16px; padding: 20px; }
    .eyebrow { margin: 0; margin-right: auto; }
    .head { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
    .pill { padding: 3px 10px; border-radius: var(--r-pill); border: 1px solid rgba(var(--accent-rgb), 0.4); color: var(--primary); font-size: 11px; font-weight: 600; letter-spacing: 1px; text-transform: uppercase; }
    .pill.omt { border-color: rgba(255, 92, 92, 0.5); color: var(--error); }
    .vs { position: relative; display: grid; grid-template-columns: 1fr 1fr; gap: 10px; text-align: center; }
    .pl { display: grid; gap: 6px; justify-items: center; min-width: 0; padding: 14px 8px; border-radius: var(--r-md); background: var(--surface-2); border: 1px solid var(--hairline); }
    .pl:first-child { border-color: rgba(var(--accent-rgb), 0.35); }
    .role { font-size: 10px; letter-spacing: 1.5px; text-transform: uppercase; color: var(--ink-subtle); }
    .pl img, .ava { width: 44px; height: 44px; border-radius: 50%; background: var(--surface-1); box-shadow: 0 0 0 2px var(--hairline-strong); }
    .pl:first-child img { box-shadow: 0 0 0 2px var(--primary); }
    .plate { font: 400 26px/1 'Russo One', var(--font); color: var(--primary); text-shadow: 0 0 18px var(--primary-glow); }
    .nick { font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 100%; }
    .x {
      position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%);
      display: grid; place-items: center; width: 34px; height: 34px; border-radius: 50%;
      background: var(--canvas); border: 1px solid var(--primary); color: var(--primary);
      font: 400 12px 'Russo One', var(--font); box-shadow: 0 0 16px var(--primary-glow);
    }
    .block { display: grid; gap: 6px; padding-top: 14px; border-top: 1px solid var(--hairline); }
    .block p { margin: 0; }
    .last { margin-top: auto; }
    .lbl { font-size: 11px; letter-spacing: 1.5px; text-transform: uppercase; color: var(--ink-subtle); }
    .row { font-size: 14px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .win { color: var(--primary); }
    .top { list-style: none; margin: 0; padding: 0; display: grid; gap: 4px; }
    .top li { display: grid; grid-template-columns: 24px 36px 1fr auto; gap: 8px; align-items: center; padding: 8px 10px; border-radius: var(--r-sm); background: var(--surface-2); font-size: 14px; }
    .top li:first-child { box-shadow: inset 3px 0 0 var(--primary); }
    .pl-place { color: var(--ink-subtle); }
    .n { color: var(--primary); }
    .score { color: var(--primary); font-weight: 500; }
    .rise-row { animation: rise 500ms var(--ease-out) both; }
    .top li.empty {
      display: flex; gap: 14px; padding: 14px 16px; margin-bottom: 4px; box-shadow: none;
      border: 1px dashed rgba(var(--accent-rgb), 0.35); background: rgba(var(--accent-rgb), 0.06);
    }
    .empty b { display: block; font-size: 14px; font-weight: 600; }
    .empty small { display: block; margin-top: 2px; font-size: 12px; color: var(--ink-subtle); }
    .pulse { position: relative; flex: none; width: 10px; height: 10px; border-radius: 50%; background: var(--primary); }
    .pulse::after { content: ''; position: absolute; inset: 0; border-radius: 50%; background: var(--primary); animation: ring-out 1.8s ease-out infinite; }
    @keyframes ring-out { from { transform: scale(1); opacity: 0.6; } to { transform: scale(3); opacity: 0; } }
    /* пустая таблица — колонка ровно по высоте трансляции, лишние строки-заглушки обрезаются */
    @media (min-width: 901px) {
      .side.fill { contain: size; overflow: hidden; }
      /* колонка с переносом: строка, которая не влезла целиком, уходит во второй (скрытый) столбец */
      .side.fill .top { flex: 1; min-height: 0; overflow: hidden; display: flex; flex-flow: column wrap; align-content: flex-start; row-gap: 4px; column-gap: 100%; }
      .side.fill .top li { width: 100%; flex: none; }
    }
    .top li.ghost { grid-template-columns: 24px 1fr; box-shadow: none; opacity: 0.55; }
    /* строки-«скелеты» на весь блок (Топ-8), полоски укорачиваются сверху вниз */
    .ghost .bar { height: 8px; border-radius: 4px; background: color-mix(in oklab, var(--ink), transparent 85%); animation: ghost 1.6s ease-in-out infinite; }
    @keyframes ghost { 50% { opacity: 0.35; } }
    /* в квалификации прогноз — над таблицей: черта снизу, а не сверху */
    .poll-top { margin-bottom: 20px; }
    .poll-top ::ng-deep .poll { margin-top: 0; padding: 0 0 16px; border-top: 0; border-bottom: 1px solid var(--hairline); }
    @media (prefers-reduced-motion: reduce) { .pulse::after, .ghost .bar { animation: none; } }
  `,
})
export class LiveStage implements OnInit {
  readonly stageId = input.required<number>();
  readonly status = input.required<string>();
  readonly channel = input<string | null>(null);
  /** витрина (UI kit): вымышленный этап без базы; pick — показать «уже проголосовал» */
  readonly demo = input<{ pick?: string } | null>(null);

  private readonly pilots = signal(new Map<string, Pilot>());
  protected readonly loaded = signal(false);
  private readonly regs = signal<{ profile_id: string; queue_order: number | null }[]>([]);
  private readonly runs = signal<{ profile_id: string; attempt: number; total: number }[]>([]);
  private readonly battles = signal<Battle[]>([]);
  /** итоги прогнозов зрителей этапа */
  protected readonly predCounts = signal<PredictionCount[]>([]);
  /** за кого голосуем в квалификации: пилот на трассе и его зачётная попытка */
  protected readonly runT = computed(() => (this.status() === 'qualifying' ? runTarget(this.regs(), this.runs()) : null));
  private countsTimer?: ReturnType<typeof setTimeout>;
  private readonly sanitizer = inject(DomSanitizer);
  private sub?: RealtimeChannel;

  protected readonly playerUrl = computed(() => {
    // в настройках могут вписать и имя канала, и ссылку twitch.tv/имя — плееру нужно только имя
    const ch = this.channel()?.trim().replace(/^.*twitch\.tv\//i, '').split(/[/?#]/)[0];
    if (!ch) return null;
    // Twitch требует parent = домен сайта
    const url = `https://player.twitch.tv/?channel=${encodeURIComponent(ch)}&parent=${location.hostname}&muted=true`;
    return this.sanitizer.bypassSecurityTrustResourceUrl(url);
  });
  protected readonly top = computed(() =>
    qualStandings(
      this.regs().map((r) => ({ id: r.profile_id, queueOrder: r.queue_order ?? 1e9, runs: this.runs().filter((x) => x.profile_id === r.profile_id) })),
    ).slice(0, 8),
  );
  private readonly sorted = computed(() => [...this.battles()].sort((a, b) => ORDER.indexOf(a.round) - ORDER.indexOf(b.round) || a.slot - b.slot));
  protected readonly current = computed(() => this.sorted().find((b) => b.status !== 'done' && b.leader_id && b.chaser_id) ?? null);
  protected readonly upNext = computed(() => {
    const cur = this.current();
    return this.sorted().filter((b) => b !== cur && b.status !== 'done' && b.leader_id && b.chaser_id).slice(0, 3);
  });
  protected readonly last = computed(() => {
    const b = this.sorted().filter((x) => x.status === 'done' && x.winner_id && x.leader_id && x.chaser_id).at(-1);
    if (!b) return null;
    const loser = b.winner_id === b.leader_id ? b.chaser_id : b.leader_id;
    return { round: b.round, winner: this.p(b.winner_id).nickname, loser: this.p(loser).nickname };
  });

  constructor() {
    inject(DestroyRef).onDestroy(() => {
      if (this.sub) supabase.removeChannel(this.sub);
      clearTimeout(this.countsTimer);
    });
  }

  async ngOnInit() {
    if (this.demo()) return this.showDemo();
    await this.load();
    const f = `stage_id=eq.${this.stageId()}`;
    this.sub = supabase
      .channel(`live-${this.stageId()}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'qual_runs', filter: f }, () => this.load())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'battles', filter: f }, () => this.load())
      // голоса идут пачками — пересчитываем не чаще раза в 0.7 с
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'predictions', filter: f }, () => {
        clearTimeout(this.countsTimer);
        this.countsTimer = setTimeout(() => this.loadCounts(), 700);
      })
      .subscribe();
  }

  private async load() {
    const id = this.stageId();
    const [regs, runs, battles] = await Promise.all([
      supabase.from('registrations').select('profile_id, queue_order, profile:profiles(nickname, start_number, avatar_url)').eq('stage_id', id).eq('status', 'registered'),
      supabase.from('qual_runs').select('profile_id, attempt, total').eq('stage_id', id),
      supabase.from('battles').select('id, round, slot, leader_id, chaser_id, winner_id, status, omt_count').eq('stage_id', id),
    ]);
    const r = (regs.data ?? []) as unknown as { profile_id: string; queue_order: number | null; profile: Pilot | null }[];
    this.pilots.set(new Map(r.map((x) => [x.profile_id, x.profile ?? { nickname: '?', start_number: null }])));
    this.regs.set(r);
    this.runs.set(runs.data ?? []);
    this.battles.set(battles.data ?? []);
    await this.loadCounts();
    this.loaded.set(true);
  }

  /** витрина: вымышленный этап (как в тестовых данных плашек); в квале последний в очереди ещё на трассе */
  private showDemo() {
    const m = mockStage();
    const last = m.regs[m.regs.length - 1].profile_id;
    this.pilots.set(new Map([...m.pilots].map(([id, p]) => [id, { nickname: p.nickname, start_number: p.start_number, avatar_url: null }])));
    this.regs.set(m.regs);
    const runs = this.status() === 'qualifying' ? m.runs.filter((r) => r.profile_id !== last || r.attempt === 0) : m.runs;
    this.runs.set(runs);
    this.battles.set(m.battles as unknown as Battle[]);
    const d = this.current();
    this.predCounts.set(
      this.status() === 'qualifying'
        ? [3, 5, 10, 60, 15, 7].map((n, i) => ({ profile_id: last, attempt: 1, battle_id: null, pick: RUN_PICKS[i], n }))
        : d
          ? [
              { profile_id: null, attempt: null, battle_id: d.id, pick: 'leader', n: 62 },
              { profile_id: null, attempt: null, battle_id: d.id, pick: 'chaser', n: 41 },
            ]
          : [],
    );
    this.loaded.set(true);
  }

  async loadCounts() {
    if (this.demo()) return;
    if (this.status() !== 'qualifying' && this.status() !== 'battles') return;
    this.predCounts.set(await loadPredictionCounts(this.stageId()));
  }

  protected p(id: string | null): Pilot {
    return (id && this.pilots().get(id)) || { nickname: '—', start_number: null };
  }
}
