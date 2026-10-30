import { Component, computed, DestroyRef, inject, input, OnInit, signal } from '@angular/core';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { toSignal } from '@angular/core/rxjs-interop';
import { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from '../auth';
import { GroupMeta, groupLabel } from '../groups';

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
  private readonly regs = signal<Reg[]>([]);
  private readonly runs = signal<{ profile_id: string; attempt: number }[]>([]);
  private readonly meta = signal<GroupMeta[]>([]);
  private readonly t = inject(TranslocoService);
  private readonly lang = toSignal(this.t.langChanges$, { initialValue: this.t.getActiveLang() });
  private sub?: RealtimeChannel;

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
    this.lang();
    const words = { group: this.t.translate('groups.group'), buffer: this.t.translate('groups.buffer') };
    const nos = [...new Set(this.queue().map((r) => r.group_no!))];
    const started = this.started();
    const pending = nos.filter((g) => this.queue().some((r) => r.group_no === g && !this.done().has(r.profile_id)));
    return nos.map((no) => {
      const pilots = this.queue().filter((r) => r.group_no === no);
      const state: State = !pending.includes(no) ? 'done' : !started ? 'wait' : no === pending[0] ? 'now' : no === pending[1] ? 'next' : 'wait';
      return { no, label: groupLabel(no, this.meta(), words), buffer: !!this.meta()[no - 1]?.buffer, pilots, state };
    });
  });

  constructor() {
    inject(DestroyRef).onDestroy(() => this.sub && supabase.removeChannel(this.sub));
  }

  async ngOnInit() {
    await this.load();
    const id = this.stageId();
    const f = `stage_id=eq.${id}`;
    this.sub = supabase
      .channel(`groups-${id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'qual_runs', filter: f }, () => this.load())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'registrations', filter: f }, () => this.load())
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'stages', filter: `id=eq.${id}` }, () => this.load())
      .subscribe();
  }

  private async load() {
    const id = this.stageId();
    const [regs, runs, st] = await Promise.all([
      supabase.from('registrations').select('profile_id, group_no, queue_order, profile:profiles(nickname, start_number)').eq('stage_id', id).eq('status', 'registered'),
      supabase.from('qual_runs').select('profile_id, attempt').eq('stage_id', id),
      supabase.from('stages').select('group_meta').eq('id', id).single(),
    ]);
    this.regs.set((regs.data ?? []) as unknown as Reg[]);
    this.runs.set(runs.data ?? []);
    this.meta.set((st.data?.group_meta ?? []) as GroupMeta[]);
  }
}
