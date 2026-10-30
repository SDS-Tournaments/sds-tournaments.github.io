import { Component, computed, effect, input, OnDestroy, OnInit, signal } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { RouterLink } from '@angular/router';
import { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from '../auth';
import { loadSkillRuns } from '../data/skills';
import { loadStandings } from '../data/standings';
import { countsFor, loadPredictionCounts, PredictionCount, RUN_PICK_LABEL, RUN_PICKS } from '../predict';
import { bracketSize, Fail, qualStandings, Round, SkillRun } from '../scoring/scoring';
import { STAGE_STATUS } from '../admin/labels';
import { Chance, duelChances, DuelSide, qualChances, qualTargets } from './chances';
import { ACH, Dossier, DossierPilot, DossierResult } from './dossier';
import { GroupMeta, groupLabel } from '../groups';

interface Stage {
  id: number;
  title_ru: string;
  status: string;
  season_id: number;
  ord: number;
  warmup: boolean;
  bracket_size: 'auto' | '32' | '16' | '8';
  group_meta: GroupMeta[];
}
interface Reg {
  profile_id: string;
  group_no: number | null;
  queue_order: number | null;
  status: string;
  profile: DossierPilot;
}
interface Run {
  profile_id: string;
  attempt: number;
  angle: number | null;
  style: number | null;
  line: number | null;
  spin: boolean;
  fail: Fail | null;
  total: number;
}
interface Battle {
  id: number;
  stage_id?: number;
  round: Round;
  slot: number;
  leader_id: string | null;
  chaser_id: string | null;
  winner_id: string | null;
  omt_count: number;
  status: string;
  result: string | null;
}

const ROUND_LABEL: Record<Round, string> = { r32: 'Top 32', r16: 'Top 16', qf: 'Top 8', sf: 'Полуфинал', third: 'За 3-е место', final: 'Финал' };
const ORDER: Round[] = ['r32', 'r16', 'qf', 'sf', 'third', 'final'];
const FAIL_LABEL: Record<Fail, string> = { spin: 'Спин', crash: 'Авария', straight: 'Выпрямление', offtrack: 'Вылет' };

// Пульт комментатора: всё о пилоте на трассе — досье (описание от самого пилота), карьера, что ему нужно, шансы на ачивки,
// прогноз зрителей; в парных — оба пилота, история встреч. Только чтение; следит за пультом судьи (judge_live). Только RU.
@Component({
  selector: 'app-commentator',
  imports: [RouterLink, NgTemplateOutlet, Dossier],
  template: `
    @if (stage(); as st) {
      <header class="bar">
        <a [routerLink]="['/admin/stages', st.id]" class="back">← Этап</a>
        <h1>{{ st.title_ru }} <span class="subtle">· пульт комментатора</span></h1>
        <div class="modes" role="tablist">
          <button role="tab" [class.on]="mode() === 'qual'" [attr.aria-selected]="mode() === 'qual'" (click)="mode.set('qual')">Квалификация</button>
          <button role="tab" [class.on]="mode() === 'battles'" [attr.aria-selected]="mode() === 'battles'" (click)="mode.set('battles')">Парные</button>
        </div>
        <span class="badge">{{ statusLabel[st.status] }}</span>
        @if (follow()) { <span class="live"><i></i>следит за трассой</span> }
        @else { <button class="btn btn-secondary" (click)="follow.set(true)">↺ Вернуться к трассе</button> }
      </header>

      @if (mode() === 'qual') {
        <div class="grid">
          <aside class="card queue">
            <h2 class="h">Очередь <span class="mono subtle">{{ doneCount() }}/{{ queue().length }}</span></h2>
            <ol>
              @for (r of queue(); track r.profile_id; let i = $index) {
                @if (i === 0 || r.group_no !== queue()[i - 1].group_no) { <li class="ghead">{{ gl(r.group_no) }}</li> }
                <li>
                  <button class="qrow" [class.track]="r.profile_id === onTrack()?.profile_id" [class.cur]="r.profile_id === focusId()" [class.done]="isDone(r.profile_id)" (click)="pick(r.profile_id)">
                    <span class="mono n">{{ r.profile.start_number ?? '—' }}</span>
                    <span class="nick">{{ r.profile.nickname }}</span>
                    <span class="mono subtle">{{ bestOf(r.profile_id) ?? '' }}</span>
                  </button>
                </li>
              }
            </ol>
          </aside>

          <section class="card main">
            @if (focus(); as f) {
              <div class="now">
                @if (f.profile_id === onTrack()?.profile_id) { <span class="pill live-pill"><i></i>На трассе · {{ attemptLabel() }}</span> }
                @else if (isDone(f.profile_id)) { <span class="pill">Уже проехал</span> }
                @else { <span class="pill">Ещё не ехал · через {{ waitOf(f.profile_id) }}</span> }
                @if (placeOf(f.profile_id); as pl) { <span class="pill hi">Сейчас {{ pl }}-й в квале</span> }
              </div>

              <div class="cols">
              <app-dossier [pilot]="f.profile" [team]="teamOf(f.profile_id)" [season]="seasonOf(f.profile_id)" [history]="historyOf(f.profile_id)"
                [achCounts]="achOf(f.profile_id)" [runs]="skillRuns().get(f.profile_id) ?? []" />
              <div class="live-col">
              <div class="runs">
                @for (a of [1, 2]; track a) {
                  @let r = runOf(f.profile_id, a);
                  <div class="run" [class.zero]="r?.spin">
                    <span class="lbl">Попытка {{ a }}</span>
                    @if (r) {
                      <b class="mono big">{{ r.spin ? failLabel(r) : r.total }}</b>
                      @if (!r.spin) { <span class="mono subtle">Т {{ r.line }} · У {{ r.angle }} · С {{ r.style }}</span> }
                    } @else { <b class="mono big subtle">—</b> }
                  </div>
                }
                <div class="run target">
                  <span class="lbl">Чтобы…</span>
                  @if (targets(); as t) {
                    <p>стать первым — <b class="mono">{{ t.leader === null ? 'любой результат' : 'больше ' + t.leader }}</b></p>
                    <p>попасть в Top {{ cut() }} — <b class="mono">{{ t.cutLine === null ? 'любой результат' : 'больше ' + t.cutLine }}</b></p>
                  }
                </div>
              </div>

              @if (votes(); as v) {
                <div class="votes">
                  <span class="lbl">Зрители думают ({{ v.total }})</span>
                  <div class="vbars">
                    @for (o of v.options; track o.k) {
                      <div class="vb" [class.lead]="o.lead"><span class="mono">{{ o.label }}</span><span class="bar"><i [style.width.%]="o.pct"></i></span><span class="mono">{{ o.pct }}%</span></div>
                    }
                  </div>
                </div>
              }

              @if (qChances().length) {
                <div class="chances">
                  <p class="lbl">Может получить на этом этапе</p>
                  @for (c of qChances(); track c.code) { <ng-container *ngTemplateOutlet="chance; context: { $implicit: c, id: f.profile_id }" /> }
                </div>
              }
              </div>
              </div>
            } @else {
              <p class="subtle">Квалификация завершена — все пилоты проехали.</p>
            }
          </section>

          <aside class="side">
            <section class="card">
              <h2 class="h">Далее</h2>
              @for (r of upNext(); track r.profile_id) {
                <button class="next" (click)="pick(r.profile_id)">
                  <span class="mono n">{{ r.profile.start_number ?? '—' }}</span>
                  <span class="nick">{{ r.profile.nickname }}</span>
                  <span class="subtle small">{{ teamOf(r.profile_id) ?? '' }} @if (seasonOf(r.profile_id); as s) { · #{{ s.place }} в сезоне }</span>
                </button>
              } @empty { <p class="subtle">—</p> }
            </section>
            <section class="card">
              <h2 class="h">Квалификация</h2>
              <table class="table">
                <tbody>
                  @for (s of standings(); track s.id) {
                    <tr [class.me]="s.id === focusId()" [class.cut]="s.place === cut()" (click)="pick(s.id)">
                      <td class="mono">{{ s.place }}</td><td>{{ nick(s.id) }}</td><td class="num mono">{{ s.best }}</td>
                    </tr>
                  } @empty { <tr><td class="subtle">Пока нет оценок</td></tr> }
                </tbody>
              </table>
            </section>
          </aside>
        </div>
      } @else {
        @if (duel(); as b) {
          <section class="card duel-head">
            <p class="eyebrow">{{ roundLabel[b.round] }} · пара {{ b.slot + 1 }} @if (b.omt_count) { <span class="omt mono">OMT {{ b.omt_count }}/2</span> }
              @if (b.status === 'done') { · <b class="win">победил {{ nick(b.winner_id!) }}</b> }</p>
            @if (h2h(); as h) {
              <p class="h2h">История встреч: @if (h.total) { <b class="mono">{{ nick(b.leader_id!) }} {{ h.leader }} : {{ h.chaser }} {{ nick(b.chaser_id!) }}</b> <span class="subtle">({{ h.total }} дуэл.)</span> } @else { <span class="subtle">раньше не встречались</span> }</p>
            }
            @if (duelVotes(); as v) {
              <div class="dv"><span class="mono">{{ v.leader }}%</span><span class="split"><i [style.width.%]="v.leader"></i></span><span class="mono">{{ v.chaser }}%</span><span class="subtle small">зрители ({{ v.total }})</span></div>
            }
          </section>
          <div class="pair">
            @for (side of sides(b); track side.role) {
              <section class="card">
                <p class="role">{{ side.role === 'leader' ? 'Лидер в 1-м заезде' : 'Чейзер в 1-м заезде' }}</p>
                <div class="facts">
                  <span class="pill hi">Квала: {{ placeOf(side.id) ?? '—' }}-й · {{ bestOf(side.id) ?? '—' }}</span>
                  @for (w of pathOf(side.id, b); track $index) { <span class="pill">{{ w }}</span> }
                </div>
                <div class="chances">
                  <p class="lbl">Ачивки в этой дуэли</p>
                  @for (c of dChances()[side.role]; track c.code) { <ng-container *ngTemplateOutlet="chance; context: { $implicit: c, id: side.id }" /> }
                  @empty { <p class="subtle small none">Особых ачивок эта дуэль не решает</p> }
                </div>
                @if (reg(side.id); as r) {
                  <app-dossier [pilot]="r.profile" [team]="teamOf(side.id)" [season]="seasonOf(side.id)" [history]="historyOf(side.id)"
                    [achCounts]="achOf(side.id)" [runs]="skillRuns().get(side.id) ?? []" [compact]="true" />
                }
              </section>
            }
          </div>
          <section class="card">
            <h2 class="h">Дуэли этапа</h2>
            <div class="blist">
              @for (x of sortedBattles(); track x.id) {
                @if (x.leader_id && x.chaser_id) {
                  <button class="bitem" [class.cur]="x.id === b.id" [class.done]="x.status === 'done'" (click)="pickDuel(x.id)">
                    <span class="subtle small">{{ roundLabel[x.round] }}</span>
                    <span [class.win]="x.winner_id === x.leader_id">{{ nick(x.leader_id) }}</span>
                    <span class="subtle">vs</span>
                    <span [class.win]="x.winner_id === x.chaser_id">{{ nick(x.chaser_id) }}</span>
                  </button>
                }
              }
            </div>
          </section>
        } @else {
          <section class="card"><p class="subtle">Сетка ещё не построена — откройте вкладку «Квалификация».</p></section>
        }
      }
    }

    <ng-template #chance let-c let-id="id">
      <div class="ch" [class.warn]="c.warn" [title]="ach[c.code]?.desc ?? ''">
        <span class="ic">{{ ach[c.code]?.icon }}</span>
        <span><b>{{ ach[c.code]?.name }}</b> @if (had(c.code, id); as n) { <span class="subtle small">· уже ×{{ n }}</span> }<br /><span class="muted small">{{ c.when }}</span></span>
      </div>
    </ng-template>
  `,
  styles: `
    :host { display: block; max-width: 1760px; margin: 0 auto; padding: 24px var(--gutter) 64px; }
    .bar { display: flex; flex-wrap: wrap; align-items: center; gap: 12px 16px; margin-bottom: 16px; }
    .back { font-size: 14px; }
    h1 { font-size: 22px; flex: 1; margin: 0; }
    .modes { display: flex; padding: 3px; border: 1px solid var(--hairline-strong); border-radius: var(--r-pill); background: var(--surface-1); }
    .modes button { padding: 8px 16px; border: 0; border-radius: var(--r-pill); background: none; color: var(--ink-muted); font: 500 14px var(--font); cursor: pointer; &.on { background: var(--primary); color: var(--on-primary); } }
    .live, .live-pill { display: inline-flex; align-items: center; gap: 6px; color: var(--primary); }
    .live { font-size: 12px; text-transform: uppercase; letter-spacing: 1px; }
    .live i, .live-pill i { width: 8px; height: 8px; border-radius: 50%; background: var(--primary); animation: pulse 2s ease-out infinite; }
    @keyframes pulse { from { box-shadow: 0 0 0 0 var(--primary-glow); } to { box-shadow: 0 0 0 8px transparent; } }
    .card { padding: 20px; }
    .h { font-size: 16px; margin: 0 0 12px; display: flex; justify-content: space-between; }
    .lbl { margin: 0 0 6px; font-size: 11px; letter-spacing: 1.5px; text-transform: uppercase; color: var(--ink-subtle); }
    .small { font-size: 12px; }

    .grid { display: grid; grid-template-columns: 240px minmax(0, 1fr) 300px; gap: 16px; align-items: start; }
    @media (max-width: 1250px) { .grid { grid-template-columns: 220px minmax(0, 1fr); } .side { grid-column: 1 / -1; grid-template-columns: 1fr 1fr; } }
    @media (max-width: 800px) { .grid { grid-template-columns: 1fr; } .side { grid-template-columns: 1fr; } }
    .queue ol { list-style: none; margin: 0; padding: 0; display: grid; gap: 2px; max-height: 75vh; overflow-y: auto; }
    .ghead { font-size: 11px; letter-spacing: 1px; text-transform: uppercase; color: var(--ink-subtle); padding: 10px 4px 4px; }
    .qrow, .next {
      width: 100%; display: grid; grid-template-columns: 36px 1fr auto; gap: 8px; align-items: center; padding: 7px 8px;
      border: 1px solid transparent; border-radius: var(--r-sm); background: none; color: var(--ink); font: 14px var(--font); text-align: left; cursor: pointer;
      &:hover { background: var(--surface-2); }
    }
    .qrow.done { color: var(--ink-subtle); }
    .qrow.track { box-shadow: inset 3px 0 0 var(--primary); }
    .qrow.cur { border-color: var(--primary); background: var(--primary-soft); }
    .next { grid-template-columns: 36px 1fr; .small { grid-column: 2; } }
    .n { color: var(--primary); }
    .nick { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

    .main { display: grid; gap: 18px; }
    .now, .facts { display: flex; flex-wrap: wrap; gap: 8px; }
    .pill { padding: 5px 12px; border-radius: var(--r-pill); background: var(--surface-2); font-size: 13px; }
    .pill.hi { background: var(--primary-soft); color: var(--primary); }
    /* слева — кто едет (досье), справа — что происходит на этапе */
    .cols { display: grid; grid-template-columns: minmax(0, 1.1fr) minmax(0, 1fr); gap: 20px; align-items: start; }
    @media (max-width: 1400px) { .cols { grid-template-columns: 1fr; } }
    .live-col { display: grid; gap: 18px; align-content: start; }
    .runs { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
    .target { grid-column: 1 / -1; }
    .run { display: grid; gap: 4px; align-content: start; padding: 12px 14px; border-radius: var(--r-md); background: var(--surface-2); }
    .run .lbl { margin: 0; }
    .big { font-size: 34px; line-height: 1.1; color: var(--primary); }
    .run.zero .big { color: var(--error); font-size: 22px; }
    .target p { margin: 0; font-size: 14px; b { color: var(--primary); } }
    .votes .vbars { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 6px 16px; }
    .vb { display: grid; grid-template-columns: 40px 1fr 40px; gap: 8px; align-items: center; font-size: 13px; }
    .vb.lead { color: var(--primary); }
    .bar, .split { height: 6px; border-radius: 3px; background: var(--surface-3); overflow: hidden; }
    .bar i, .split i { display: block; height: 100%; background: var(--primary); }
    .chances { display: grid; gap: 8px; }
    .ch { display: flex; gap: 12px; align-items: flex-start; padding: 10px 12px; border-radius: var(--r-sm); background: var(--surface-2); border-left: 3px solid var(--primary); cursor: help; }
    .ch.warn { border-left-color: var(--warning); }
    .ch .ic { font-size: 22px; line-height: 1; }
    .none { margin: 0; }

    .side { display: grid; gap: 16px; }
    .side .table td { padding: 6px 8px; cursor: pointer; }
    tr.me td { background: var(--primary-soft); }
    tr.cut td { border-bottom: 2px solid var(--primary); }

    .duel-head { display: grid; gap: 10px; margin-bottom: 16px; }
    .duel-head p { margin: 0; }
    .omt { padding: 2px 8px; border-radius: var(--r-pill); background: rgba(245, 185, 66, 0.15); color: var(--warning); font-size: 11px; }
    .win { color: var(--primary); }
    .h2h { font-size: 15px; }
    .dv { display: grid; grid-template-columns: 48px 1fr 48px auto; gap: 10px; align-items: center; }
    .split { height: 10px; background: var(--ink-tertiary); }
    .pair { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 16px; }
    @media (max-width: 1000px) { .pair { grid-template-columns: 1fr; } }
    .pair > .card { display: grid; gap: 14px; align-content: start; }
    .role { margin: 0; font-size: 11px; letter-spacing: 1.5px; text-transform: uppercase; color: var(--ink-subtle); }
    .blist { display: flex; flex-wrap: wrap; gap: 6px; }
    .bitem { display: flex; gap: 6px; align-items: center; padding: 6px 12px; border: 1px solid var(--hairline-strong); border-radius: var(--r-pill); background: var(--surface-1); color: var(--ink-muted); font: 13px var(--font); cursor: pointer;
      &.cur { border-color: var(--primary); color: var(--ink); } &.done { opacity: 0.7; } }
  `,
})
export class Commentator implements OnInit, OnDestroy {
  readonly id = input.required<string>();
  protected readonly stage = signal<Stage | null>(null);
  protected readonly regs = signal<Reg[]>([]);
  protected readonly runs = signal<Run[]>([]);
  protected readonly battles = signal<Battle[]>([]);
  private readonly target = signal<string | null>(null);
  private readonly teams = signal(new Map<string, string>());
  private readonly results = signal(new Map<string, DossierResult[]>());
  private readonly achs = signal(new Map<string, Map<string, number>>());
  private readonly season = signal(new Map<string, { place: number; points: number }>());
  private readonly prevWinners = signal<string[]>([]);
  private readonly prevDuels = signal<{ winner: string; loser: string }[]>([]);
  private readonly preds = signal<PredictionCount[]>([]);
  protected readonly skillRuns = signal(new Map<string, SkillRun[]>());
  protected readonly h2h = signal<{ leader: number; chaser: number; total: number } | null>(null);

  protected readonly mode = signal<'qual' | 'battles'>('qual');
  /** следить за трассой (пульт судьи) или смотреть выбранного вручную */
  protected readonly follow = signal(true);
  private readonly picked = signal<string | null>(null);
  private readonly pickedDuel = signal<number | null>(null);
  protected readonly statusLabel = STAGE_STATUS;
  protected readonly roundLabel = ROUND_LABEL;
  protected readonly ach = ACH;
  private channel?: RealtimeChannel;

  protected readonly queue = computed(() =>
    this.regs()
      .filter((r) => r.status === 'registered')
      .sort((a, b) => (a.queue_order ?? 1e9) - (b.queue_order ?? 1e9)),
  );
  private readonly regMap = computed(() => new Map(this.regs().map((r) => [r.profile_id, r])));
  private readonly runMap = computed(() => {
    const m = new Map<string, Run[]>();
    for (const r of this.runs()) m.set(r.profile_id, [...(m.get(r.profile_id) ?? []), r]);
    return m;
  });
  protected readonly standings = computed(() =>
    qualStandings(this.queue().map((r) => ({ id: r.profile_id, queueOrder: r.queue_order ?? 1e9, runs: this.runMap().get(r.profile_id) ?? [] }))),
  );
  private readonly qualMap = computed(() => new Map(this.standings().map((s) => [s.id, s])));
  protected readonly cut = computed(() => {
    const st = this.stage();
    return st ? bracketSize(this.queue().length, st.bracket_size) : 32;
  });
  protected readonly doneCount = computed(() => this.queue().filter((r) => this.isDone(r.profile_id)).length);

  /** на трассе: выбор судьи (judge_live), иначе первый не проехавший */
  protected readonly onTrack = computed(() => {
    const t = this.target();
    const pid = t?.startsWith('q:') ? t.split(':')[1] : null;
    return (pid && this.queue().find((r) => r.profile_id === pid)) || this.queue().find((r) => !this.isDone(r.profile_id)) || null;
  });
  protected readonly focusId = computed(() => (this.follow() ? this.onTrack()?.profile_id : this.picked()) ?? null);
  protected readonly focus = computed(() => {
    const id = this.focusId();
    return id ? (this.regMap().get(id) ?? null) : null;
  });
  /** какую попытку едет пилот на трассе */
  private readonly trackAttempt = computed(() => {
    const c = this.onTrack();
    if (!c) return null;
    const t = this.target()?.split(':');
    if (t?.[0] === 'q' && t[1] === c.profile_id && t[2]) return Number(t[2]);
    const done = new Set((this.runMap().get(c.profile_id) ?? []).map((r) => r.attempt));
    return (this.stage()?.warmup === false ? [1, 2] : [0, 1, 2]).find((a) => !done.has(a)) ?? 2;
  });
  protected readonly attemptLabel = computed(() => {
    const a = this.trackAttempt();
    return a === 0 ? 'прогрев' : `попытка ${a}`;
  });
  protected readonly upNext = computed(() => {
    const q = this.queue();
    const i = q.findIndex((r) => r.profile_id === this.onTrack()?.profile_id);
    return i < 0 ? [] : q.slice(i + 1).filter((r) => !this.isDone(r.profile_id)).slice(0, 4);
  });
  protected readonly targets = computed(() => {
    const id = this.focusId();
    return id ? qualTargets(this.standings(), id, this.cut()) : null;
  });
  protected readonly qChances = computed<Chance[]>(() => {
    const f = this.focus();
    if (!f) return [];
    const runs = this.runMap().get(f.profile_id) ?? [];
    const has = (a: number) => runs.some((r) => r.attempt === a);
    const attempt = !has(1) ? 1 : !has(2) ? 2 : null;
    return qualChances({ attempt, runs, leaderBest: this.targets()?.leader ?? null, debut: !(this.results().get(f.profile_id)?.length) });
  });
  /** прогноз зрителей за ближайшую зачётную попытку выбранного пилота */
  protected readonly votes = computed(() => {
    const f = this.focus();
    if (!f) return null;
    const runs = this.runMap().get(f.profile_id) ?? [];
    const attempt = runs.some((r) => r.attempt === 1) ? 2 : 1;
    const m = countsFor(this.preds(), { profileId: f.profile_id, attempt });
    const total = [...m.values()].reduce((s, n) => s + n, 0);
    if (!total) return null;
    const max = Math.max(...m.values());
    return { total, options: RUN_PICKS.map((k) => ({ k, label: RUN_PICK_LABEL[k], pct: Math.round(((m.get(k) ?? 0) / total) * 100), lead: (m.get(k) ?? 0) === max })) };
  });

  // ── парные ──
  protected readonly sortedBattles = computed(() => [...this.battles()].sort((a, b) => ORDER.indexOf(a.round) - ORDER.indexOf(b.round) || a.slot - b.slot));
  protected readonly duel = computed(() => {
    const id = this.pickedDuel();
    if (id && !this.follow()) return this.battles().find((b) => b.id === id) ?? null;
    return this.sortedBattles().find((b) => b.status !== 'done' && b.leader_id && b.chaser_id) ?? this.sortedBattles().filter((b) => b.status === 'done').at(-1) ?? null;
  });
  private readonly lastSeed = computed(() => {
    const ids = [...new Set(this.battles().filter((b) => b.round === this.sortedBattles()[0]?.round).flatMap((b) => [b.leader_id, b.chaser_id]))].filter((x): x is string => !!x);
    return ids.length >= 4 ? ids.reduce((a, b) => ((this.placeOf(b) ?? 0) > (this.placeOf(a) ?? 0) ? b : a)) : null;
  });
  protected readonly dChances = computed(() => {
    const b = this.duel();
    if (!b?.leader_id || !b.chaser_id) return { leader: [], chaser: [] };
    const before = this.battles().filter((x) => x.status === 'done' && x.id !== b.id && x.result !== 'bye' && ORDER.indexOf(x.round) <= ORDER.indexOf(b.round));
    const side = (id: string): DuelSide => {
      const mine = before.filter((x) => x.leader_id === id || x.chaser_id === id);
      const won = mine.filter((x) => x.winner_id === id);
      return {
        id,
        qualPlace: this.placeOf(id) ?? 99,
        wins: won.length,
        winsClean: won.every((x) => x.omt_count === 0),
        omtSoFar: mine.reduce((s, x) => s + x.omt_count, 0),
        lastSeed: this.lastSeed() === id,
        everWon: (this.results().get(id) ?? []).some((r) => r.stage_place === 1),
      };
    };
    return duelChances({ round: b.round, omt: b.omt_count, leader: side(b.leader_id), chaser: side(b.chaser_id), prevWinners: this.prevWinners(), prevDuels: this.prevDuels() });
  });
  protected readonly duelVotes = computed(() => {
    const b = this.duel();
    if (!b) return null;
    const m = countsFor(this.preds(), { battleId: b.id });
    const total = (m.get('leader') ?? 0) + (m.get('chaser') ?? 0);
    if (!total) return null;
    const leader = Math.round(((m.get('leader') ?? 0) / total) * 100);
    return { leader, chaser: 100 - leader, total };
  });

  constructor() {
    // навыки и рекорды подгружаем для тех, на кого смотрим (вся история оценок пилота)
    effect(() => {
      const ids = this.mode() === 'battles' ? [this.duel()?.leader_id, this.duel()?.chaser_id] : [this.focusId(), ...this.upNext().slice(0, 1).map((r) => r.profile_id)];
      for (const id of ids) if (id && !this.skillRuns().has(id)) this.loadSkills(id);
    });
    // история встреч пары
    effect(() => {
      const b = this.duel();
      if (b?.leader_id && b.chaser_id) this.loadH2h(b.leader_id, b.chaser_id);
    });
  }

  async ngOnInit() {
    const id = Number(this.id());
    const { data: st } = await supabase.from('stages').select('id, title_ru, status, season_id, ord, warmup, bracket_size, group_meta').eq('id', id).single();
    if (!st) return;
    this.stage.set(st);
    if (st.status === 'battles' || st.status === 'finished') this.mode.set('battles');
    await this.loadLive();
    await this.loadPilots(st);
    this.channel = supabase
      .channel(`commentator-${id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'qual_runs', filter: `stage_id=eq.${id}` }, () => this.loadLive())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'battles', filter: `stage_id=eq.${id}` }, () => this.loadLive())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'registrations', filter: `stage_id=eq.${id}` }, () => this.loadLive())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'judge_live', filter: `stage_id=eq.${id}` }, () => this.loadTarget())
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'predictions', filter: `stage_id=eq.${id}` }, () => this.loadPreds())
      .subscribe();
  }

  ngOnDestroy() {
    if (this.channel) supabase.removeChannel(this.channel);
  }

  /** то, что меняется во время этапа */
  private async loadLive() {
    const id = Number(this.id());
    const [regs, runs, battles] = await Promise.all([
      supabase
        .from('registrations')
        .select('profile_id, group_no, queue_order, status, profile:profiles(id, steam_id, nickname, start_number, avatar_url, livery_url, car, engine, gearbox, power_hp, bio_ru, bio_en, legacy)')
        .eq('stage_id', id),
      supabase.from('qual_runs').select('profile_id, attempt, angle, style, line, spin, fail, total').eq('stage_id', id),
      supabase.from('battles').select('id, round, slot, leader_id, chaser_id, winner_id, omt_count, status, result').eq('stage_id', id),
    ]);
    this.regs.set((regs.data ?? []) as unknown as Reg[]);
    this.runs.set((runs.data ?? []).map((r) => ({ ...r, total: Number(r.total) })) as Run[]);
    this.battles.set((battles.data ?? []) as Battle[]);
    await Promise.all([this.loadTarget(), this.loadPreds()]);
  }
  private async loadTarget() {
    const { data } = await supabase.from('judge_live').select('target').eq('stage_id', Number(this.id())).maybeSingle();
    this.target.set(data?.target ?? null);
  }
  private async loadPreds() {
    this.preds.set(await loadPredictionCounts(Number(this.id())));
  }

  /** карьера всех участников: прошлые этапы, ачивки, команды, сезон, чемпион и дуэли прошлого этапа */
  private async loadPilots(st: Stage) {
    const ids = this.regs().map((r) => r.profile_id);
    if (!ids.length) return;
    const [res, achs, members, prev, standings] = await Promise.all([
      supabase.from('stage_results').select('profile_id, stage_id, stage_place, qual_place, total, stage:stages(ord, title_ru, season:seasons(title))').in('profile_id', ids).neq('stage_id', st.id),
      supabase.from('achievements').select('profile_id, code').in('profile_id', ids),
      supabase.from('team_members').select('profile_id, team:teams(name)').eq('season_id', st.season_id).eq('status', 'approved'),
      supabase.from('stages').select('id').eq('season_id', st.season_id).eq('status', 'finished').lt('ord', st.ord).order('ord'),
      loadStandings(st.season_id),
    ]);
    const hist = new Map<string, DossierResult[]>();
    type ResRow = { profile_id: string; stage_id: number; stage_place: number; qual_place: number; total: number; stage: { ord: number; title_ru: string; season: { title: string } | null } | null };
    for (const r of ((res.data ?? []) as unknown as ResRow[]).sort((a, b) => b.stage_id - a.stage_id)) {
      hist.set(r.profile_id, [...(hist.get(r.profile_id) ?? []), { stage_id: r.stage_id, stage_place: r.stage_place, qual_place: r.qual_place, total: r.total, title: `${r.stage?.season?.title ?? ''} · ${r.stage?.title_ru ?? ''}` }]);
    }
    this.results.set(hist);
    const a = new Map<string, Map<string, number>>();
    for (const x of achs.data ?? []) {
      const m = a.get(x.profile_id) ?? new Map<string, number>();
      a.set(x.profile_id, m.set(x.code, (m.get(x.code) ?? 0) + 1));
    }
    this.achs.set(a);
    this.teams.set(new Map(((members.data ?? []) as unknown as { profile_id: string; team: { name: string } | null }[]).map((m) => [m.profile_id, m.team?.name ?? ''])));
    this.season.set(new Map(standings.pilots.map((p) => [p.id, { place: p.place, points: p.points }])));

    const prevIds = (prev.data ?? []).map((s) => s.id);
    if (prevIds.length) {
      const [wins, duels] = await Promise.all([
        supabase.from('stage_results').select('stage_id, profile_id').in('stage_id', prevIds).eq('stage_place', 1),
        supabase.from('battles').select('leader_id, chaser_id, winner_id, result').eq('stage_id', prevIds.at(-1)!),
      ]);
      this.prevWinners.set(prevIds.map((sid) => (wins.data ?? []).find((w) => w.stage_id === sid)?.profile_id ?? ''));
      this.prevDuels.set(
        (duels.data ?? [])
          .filter((d) => d.winner_id && d.leader_id && d.chaser_id && d.result !== 'bye')
          .map((d) => ({ winner: d.winner_id!, loser: d.winner_id === d.leader_id ? d.chaser_id! : d.leader_id! })),
      );
    }
  }

  private async loadSkills(id: string) {
    this.skillRuns.update((m) => new Map(m).set(id, [])); // не грузить дважды
    const runs = await loadSkillRuns(id);
    this.skillRuns.update((m) => new Map(m).set(id, runs));
  }

  private h2hKey = '';
  private async loadH2h(a: string, b: string) {
    const key = [a, b].sort().join();
    if (key === this.h2hKey) return;
    this.h2hKey = key;
    this.h2h.set(null);
    const { data } = await supabase
      .from('battles')
      .select('winner_id, result')
      .or(`and(leader_id.eq.${a},chaser_id.eq.${b}),and(leader_id.eq.${b},chaser_id.eq.${a})`)
      .not('winner_id', 'is', null);
    const done = (data ?? []).filter((x) => x.result !== 'bye');
    this.h2h.set({ leader: done.filter((x) => x.winner_id === a).length, chaser: done.filter((x) => x.winner_id === b).length, total: done.length });
  }

  // ── помощники шаблона ──
  protected reg(id: string) {
    return this.regMap().get(id) ?? null;
  }
  protected nick(id: string | null) {
    return (id && this.regMap().get(id)?.profile.nickname) || '—';
  }
  protected teamOf(id: string) {
    return this.teams().get(id) || null;
  }
  protected seasonOf(id: string) {
    return this.season().get(id) ?? null;
  }
  protected historyOf(id: string) {
    return this.results().get(id) ?? [];
  }
  protected achOf(id: string) {
    return this.achs().get(id) ?? new Map<string, number>();
  }
  protected had(code: string, id: string) {
    return this.achOf(id).get(code) ?? 0;
  }
  protected runOf(id: string, attempt: number) {
    return this.runMap().get(id)?.find((r) => r.attempt === attempt);
  }
  protected isDone(id: string) {
    const r = this.runMap().get(id) ?? [];
    return r.some((x) => x.attempt === 1) && r.some((x) => x.attempt === 2);
  }
  protected bestOf(id: string) {
    return this.qualMap().get(id)?.best ?? null;
  }
  protected placeOf(id: string) {
    return this.qualMap().get(id)?.place ?? null;
  }
  protected waitOf(id: string) {
    const q = this.queue().filter((r) => !this.isDone(r.profile_id));
    const i = q.findIndex((r) => r.profile_id === id);
    return i <= 0 ? 'одного' : `${i} пил.`;
  }
  protected failLabel(r: Run) {
    return FAIL_LABEL[r.fail ?? 'spin'].toUpperCase();
  }
  /** путь пилота по сетке этапа до этой дуэли */
  protected pathOf(id: string, b: Battle) {
    return this.sortedBattles()
      .filter((x) => x.id !== b.id && x.winner_id === id && ORDER.indexOf(x.round) < ORDER.indexOf(b.round))
      .map((x) => (x.result === 'bye' ? `${ROUND_LABEL[x.round]}: без соперника` : `${ROUND_LABEL[x.round]}: выбил ${this.nick(x.winner_id === x.leader_id ? x.chaser_id : x.leader_id)}${x.omt_count ? ` (OMT ×${x.omt_count})` : ''}`));
  }
  protected sides(b: Battle) {
    return [
      { role: 'leader' as const, id: b.leader_id! },
      { role: 'chaser' as const, id: b.chaser_id! },
    ];
  }

  protected gl(no: number | null) {
    return groupLabel(no, this.stage()?.group_meta);
  }

  pick(id: string) {
    this.picked.set(id);
    this.follow.set(id === this.onTrack()?.profile_id);
  }
  pickDuel(id: number) {
    this.pickedDuel.set(id);
    this.follow.set(false);
  }
}
