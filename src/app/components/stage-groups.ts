import { Component, computed, DestroyRef, inject, input, OnInit, signal } from '@angular/core';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { toSignal } from '@angular/core/rxjs-interop';
import { supabase } from '../auth';
import { GroupMeta, groupLabel } from '../groups';
import { litePoll } from '../lite';

interface Reg {
  profile_id: string;
  group_no: number | null;
  queue_order: number | null;
  profile: { nickname: string; start_number: number | null } | null;
}
type State = 'done' | 'now' | 'next' | 'wait';

// Группы квалификации для зрителей и пилотов: кто в какой группе, какая едет, какая готовится (страница этапа и эфир на главной)
@Component({
  selector: 'app-stage-groups',
  imports: [TranslocoPipe],
  template: `
    @if (groups().length) {
      <h2 class="h2">{{ 'groups.title' | transloco }}</h2>
      <div class="grid">
        @for (g of groups(); track g.no) {
          <section class="g card" [class]="g.state" [class.buf]="g.buffer">
            <header>
              <b>{{ g.label }}</b>
              @switch (g.state) {
                @case ('now') { <span class="pill now"><i></i>{{ 'groups.now' | transloco }}</span> }
                @case ('next') { <span class="pill next">{{ 'groups.next' | transloco }}</span> }
                @case ('done') { <span class="pill done">✓ {{ 'groups.done' | transloco }}</span> }
              }
              <span class="mono subtle cnt">{{ g.pilots.length }}</span>
            </header>
            <!-- проехавшая группа свёрнута: список уже не нужен -->
            @if (g.state !== 'done') {
              <ol>
                @for (r of g.pilots; track r.profile_id) {
                  <li [class.ok]="done().has(r.profile_id)" [class.cur]="r.profile_id === onTrack()">
                    <span class="mono n">{{ r.profile?.start_number ?? '—' }}</span>
                    <span class="nick">{{ r.profile?.nickname }}</span>
                    @if (r.profile_id === onTrack()) { <span class="tag">{{ 'groups.onTrack' | transloco }}</span> }
                    @else if (done().has(r.profile_id)) { <span class="tick" aria-hidden="true">✓</span> }
                  </li>
                }
              </ol>
            }
          </section>
        }
      </div>
    }
  `,
  styles: `
    :host { display: block; }
    .h2 { font-size: 22px; margin: 0 0 16px; }
    .grid { display: grid; gap: 12px; grid-template-columns: repeat(auto-fill, minmax(230px, 1fr)); align-items: start; }
    .g { padding: 14px; display: grid; gap: 10px; transition: opacity var(--base); }
    header { display: flex; align-items: center; gap: 8px; }
    header b { font-size: 15px; }
    .cnt { margin-left: auto; font-size: 12px; }
    .pill { display: inline-flex; align-items: center; gap: 6px; padding: 2px 9px; border-radius: var(--r-pill); font-size: 11px; font-weight: 600; letter-spacing: 0.5px; text-transform: uppercase; }
    .pill.now { color: var(--error); border: 1px solid color-mix(in srgb, var(--error) 50%, transparent); }
    .pill.now i { width: 6px; height: 6px; border-radius: 50%; background: var(--error); animation: blink 1.2s ease-in-out infinite; }
    @keyframes blink { 50% { opacity: 0.3; } }
    .pill.next { color: var(--warning); border: 1px solid color-mix(in srgb, var(--warning) 50%, transparent); }
    .pill.done { color: var(--ink-subtle); }
    /* едет — подсвечена, готовится — жёлтая черта, проехала — приглушена */
    .g.now { border-color: color-mix(in srgb, var(--error) 55%, transparent); box-shadow: 0 0 24px -10px var(--error); }
    .g.next { border-color: color-mix(in srgb, var(--warning) 45%, transparent); }
    .g.done { opacity: 0.5; }
    .g.buf header b { color: var(--warning); }
    .g.buf { border-style: dashed; }
    ol { list-style: none; margin: 0; padding: 0; display: grid; gap: 3px; }
    li { display: grid; grid-template-columns: 34px 1fr auto; gap: 8px; align-items: center; padding: 6px 8px; border-radius: var(--r-sm); background: var(--surface-2); font-size: 14px; }
    .n { color: var(--primary); }
    .nick { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    li.ok { opacity: 0.5; }
    .tick { color: var(--primary); font-size: 12px; }
    li.cur { box-shadow: inset 3px 0 0 var(--error); background: color-mix(in srgb, var(--error) 10%, var(--surface-2)); }
    .tag { font-size: 10px; letter-spacing: 1px; text-transform: uppercase; color: var(--error); font-weight: 600; }
    @media (prefers-reduced-motion: reduce) { .pill.now i { animation: none; } }
  `,
})
export class StageGroups implements OnInit {
  readonly stageId = input.required<number>();
  /** статус этапа: в «Квалификации» первая группа «едет», даже пока оценок ещё нет */
  readonly status = input<string>('registration');
  /** витрина (UI kit): вымышленные группы без базы — до старта или по ходу квалы */
  readonly demo = input<'before' | 'live' | null>(null);
  /** данные из блока эфира (там они уже есть и обновляются) — свой запрос и подписка не нужны */
  readonly data = input<{ regs: Reg[]; runs: { profile_id: string; attempt: number }[]; meta: GroupMeta[] } | null>(null);
  private readonly ownRegs = signal<Reg[]>([]);
  private readonly ownRuns = signal<{ profile_id: string; attempt: number }[]>([]);
  private readonly ownMeta = signal<GroupMeta[]>([]);
  private readonly regs = computed(() => this.data()?.regs ?? this.ownRegs());
  private readonly runs = computed(() => this.data()?.runs ?? this.ownRuns());
  private readonly meta = computed(() => this.data()?.meta ?? this.ownMeta());
  private readonly t = inject(TranslocoService);
  /** «Группа» / «Буфер» на языке сайта — подписка, а не translate(): словарь грузится асинхронно, иначе на миг (или навсегда) видны ключи */
  private readonly words = toSignal(this.t.selectTranslate(['groups.group', 'groups.buffer']), { initialValue: ['', ''] });
  private readonly destroyRef = inject(DestroyRef);

  /** проехал обе зачётные попытки */
  protected readonly done = computed(() => {
    const n = new Map<string, number>();
    for (const r of this.runs()) if (r.attempt === 1 || r.attempt === 2) n.set(r.profile_id, (n.get(r.profile_id) ?? 0) + 1);
    return new Set([...n].filter(([, c]) => c >= 2).map(([id]) => id));
  });
  private readonly queue = computed(() => this.regs().filter((r) => r.group_no).sort((a, b) => (a.queue_order ?? 1e9) - (b.queue_order ?? 1e9)));
  /** на трассе — первый в очереди, кто ещё не проехал (как у судей) */
  private readonly started = computed(() => this.status() === 'qualifying' || this.runs().length > 0);
  protected readonly onTrack = computed(() => (this.started() ? (this.queue().find((r) => !this.done().has(r.profile_id))?.profile_id ?? null) : null));
  protected readonly groups = computed(() => {
    const [group, buffer] = this.words() as string[];
    const words = { group, buffer };
    const nos = [...new Set(this.queue().map((r) => r.group_no!))];
    const started = this.started();
    const pending = nos.filter((g) => this.queue().some((r) => r.group_no === g && !this.done().has(r.profile_id)));
    return nos.map((no) => {
      const pilots = this.queue().filter((r) => r.group_no === no);
      const state: State = !pending.includes(no) ? 'done' : !started ? 'wait' : no === pending[0] ? 'now' : no === pending[1] ? 'next' : 'wait';
      return { no, label: groupLabel(no, this.meta(), words), buffer: !!this.meta()[no - 1]?.buffer, pilots, state };
    });
  });

  async ngOnInit() {
    if (this.demo()) return this.showDemo();
    if (this.data()) return;
    await this.load();
    // опросом, не Realtime: сам блок виден до старта квалы (в эфире данные даёт live-stage), а сохранение групп в админке —
    // сотня событий каждому зрителю (авария 2026-10-31)
    this.destroyRef.onDestroy(litePoll(() => this.load()));
  }

  /** 3 группы по 10 + буфер «EN сервер»; по ходу квалы: группа 1 проехала, во 2-й едет 4-й пилот */
  private showDemo() {
    const names = ['Kaido', 'Touge_Ghost', 'NightOwl', 'SmokeUnit', 'Hachiroku', 'Akina_Down', 'RedSuns', 'Usui_Line', 'Clutchkick', 'Feint', 'Manji', 'Choku_Dori', 'Inertia', 'Shakedown', 'Handbrake', 'Gaiden', 'Apex', 'Sidewall', 'Lockup', 'Rev_Limit', 'Shift', 'Overcut', 'Ebrake', 'Zipper', 'Flick', 'Sakura', 'Kansei', 'Yokai', 'Oni', 'Tengu', 'Lucky_Bob', 'Mr_Smith', 'Big_Ben', 'Hans'];
    const regs: Reg[] = names.map((n, i) => ({ profile_id: 'd' + i, group_no: i < 30 ? Math.floor(i / 10) + 1 : 4, queue_order: i + 1, profile: { nickname: n, start_number: 3 + ((i * 37) % 900) } }));
    this.ownRegs.set(regs);
    this.ownMeta.set([{}, {}, {}, { buffer: true, name: 'EN сервер' }]);
    this.ownRuns.set(this.demo() === 'live' ? regs.slice(0, 13).flatMap((r) => [{ profile_id: r.profile_id, attempt: 1 }, { profile_id: r.profile_id, attempt: 2 }]) : []);
  }

  private async load() {
    const id = this.stageId();
    const [regs, runs, st] = await Promise.all([
      supabase.from('registrations').select('profile_id, group_no, queue_order, profile:profiles(nickname, start_number)').eq('stage_id', id).eq('status', 'registered'),
      supabase.from('qual_runs').select('profile_id, attempt').eq('stage_id', id),
      supabase.from('stages').select('group_meta').eq('id', id).single(),
    ]);
    this.ownRegs.set((regs.data ?? []) as unknown as Reg[]);
    this.ownRuns.set(runs.data ?? []);
    this.ownMeta.set((st.data?.group_meta ?? []) as GroupMeta[]);
  }
}
