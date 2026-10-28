import { Component, computed, effect, input, OnDestroy, OnInit, signal, untracked } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from '../auth';
import { Fail, qualStandings } from '../scoring/scoring';
import { AdminBattles } from './battles';
import { STAGE_STATUS } from './labels';

type Crit = 'angle' | 'style' | 'line';
interface Stage {
  id: number;
  title_ru: string;
  status: string;
  weights: Record<Crit, number>;
  judges: Record<Crit, string>;
  bracket_size: 'auto' | '32' | '16' | '8';
  warmup: boolean;
}
interface Reg {
  profile_id: string;
  group_no: number | null;
  queue_order: number | null;
  status: string;
  profile: { nickname: string; start_number: number | null; avatar_url: string | null; car: string | null } | null;
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

const CRITS: { key: Crit; label: string }[] = [
  // порядок как у судей: траектория, угол, стиль
  { key: 'line', label: 'Траектория' },
  { key: 'angle', label: 'Угол' },
  { key: 'style', label: 'Стиль' },
];
const ATTEMPTS = [
  { n: 0, label: 'Прогрев' },
  { n: 1, label: 'Попытка 1' },
  { n: 2, label: 'Попытка 2' },
];

// Пульт судьи — квалификация (spec §5.1). Только RU.
@Component({
  selector: 'app-admin-judge',
  imports: [FormsModule, RouterLink, AdminBattles],
  template: `
    @if (stage(); as st) {
      <header class="bar">
        <a [routerLink]="['/admin/stages', st.id]" class="back">← Этап</a>
        <h1>{{ st.title_ru }}</h1>
        <div class="modes" role="tablist">
          <button role="tab" [class.on]="mode() === 'qual'" [attr.aria-selected]="mode() === 'qual'" (click)="mode.set('qual')">Квалификация</button>
          <button role="tab" [class.on]="mode() === 'battles'" [attr.aria-selected]="mode() === 'battles'" (click)="mode.set('battles')">Парные заезды</button>
        </div>
        <span class="badge" [class.off]="st.status !== 'qualifying' && st.status !== 'battles'">{{ statusLabel[st.status] }}</span>
        <span class="live"><i></i>онлайн</span>
      </header>

      @if (mode() === 'battles') {
        <app-admin-battles
          [stageId]="st.id"
          [standings]="standings()"
          [pilots]="pilotInfo()"
          [bracketSetting]="st.bracket_size"
          [judges]="st.judges"
          [qualDone]="doneCount() === queue().length"
          (started)="st.status = 'battles'"
        />
      } @else {
      @if (st.status !== 'qualifying') {
        <p class="warn">Этап не в статусе «Квалификация» — оценки сохранятся, но зрители увидят их только когда этап начнётся.</p>
      }
      @if (unordered()) {
        <p class="warn">Не у всех пилотов есть место в очереди — разбейте участников на группы на <a [routerLink]="['/admin/stages', st.id]">странице этапа</a>.</p>
      }

      <div class="panel">
        <!-- Очередь -->
        <aside class="queue card">
          <h2 class="h">Очередь <span class="mono subtle">{{ doneCount() }}/{{ queue().length }}</span></h2>
          <ol>
            @for (r of queue(); track r.profile_id; let i = $index) {
              @if (i === 0 || r.group_no !== queue()[i - 1].group_no) {
                <li class="ghead">Группа {{ r.group_no ?? '—' }}</li>
              }
              <li>
                <button class="qrow" [class.cur]="r.profile_id === current()?.profile_id" [class.done]="isDone(r.profile_id)" (click)="pick(r.profile_id)">
                  <span class="num mono">{{ r.profile?.start_number ?? '—' }}</span>
                  <span class="nick">{{ r.profile?.nickname }}</span>
                  <span class="dots">
                    @for (a of attempts(); track a.n) {
                      <i [class.on]="hasRun(r.profile_id, a.n)" [class.spin]="runOf(r.profile_id, a.n)?.spin" [title]="a.label"></i>
                    }
                  </span>
                </button>
              </li>
            }
          </ol>
        </aside>

        <!-- Текущий пилот -->
        <section class="now card">
          @if (current(); as c) {
            <div class="pilot">
              <span class="plate mono">{{ c.profile?.start_number ?? '—' }}</span>
              <div>
                <p class="eyebrow">Группа {{ c.group_no ?? '—' }} · в очереди {{ c.queue_order ?? '—' }}</p>
                <h2 class="nick-big">{{ c.profile?.nickname }}</h2>
                <p class="subtle car">{{ c.profile?.car ?? '' }}</p>
                @if (warnings().get(c.profile_id); as n) {
                  <p class="warned">⚠ Предупреждений: {{ n }} — повторное нарушение ведёт к дисквалификации</p>
                }
              </div>
            </div>

            <div class="tabs" role="tablist">
              @for (a of attempts(); track a.n) {
                <button role="tab" class="tab" [class.on]="attempt() === a.n" [class.has]="hasRun(c.profile_id, a.n)" [attr.aria-selected]="attempt() === a.n" (click)="pickAttempt(a.n)">
                  {{ a.label }}
                  @if (runOf(c.profile_id, a.n); as r) { <span class="mono">{{ a.n ? (r.spin ? failLabel(r) : r.total) : '✓' }}</span> }
                </button>
              }
            </div>

            @if (attempt() === 0) {
              <div class="warmup">
                <p class="muted">Прогревочный заезд не оценивается — отметьте, что пилот его проехал (или пропустите).</p>
                <button class="btn btn-primary big" (click)="saveWarmup()" [disabled]="busy()">Прогрев проехал → к попытке 1</button>
              </div>
            } @else {
              <form class="scores" (ngSubmit)="save(null)">
                @for (c of crits; track c.key) {
                  <label class="score">
                    <span class="lbl">{{ c.label }} <span class="subtle">· {{ st.judges[c.key] || 'судья' }}</span></span>
                    <input class="input mono" type="number" step="0.5" min="0" [max]="st.weights[c.key]" [name]="c.key"
                      [(ngModel)]="form[c.key]" (ngModelChange)="touch()" />
                    <span class="max mono subtle">из {{ st.weights[c.key] }}</span>
                  </label>
                }
                <div class="total">
                  <span class="lbl">Итог</span>
                  <span class="mono big-total" [class.bad]="overMax() || offGrid()">{{ formTotal() }}</span>
                  @if (offGrid()) { <span class="bad small">Шаг оценки — 0,5</span> }
                </div>
                <div class="actions">
                  <button class="btn btn-primary big" type="submit" [disabled]="busy() || overMax() || offGrid() || !filled()">Сохранить ⏎</button>
                  @for (f of fails; track f.key) {
                    <button class="btn btn-secondary" type="button" (click)="save(f.key)" [disabled]="busy()" [title]="f.hint">{{ f.label }} (0)</button>
                  }
                </div>
              </form>
            }

            <div class="incidents">
              <button class="btn btn-ghost" (click)="disconnect(c)" [disabled]="busy()">Дисконнект → в конец группы</button>
              <button class="btn btn-ghost danger" (click)="techLoss(c)" [disabled]="busy()">Техпоражение</button>
            </div>
            @if (msg()) { <p [class]="ok() ? 'ok' : 'bad'">{{ msg() }}</p> }
          } @else {
            <div class="finished">
              <h2>Квалификация завершена ✓</h2>
              <p class="muted">Все пилоты проехали. Проверьте таблицу справа и переходите к парным заездам.</p>
            </div>
          }
        </section>

        <!-- Живая таблица -->
        <aside class="table-side card">
          <h2 class="h">Квалификация</h2>
          <table class="table">
            <thead><tr><th>#</th><th>Пилот</th><th class="num">Лучшая</th></tr></thead>
            <tbody>
              @for (row of standings(); track row.id) {
                <tr [class.cut]="row.place === 32">
                  <td class="mono">{{ row.place }}</td>
                  <td>{{ nick(row.id) }}</td>
                  <td class="num">{{ row.best }}</td>
                </tr>
              } @empty {
                <tr><td colspan="3" class="subtle">Пока нет оценок</td></tr>
              }
            </tbody>
          </table>
        </aside>
      </div>
      }
    }
  `,
  styles: `
    :host { display: block; max-width: 1680px; margin: 0 auto; padding: 24px var(--gutter) 64px; }
    .bar { display: flex; flex-wrap: wrap; align-items: center; gap: 12px 16px; margin-bottom: 16px; }
    .back { font-size: 14px; }
    h1 { font-size: 22px; flex: 1; }
    .badge.off { background: var(--surface-3); color: var(--ink-muted); }
    .modes { display: flex; padding: 3px; border: 1px solid var(--hairline-strong); border-radius: var(--r-pill); background: var(--surface-1); }
    .modes button {
      padding: 8px 16px; border: 0; border-radius: var(--r-pill); background: none; color: var(--ink-muted);
      font: 500 14px var(--font); cursor: pointer; transition: background-color var(--base), color var(--fast);
      &.on { background: var(--primary); color: var(--on-primary); }
    }
    .live { display: flex; align-items: center; gap: 6px; font-size: 12px; color: var(--primary); text-transform: uppercase; letter-spacing: 1px; }
    .live i { width: 8px; height: 8px; border-radius: 50%; background: var(--primary); animation: pulse 2s ease-out infinite; }
    @keyframes pulse { from { box-shadow: 0 0 0 0 var(--primary-glow); } to { box-shadow: 0 0 0 8px transparent; } }
    .warn { color: var(--warning); font-size: 14px; margin: 0 0 12px; }

    .panel { display: grid; grid-template-columns: 260px 1fr 280px; gap: 16px; align-items: start; }
    @media (max-width: 1200px) { .panel { grid-template-columns: 240px 1fr; } .table-side { grid-column: 1 / -1; } }
    .card { padding: 20px; }
    .h { font-size: 16px; margin-bottom: 12px; display: flex; justify-content: space-between; }

    .queue ol { list-style: none; margin: 0; padding: 0; display: grid; gap: 2px; max-height: 70vh; overflow-y: auto; }
    .ghead { font-size: 11px; letter-spacing: 1px; text-transform: uppercase; color: var(--ink-subtle); padding: 10px 4px 4px; }
    .qrow {
      width: 100%; display: grid; grid-template-columns: 36px 1fr auto; gap: 8px; align-items: center;
      padding: 7px 8px; border: 1px solid transparent; border-radius: var(--r-sm); background: none; color: var(--ink);
      font: 14px var(--font); text-align: left; cursor: pointer;
      &:hover { background: var(--surface-2); }
      &.cur { border-color: var(--primary); background: var(--primary-soft); }
      &.done { color: var(--ink-subtle); }
    }
    .num { color: var(--primary); }
    .nick { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .dots { display: flex; gap: 3px; }
    .dots i { width: 8px; height: 8px; border-radius: 50%; background: var(--surface-3); }
    .dots i.on { background: var(--primary); }
    .dots i.spin { background: var(--error); }

    .now { display: grid; gap: 20px; }
    .pilot { display: flex; gap: 20px; align-items: center; }
    .plate {
      display: grid; place-items: center; min-width: 96px; height: 72px; padding: 0 12px;
      font-size: 44px; font-weight: 600; font-style: italic; color: var(--ink);
      text-shadow: 2px 2px 0 var(--primary); border: 1px solid var(--primary); border-radius: var(--r-md); background: var(--surface-2);
    }
    .eyebrow { margin: 0; }
    .nick-big { font-size: 32px; margin: 4px 0 2px; }
    .car { margin: 0; font-size: 14px; }
    .warned { margin: 6px 0 0; font-size: 13px; color: var(--warning); }

    .tabs { display: flex; gap: 6px; flex-wrap: wrap; }
    .tab {
      display: flex; gap: 8px; align-items: center; padding: 8px 16px; border: 1px solid var(--hairline-strong);
      border-radius: var(--r-pill); background: var(--surface-1); color: var(--ink-muted); font: 500 14px var(--font); cursor: pointer;
      &.has { color: var(--ink); }
      &.on { border-color: var(--primary); color: var(--primary); box-shadow: 0 0 16px -6px var(--primary-glow); }
    }

    .scores { display: grid; grid-template-columns: repeat(3, 1fr) auto; gap: 12px; align-items: end; }
    @media (max-width: 900px) { .scores { grid-template-columns: 1fr 1fr; } }
    .score { display: grid; gap: 6px; position: relative; }
    .score .input { font-size: 28px; height: 64px; padding-right: 56px; }
    .max { position: absolute; right: 12px; bottom: 22px; font-size: 12px; }
    .lbl { font-size: 13px; color: var(--ink-muted); }
    .total { display: grid; gap: 6px; justify-items: end; }
    .big-total { font-size: 48px; line-height: 64px; color: var(--primary); text-shadow: 0 0 24px var(--primary-glow); }
    .big-total.bad { color: var(--error); text-shadow: none; }
    .actions { grid-column: 1 / -1; display: flex; gap: 12px; flex-wrap: wrap; }
    .big { min-height: 52px; padding: 12px 28px; font-size: 16px; }
    .warmup { display: grid; gap: 12px; justify-items: start; }
    .incidents { display: flex; gap: 8px; flex-wrap: wrap; padding-top: 16px; border-top: 1px solid var(--hairline); }
    .danger { color: var(--error); }
    .finished { text-align: center; padding: 40px 0; h2 { color: var(--primary); } }

    .table-side .table td, .table-side .table th { padding: 7px 8px; }
    tr.cut td { border-bottom: 2px solid var(--primary); }
    .ok { color: var(--primary); margin: 0; }
    .bad { color: var(--error); margin: 0; }
  `,
})
export class AdminJudge implements OnInit, OnDestroy {
  readonly id = input.required<string>();
  protected readonly stage = signal<Stage | null>(null);
  protected readonly regs = signal<Reg[]>([]);
  protected readonly runs = signal<Run[]>([]);
  protected readonly mode = signal<'qual' | 'battles'>('qual');
  protected readonly pilotInfo = computed(() => new Map(this.regs().map((r) => [r.profile_id, { nickname: r.profile?.nickname ?? '?', start_number: r.profile?.start_number ?? null }])));
  protected readonly selected = signal<string | null>(null);
  protected readonly selectedAttempt = signal<number | null>(null);
  protected readonly busy = signal(false);
  protected readonly msg = signal<string | null>(null);
  protected readonly ok = signal(true);
  protected readonly crits = CRITS;
  /** без прогрева — только зачётные попытки */
  protected readonly attempts = computed(() => (this.stage()?.warmup === false ? ATTEMPTS.slice(1) : ATTEMPTS));
  protected readonly statusLabel = STAGE_STATUS;
  protected form: Record<Crit, number | null> = { angle: null, style: null, line: null };
  private readonly formVersion = signal(0);
  private channel?: RealtimeChannel;

  protected readonly queue = computed(() =>
    this.regs()
      .filter((r) => r.status === 'registered')
      .sort((a, b) => (a.queue_order ?? 1e9) - (b.queue_order ?? 1e9)),
  );
  protected readonly unordered = computed(() => this.queue().some((r) => r.queue_order === null));
  private readonly runMap = computed(() => {
    const m = new Map<string, Map<number, Run>>();
    for (const r of this.runs()) m.set(r.profile_id, (m.get(r.profile_id) ?? new Map()).set(r.attempt, r));
    return m;
  });
  protected readonly current = computed(() => {
    const sel = this.selected();
    return this.queue().find((r) => (sel ? r.profile_id === sel : !this.isDone(r.profile_id))) ?? null;
  });
  protected readonly attempt = computed(() => {
    const c = this.current();
    if (!c) return 1;
    return this.selectedAttempt() ?? this.attempts().find((a) => !this.hasRun(c.profile_id, a.n))?.n ?? 2;
  });
  protected readonly doneCount = computed(() => this.queue().filter((r) => this.isDone(r.profile_id)).length);
  protected readonly standings = computed(() =>
    qualStandings(this.queue().map((r) => ({ id: r.profile_id, queueOrder: r.queue_order ?? 1e9, runs: [...(this.runMap().get(r.profile_id)?.values() ?? [])] }))),
  );
  protected readonly formTotal = computed(() => {
    this.formVersion();
    return Math.round(CRITS.reduce((s, c) => s + (Number(this.form[c.key]) || 0), 0) * 100) / 100;
  });
  protected readonly overMax = computed(() => {
    this.formVersion();
    const w = this.stage()?.weights;
    return !!w && CRITS.some((c) => (Number(this.form[c.key]) || 0) > w[c.key]);
  });
  /** оценки ставятся с шагом 0.5 (7, 7.5, 8…) */
  protected readonly offGrid = computed(() => {
    this.formVersion();
    return CRITS.some((c) => !Number.isInteger((Number(this.form[c.key]) || 0) * 2));
  });
  protected readonly filled = computed(() => {
    this.formVersion();
    return CRITS.every((c) => this.form[c.key] !== null && (this.form[c.key] as unknown) !== '');
  });

  constructor() {
    // При смене пилота/попытки — подставить сохранённые оценки (правка) или очистить.
    // Оценки читаем untracked: обновление с другого пульта не должно стирать то, что судья сейчас вводит.
    effect(() => {
      const pid = this.current()?.profile_id;
      const attempt = this.attempt();
      untracked(() => {
        const r = pid ? this.runOf(pid, attempt) : undefined;
        this.form = { angle: r?.angle ?? null, style: r?.style ?? null, line: r?.line ?? null };
        this.touch();
        setTimeout(() => document.querySelector<HTMLInputElement>('.scores input')?.focus());
      });
    });
  }

  async ngOnInit() {
    const id = Number(this.id());
    const { data } = await supabase.from('stages').select('id, title_ru, status, weights, judges, bracket_size, warmup').eq('id', id).single();
    this.stage.set(data);
    if (data?.status === 'battles' || data?.status === 'finished') this.mode.set('battles');
    await this.load();
    // Несколько пультов одновременно: любое изменение → перезагрузка
    this.channel = supabase
      .channel(`judge-${id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'qual_runs', filter: `stage_id=eq.${id}` }, () => this.load())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'registrations', filter: `stage_id=eq.${id}` }, () => this.load())
      .subscribe();
  }

  ngOnDestroy() {
    if (this.channel) supabase.removeChannel(this.channel);
  }

  private async load() {
    const id = Number(this.id());
    const [regs, runs, warns] = await Promise.all([
      supabase.from('registrations').select('profile_id, group_no, queue_order, status, profile:profiles(nickname, start_number, avatar_url, car)').eq('stage_id', id),
      supabase.from('qual_runs').select('profile_id, attempt, angle, style, line, spin, fail, total').eq('stage_id', id),
      supabase.from('sanctions').select('profile_id').eq('type', 'warning'),
    ]);
    this.regs.set((regs.data ?? []) as unknown as Reg[]);
    this.runs.set(runs.data ?? []);
    const w = new Map<string, number>();
    for (const s of warns.data ?? []) w.set(s.profile_id, (w.get(s.profile_id) ?? 0) + 1);
    this.warnings.set(w);
  }

  /** предупреждения пилотов (регламент 1.6: повторное → дисквалификация) */
  protected readonly warnings = signal(new Map<string, number>());

  protected runOf(pid: string, attempt: number) {
    return this.runMap().get(pid)?.get(attempt);
  }
  protected hasRun(pid: string, attempt: number) {
    return !!this.runOf(pid, attempt);
  }
  /** проехал обе зачётные (прогрев на это не влияет — его могли выключить) */
  protected isDone(pid: string) {
    return this.hasRun(pid, 1) && this.hasRun(pid, 2);
  }
  protected nick(pid: string) {
    return this.regs().find((r) => r.profile_id === pid)?.profile?.nickname ?? '?';
  }
  protected touch() {
    this.formVersion.update((v) => v + 1);
  }

  pick(pid: string) {
    this.selected.set(pid);
    this.selectedAttempt.set(null);
  }
  pickAttempt(n: number) {
    this.selected.set(this.current()?.profile_id ?? null);
    this.selectedAttempt.set(n);
  }

  /** После сохранения — снова «авто»: следующая попытка или следующий пилот */
  private advance() {
    this.selected.set(null);
    this.selectedAttempt.set(null);
  }

  private async upsertRun(row: Partial<Run>) {
    const c = this.current();
    if (!c) return false;
    this.busy.set(true);
    const { error } = await supabase
      .from('qual_runs')
      .upsert({ stage_id: Number(this.id()), profile_id: c.profile_id, attempt: this.attempt(), ...row }, { onConflict: 'stage_id,profile_id,attempt' });
    this.busy.set(false);
    if (error) {
      this.note(error.message, false);
      return false;
    }
    await this.load();
    return true;
  }

  async saveWarmup() {
    if (await this.upsertRun({ angle: null, style: null, line: null, spin: false, fail: null })) {
      this.note('Прогрев отмечен', true);
      this.advance();
    }
  }

  /** нулевые попытки: что случилось */
  protected readonly fails: { key: Fail; label: string; hint: string }[] = [
    { key: 'spin', label: 'Спин', hint: 'Развернуло' },
    { key: 'crash', label: 'Авария', hint: 'Разбился об отбойник или стену' },
    { key: 'straight', label: 'Выпрямление', hint: 'Выпрямился, проехал без заноса' },
    { key: 'offtrack', label: 'Вылет', hint: '4 колеса за пределами трассы' },
  ];
  protected failLabel(r: Run) {
    return (this.fails.find((f) => f.key === (r.fail ?? 'spin'))?.label ?? 'Спин').toUpperCase();
  }

  async save(fail: Fail | null) {
    const spin = !!fail;
    if (!spin && (this.overMax() || this.offGrid())) return;
    const c = this.current();
    const scores = spin ? { angle: null, style: null, line: null } : { angle: Number(this.form.angle), style: Number(this.form.style), line: Number(this.form.line) };
    if (await this.upsertRun({ ...scores, spin, fail })) {
      const label = this.fails.find((f) => f.key === fail)?.label.toLowerCase();
      this.note(`${c?.profile?.nickname}: попытка ${this.attempt()} — ${spin ? label + ', 0' : this.formTotal()}`, true);
      this.advance();
    }
  }

  /** Регламент 5.1: перезаезд — в конец очереди, оставшиеся попытки после всех */
  async disconnect(c: Reg) {
    if (!confirm(`${c.profile?.nickname}: дисконнект — переставить в конец его группы?`)) return;
    // пилот встаёт последним в своей группе; остальные пилоты группы сдвигаются на одно место вперёд
    const q = this.queue();
    const group = q.filter((r) => r.group_no === c.group_no);
    const reordered = [...group.filter((r) => r.profile_id !== c.profile_id), c];
    const slots = group.map((r) => r.queue_order ?? 0).sort((x, y) => x - y);
    const changes = reordered.map((r, i) => ({ r, order: slots[i] })).filter(({ r, order }) => r.queue_order !== order);
    this.busy.set(true);
    const results = await Promise.all(
      changes.map(({ r, order }) =>
        supabase.from('registrations').update({ queue_order: order }).match({ stage_id: Number(this.id()), profile_id: r.profile_id }),
      ),
    );
    this.busy.set(false);
    const error = results.find((x) => x.error)?.error;
    if (error) return this.note(error.message, false);
    await this.load();
    this.note(`${c.profile?.nickname} переставлен в конец группы ${c.group_no ?? ''}`, true);
    this.advance();
  }

  /** Дисконнект по вине игрока — без результата в квалификации */
  async techLoss(c: Reg) {
    if (!confirm(`${c.profile?.nickname}: техническое поражение? Пилот выбывает из квалификации.`)) return;
    this.busy.set(true);
    const { error } = await supabase.from('registrations').update({ status: 'dq' }).match({ stage_id: Number(this.id()), profile_id: c.profile_id });
    this.busy.set(false);
    if (error) return this.note(error.message, false);
    await this.load();
    this.note(`${c.profile?.nickname}: техпоражение`, true);
    this.advance();
  }

  private note(text: string, ok: boolean) {
    this.msg.set(text);
    this.ok.set(ok);
  }
}
