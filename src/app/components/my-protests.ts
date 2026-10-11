import { Component, computed, DestroyRef, inject, input, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslocoPipe } from '@jsverse/transloco';
import { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from '../auth';
import { notify } from '../notify';

const WINDOW_MS = 5 * 60_000;
const LIMIT = 2;

interface LostBattle {
  id: number;
  stage_id: number;
  round: string;
  decided_at: string;
  winner: { nickname: string } | null;
}
interface Protest {
  id: number;
  battle_id: number;
  stage_id: number;
  status: 'pending' | 'rejected' | 'reversed' | 'rerun';
  admin_comment: string | null;
  created_at: string;
}

// Протесты пилота: подача в течение 5 минут после проигранной дуэли (spec §5.8), статусы поданных
@Component({
  selector: 'app-my-protests',
  imports: [FormsModule, TranslocoPipe],
  template: `
    @if (open().length || protests().length) {
      <section class="card stack">
        <h2 class="h">{{ 'protest.title' | transloco }} <span class="mono subtle">{{ used() }}/{{ limit }}</span></h2>

        @for (b of open(); track b.id) {
          <form class="file" (ngSubmit)="submit(b)">
            <div class="head">
              <p>{{ 'protest.lost' | transloco: { round: ('round.' + b.round | transloco), name: b.winner?.nickname } }}</p>
              <span class="timer mono" [class.hot]="left(b) < 60_000">{{ fmt(left(b)) }}</span>
            </div>
            <label class="field">
              <span class="lbl">{{ 'protest.video' | transloco }}</span>
              <input class="input" type="url" name="v{{ b.id }}" placeholder="https://…" required [(ngModel)]="video[b.id]" />
            </label>
            <label class="field">
              <span class="lbl">{{ 'protest.reason' | transloco }}</span>
              <textarea class="input" rows="3" name="r{{ b.id }}" minlength="10" maxlength="1000" required [(ngModel)]="reason[b.id]"></textarea>
            </label>
            <button class="btn btn-primary" type="submit" [disabled]="busy() || used() >= limit">{{ 'protest.submit' | transloco }}</button>
          </form>
        }

        @for (p of protests(); track p.id) {
          <div class="mine">
            <span class="badge" [class]="p.status">{{ 'protest.status.' + p.status | transloco }}</span>
            <span class="subtle small mono">{{ p.created_at.slice(11, 16) }}</span>
            @if (p.admin_comment) { <p class="comment">{{ p.admin_comment }}</p> }
          </div>
        }
        @if (error()) { <p class="bad small">{{ error() }}</p> }
      </section>
    }
  `,
  styles: `
    .stack { display: grid; gap: 16px; }
    .h { font-size: 20px; display: flex; gap: 10px; align-items: baseline; }
    .file { display: grid; gap: 12px; padding: 16px; border: 1px solid var(--warning); border-radius: var(--r-md); background: rgba(245, 185, 66, 0.05); }
    .head { display: flex; justify-content: space-between; gap: 12px; align-items: center; p { margin: 0; } }
    .timer { font-size: 22px; color: var(--warning); }
    .timer.hot { color: var(--error); }
    .field { display: grid; gap: 6px; }
    .lbl { font-size: 13px; color: var(--ink-muted); }
    .mine { display: flex; flex-wrap: wrap; gap: 10px; align-items: center; padding: 10px 0; border-top: 1px solid var(--hairline); }
    .badge.pending { background: rgba(245, 185, 66, 0.15); color: var(--warning); }
    .badge.rejected { background: rgba(255, 92, 92, 0.12); color: var(--error); }
    .comment { flex-basis: 100%; margin: 0; font-size: 14px; color: var(--ink-muted); }
    .small { font-size: 13px; }
    .bad { color: var(--error); margin: 0; }
  `,
})
export class MyProtests implements OnInit {
  readonly profileId = input.required<string>();
  protected readonly limit = LIMIT;
  protected readonly lost = signal<LostBattle[]>([]);
  protected readonly protests = signal<Protest[]>([]);
  protected readonly busy = signal(false);
  protected readonly error = signal<string | null>(null);
  private readonly now = signal(Date.now());
  protected video: Record<number, string> = {};
  protected reason: Record<number, string> = {};
  private channel?: RealtimeChannel;

  /** Проигранные дуэли, по которым ещё можно подать протест */
  protected readonly open = computed(() =>
    this.lost().filter((b) => this.left(b) > 0 && !this.protests().some((p) => p.battle_id === b.id)),
  );
  /** Лимит считается на этап — берём этап, где идут дуэли */
  protected readonly used = computed(() => {
    const stage = this.lost()[0]?.stage_id;
    return this.protests().filter((p) => p.stage_id === stage).length;
  });

  constructor() {
    const id = setInterval(() => this.now.set(Date.now()), 1000);
    inject(DestroyRef).onDestroy(() => {
      clearInterval(id);
      if (this.channel) supabase.removeChannel(this.channel);
    });
  }

  async ngOnInit() {
    await this.load();
    // Решение по дуэли приходит в реальном времени — форма появляется сразу
    this.channel = supabase
      .channel(`my-protests-${this.profileId()}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'battles' }, () => this.load())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'protests', filter: `profile_id=eq.${this.profileId()}` }, () => this.load())
      .subscribe();
  }

  private async load() {
    const me = this.profileId();
    const { data: stages } = await supabase.from('stages').select('id').eq('status', 'battles');
    const ids = (stages ?? []).map((s) => s.id);
    const [battles, protests] = await Promise.all([
      ids.length
        ? supabase
            .from('battles')
            .select('id, stage_id, round, decided_at, winner_id, winner:profiles!battles_winner_id_fkey(nickname)')
            .in('stage_id', ids)
            .eq('status', 'done')
            .or(`leader_id.eq.${me},chaser_id.eq.${me}`)
            .neq('winner_id', me)
            .neq('result', 'bye')
        : Promise.resolve({ data: [] }),
      // явный фильтр: организатору RLS отдаёт протесты всех пилотов
      supabase.from('protests').select('id, battle_id, stage_id, status, admin_comment, created_at').eq('profile_id', me).order('created_at', { ascending: false }),
    ]);
    this.lost.set(((battles.data ?? []) as unknown as LostBattle[]).filter((b) => b.decided_at));
    this.protests.set(protests.data ?? []);
  }

  protected left(b: LostBattle) {
    return new Date(b.decided_at).getTime() + WINDOW_MS - this.now();
  }

  protected fmt(ms: number) {
    const s = Math.max(0, Math.ceil(ms / 1000));
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  }

  async submit(b: LostBattle) {
    this.busy.set(true);
    this.error.set(null);
    const { data, error } = await supabase
      .from('protests')
      .insert({ battle_id: b.id, stage_id: b.stage_id, video_url: this.video[b.id]?.trim(), reason: this.reason[b.id]?.trim() })
      .select('id')
      .single();
    this.busy.set(false);
    if (error) return this.error.set(error.message);
    notify('protest', data.id);
    await this.load();
  }
}
