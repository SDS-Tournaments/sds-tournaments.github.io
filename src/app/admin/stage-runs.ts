import { Component, computed, input, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { supabase } from '../auth';
import { Fail, qualStandings } from '../scoring/scoring';

type Crit = 'angle' | 'style' | 'line';
interface Reg {
  profile_id: string;
  queue_order: number | null;
  status: string;
  profile: { nickname: string; start_number: number | null } | null;
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
  { key: 'line', label: 'Траектория' },
  { key: 'angle', label: 'Угол' },
  { key: 'style', label: 'Стиль' },
];
const FAIL_LABEL: Record<Fail, string> = { spin: 'Спин', crash: 'Авария', straight: 'Выпрямление', offtrack: 'Вылет' };

// Все оценки квалификации одним списком: любую можно исправить (ошибся судья) или удалить. Итоги потом — «Пересчитать».
@Component({
  selector: 'app-admin-stage-runs',
  imports: [FormsModule],
  template: `
    <section class="card stack">
      <header class="top">
        <h2 class="h">Оценки квалификации <span class="mono subtle">{{ rows().length }}</span></h2>
        <input class="input search" type="search" placeholder="Ник или номер…" [ngModel]="q()" (ngModelChange)="q.set($event)" />
      </header>
      <p class="muted small">Нажмите на оценку, чтобы исправить. Если итоги этапа уже подведены — после правок нажмите «Пересчитать итоги».</p>
      @if (msg()) { <p [class]="ok() ? 'ok' : 'bad'">{{ msg() }}</p> }

      <div class="table-wrap">
        <table class="table">
          <thead><tr><th>#</th><th>Пилот</th><th class="num">Попытка 1</th><th class="num">Попытка 2</th><th class="num">Лучшая</th></tr></thead>
          <tbody>
            @for (r of rows(); track r.profile_id) {
              <tr [class.dq]="r.status === 'dq'">
                <td class="mono">{{ place().get(r.profile_id) ?? '—' }}</td>
                <td><span class="mono n">{{ r.profile?.start_number ?? '—' }}</span> {{ r.profile?.nickname }} @if (r.status === 'dq') { <span class="badge">DQ</span> }</td>
                @for (a of [1, 2]; track a) {
                  @let run = runOf(r.profile_id, a);
                  <td class="num">
                    <button type="button" class="cell mono" [class.on]="isEditing(r.profile_id, a)" [class.fail]="run?.spin" (click)="edit(r.profile_id, a)">
                      {{ run ? (run.spin ? failLabel(run) : run.total) : '—' }}
                    </button>
                  </td>
                }
                <td class="num mono best">{{ best().get(r.profile_id) ?? '—' }}</td>
              </tr>
              @if (editing()?.pid === r.profile_id) {
                <tr class="ed">
                  <td colspan="5">
                    <form class="form" (ngSubmit)="save()">
                      <span class="lbl">{{ r.profile?.nickname }} · попытка {{ editing()!.attempt }}</span>
                      <select class="input" name="fail" [(ngModel)]="form.fail">
                        <option [ngValue]="null">Оценка</option>
                        @for (f of fails; track f[0]) { <option [ngValue]="f[0]">{{ f[1] }} (0)</option> }
                      </select>
                      @if (!form.fail) {
                        @for (c of crits; track c.key) {
                          <label class="score">{{ c.label }}
                            <span class="in"><input class="input mono" type="number" step="0.5" min="0" [max]="weights()[c.key]" [name]="c.key" [(ngModel)]="form[c.key]" /><span class="subtle">/ {{ weights()[c.key] }}</span></span>
                          </label>
                        }
                      }
                      <button class="btn btn-primary" type="submit" [disabled]="busy() || !valid()">Сохранить</button>
                      <button class="btn btn-ghost" type="button" (click)="editing.set(null)">Отмена</button>
                      @if (runOf(r.profile_id, editing()!.attempt)) {
                        <button class="btn btn-ghost danger" type="button" (click)="remove()" [disabled]="busy()">Удалить попытку</button>
                      }
                    </form>
                  </td>
                </tr>
              }
            } @empty {
              <tr><td colspan="5" class="subtle">Нет участников</td></tr>
            }
          </tbody>
        </table>
      </div>
    </section>
  `,
  styles: `
    .stack { display: grid; gap: 12px; }
    .top { display: flex; flex-wrap: wrap; gap: 12px; justify-content: space-between; align-items: center; }
    .h { font-size: 20px; margin: 0; }
    .search { width: min(100%, 260px); }
    .small { font-size: 13px; margin: 0; }
    .table-wrap { overflow-x: auto; max-height: 70vh; overflow-y: auto; }
    .n { color: var(--primary); margin-right: 6px; }
    .dq td { color: var(--ink-subtle); }
    .cell {
      min-width: 64px; padding: 4px 10px; border: 1px solid transparent; border-radius: var(--r-sm);
      background: none; color: var(--ink); font-size: 14px; cursor: pointer; text-align: right;
      &:hover { border-color: var(--primary); }
      &.on { border-color: var(--primary); background: var(--primary-soft); }
      &.fail { color: var(--error); }
    }
    .best { color: var(--primary); }
    .ed td { background: var(--surface-2); }
    .form { display: flex; flex-wrap: wrap; gap: 10px; align-items: end; }
    .form select { width: auto; }
    .lbl { align-self: center; font-weight: 500; margin-right: 6px; }
    .score { display: grid; gap: 4px; font-size: 12px; color: var(--ink-muted); .in { display: flex; gap: 6px; align-items: center; } input { width: 80px; } }
    .danger { color: var(--error); }
    .ok { color: var(--primary); margin: 0; }
    .bad { color: var(--error); margin: 0; }
  `,
})
export class AdminStageRuns implements OnInit {
  readonly stageId = input.required<number>();
  protected readonly regs = signal<Reg[]>([]);
  protected readonly runs = signal<Run[]>([]);
  protected readonly weights = signal<Record<Crit, number>>({ angle: 0, style: 0, line: 0 });
  protected readonly q = signal('');
  protected readonly editing = signal<{ pid: string; attempt: number } | null>(null);
  protected readonly busy = signal(false);
  protected readonly msg = signal<string | null>(null);
  protected readonly ok = signal(true);
  protected readonly crits = CRITS;
  protected readonly fails = Object.entries(FAIL_LABEL) as [Fail, string][];
  protected form: { fail: Fail | null } & Record<Crit, number | null> = { fail: null, angle: null, style: null, line: null };

  private readonly standings = computed(() =>
    qualStandings(
      this.regs()
        .filter((r) => r.status === 'registered')
        .map((r) => ({ id: r.profile_id, queueOrder: r.queue_order ?? 1e9, runs: this.runs().filter((x) => x.profile_id === r.profile_id) })),
    ),
  );
  protected readonly place = computed(() => new Map(this.standings().map((s) => [s.id, s.place])));
  protected readonly best = computed(() => new Map(this.standings().map((s) => [s.id, s.best])));
  /** по месту в квале; без оценок и DQ — в конце */
  protected readonly rows = computed(() => {
    const q = this.q().trim().toLowerCase();
    const pl = this.place();
    return this.regs()
      .filter((r) => r.status !== 'withdrawn')
      .filter((r) => !q || (r.profile?.nickname ?? '').toLowerCase().includes(q) || String(r.profile?.start_number ?? '').startsWith(q))
      .sort((a, b) => (pl.get(a.profile_id) ?? 1e9) - (pl.get(b.profile_id) ?? 1e9) || (a.queue_order ?? 1e9) - (b.queue_order ?? 1e9));
  });

  async ngOnInit() {
    const { data } = await supabase.from('stages').select('weights').eq('id', this.stageId()).single();
    if (data) this.weights.set(data.weights);
    await this.load();
  }

  private async load() {
    const id = this.stageId();
    const [regs, runs] = await Promise.all([
      supabase.from('registrations').select('profile_id, queue_order, status, profile:profiles(nickname, start_number)').eq('stage_id', id),
      supabase.from('qual_runs').select('profile_id, attempt, angle, style, line, spin, fail, total').eq('stage_id', id),
    ]);
    this.regs.set((regs.data ?? []) as unknown as Reg[]);
    this.runs.set(runs.data ?? []);
  }

  protected runOf(pid: string, attempt: number) {
    return this.runs().find((r) => r.profile_id === pid && r.attempt === attempt);
  }
  protected isEditing(pid: string, attempt: number) {
    const e = this.editing();
    return e?.pid === pid && e.attempt === attempt;
  }
  protected failLabel(r: Run) {
    return FAIL_LABEL[r.fail ?? 'spin'].toUpperCase();
  }

  edit(pid: string, attempt: number) {
    if (this.isEditing(pid, attempt)) return this.editing.set(null);
    const r = this.runOf(pid, attempt);
    this.form = { fail: r?.spin ? (r.fail ?? 'spin') : null, angle: r?.angle ?? null, style: r?.style ?? null, line: r?.line ?? null };
    this.editing.set({ pid, attempt });
    this.msg.set(null);
  }

  /** как в пульте судьи: шаг 0.5, не больше веса */
  protected valid() {
    if (this.form.fail) return true;
    const w = this.weights();
    return CRITS.every((c) => {
      const v = this.form[c.key];
      return v !== null && (v as unknown) !== '' && Number(v) >= 0 && Number(v) <= w[c.key] && Number.isInteger(Number(v) * 2);
    });
  }

  async save() {
    const e = this.editing();
    if (!e || !this.valid()) return;
    const f = this.form;
    const scores = f.fail ? { angle: null, style: null, line: null } : { angle: Number(f.angle), style: Number(f.style), line: Number(f.line) };
    await this.run(
      supabase
        .from('qual_runs')
        .upsert({ stage_id: this.stageId(), profile_id: e.pid, attempt: e.attempt, ...scores, spin: !!f.fail, fail: f.fail }, { onConflict: 'stage_id,profile_id,attempt' }),
      'Оценка сохранена',
    );
  }

  async remove() {
    const e = this.editing();
    if (!e || !confirm(`Удалить попытку ${e.attempt}? Пилот снова появится в очереди пульта судьи.`)) return;
    await this.run(supabase.from('qual_runs').delete().match({ stage_id: this.stageId(), profile_id: e.pid, attempt: e.attempt }), 'Попытка удалена');
  }

  private async run(q: PromiseLike<{ error: { message: string } | null }>, done: string) {
    this.busy.set(true);
    const { error } = await q;
    this.busy.set(false);
    this.msg.set(error ? error.message : done);
    this.ok.set(!error);
    if (error) return;
    this.editing.set(null);
    await this.load();
  }
}
