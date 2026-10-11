import { DatePipe } from '@angular/common';
import { Component, inject, OnDestroy, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RealtimeChannel } from '@supabase/supabase-js';
import { Auth, supabase } from '../auth';
import { BattleRef, canChange, qualPlaces, reseat, targetsOf } from './bracket-ops';

interface Protest {
  id: number;
  battle_id: number;
  stage_id: number;
  profile_id: string;
  video_url: string;
  reason: string;
  status: 'pending' | 'rejected' | 'reversed' | 'rerun';
  admin_comment: string | null;
  created_at: string;
  resolved_at: string | null;
  pilot: { nickname: string; start_number: number | null } | null;
  stage: { title_ru: string } | null;
}

const ROUND: Record<string, string> = { r32: 'Top 32', r16: 'Top 16', qf: 'Top 8', sf: 'Полуфинал', third: 'За 3-е', final: 'Финал' };
const STATUS: Record<Protest['status'], string> = { pending: 'На рассмотрении', rejected: 'Отклонён', reversed: 'Победа отдана', rerun: 'Перезаезд' };

// Протесты (spec §5.8): рассмотрение и решение. Только RU.
@Component({
  selector: 'app-admin-protests',
  imports: [FormsModule, DatePipe],
  template: `
    <h1 class="display-md">Протесты</h1>
    @if (msg()) { <p [class]="ok() ? 'ok' : 'bad'">{{ msg() }}</p> }

    @for (p of protests(); track p.id) {
      @let b = battles()[p.battle_id];
      <article class="card stack" [class.pending]="p.status === 'pending'">
        <header class="head">
          <span class="badge" [class]="p.status">{{ status[p.status] }}</span>
          <span class="subtle small">{{ p.stage?.title_ru }} · {{ b ? round[b.round] : '' }} · {{ p.created_at | date: 'HH:mm' }}</span>
        </header>
        <p class="who">
          <b><span class="mono num">{{ p.pilot?.start_number ?? '—' }}</span> {{ p.pilot?.nickname }}</b>
          оспаривает поражение
          @if (b) { от <b>{{ nick(b.winner_id) }}</b> }
        </p>
        <p class="reason">{{ p.reason }}</p>
        <a class="video" [href]="p.video_url" target="_blank" rel="noopener noreferrer">▶ Видео-доказательство</a>

        @if (p.status === 'pending') {
          <label class="field">
            <span class="lbl">Комментарий для пилота</span>
            <textarea class="input" rows="2" maxlength="1000" [(ngModel)]="comment[p.id]"></textarea>
          </label>
          <div class="actions">
            <button class="btn btn-secondary" (click)="resolve(p, 'rejected')" [disabled]="busy()">Отклонить</button>
            <button class="btn btn-primary" (click)="resolve(p, 'reversed')" [disabled]="busy() || !changeable(p)">Отдать победу {{ p.pilot?.nickname }}</button>
            <button class="btn btn-secondary" (click)="resolve(p, 'rerun')" [disabled]="busy() || !changeable(p)">Назначить перезаезд</button>
          </div>
          @if (!changeable(p)) { <p class="warn small">Следующая дуэль уже началась — изменить результат нельзя, только отклонить.</p> }
        } @else if (p.admin_comment) {
          <p class="subtle small">Комментарий: {{ p.admin_comment }}</p>
        }
      </article>
    } @empty {
      <p class="subtle">Протестов пока нет.</p>
    }
  `,
  styles: `
    h1 { margin-bottom: 24px; }
    .stack { display: grid; gap: 12px; margin-bottom: 16px; }
    .pending { border-color: var(--warning); box-shadow: 0 0 24px -16px var(--warning); }
    .head { display: flex; flex-wrap: wrap; gap: 10px; align-items: center; }
    .badge.pending { background: rgba(245, 185, 66, 0.15); color: var(--warning); }
    .badge.rejected { background: var(--surface-3); color: var(--ink-muted); }
    .who, .reason { margin: 0; }
    .reason { padding: 12px; border-radius: var(--r-sm); background: var(--surface-2); white-space: pre-wrap; }
    .num { color: var(--primary); }
    .video { justify-self: start; }
    .field { display: grid; gap: 6px; }
    .lbl { font-size: 13px; color: var(--ink-muted); }
    .actions { display: flex; flex-wrap: wrap; gap: 8px; }
    .small { font-size: 13px; margin: 0; }
    .warn { color: var(--warning); }
    .ok { color: var(--primary); }
    .bad { color: var(--error); }
  `,
})
export class AdminProtests implements OnInit, OnDestroy {
  protected readonly protests = signal<Protest[]>([]);
  /** дуэли по id — для подписи и операций с сеткой */
  protected readonly battles = signal<Record<number, BattleRef>>({});
  private readonly stageBattles = signal<Record<number, BattleRef[]>>({});
  private readonly names = signal<Record<string, string>>({});
  protected readonly busy = signal(false);
  protected readonly msg = signal<string | null>(null);
  protected readonly ok = signal(true);
  protected readonly round = ROUND;
  protected readonly status = STATUS;
  protected comment: Record<number, string> = {};
  private readonly auth = inject(Auth);
  private channel?: RealtimeChannel;

  async ngOnInit() {
    await this.load();
    this.channel = supabase
      .channel('admin-protests')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'protests' }, () => this.load())
      .subscribe();
  }

  ngOnDestroy() {
    if (this.channel) supabase.removeChannel(this.channel);
  }

  private async load() {
    const { data } = await supabase
      .from('protests')
      .select('*, pilot:profiles!protests_profile_id_fkey(nickname, start_number), stage:stages(title_ru)')
      .order('status')
      .order('created_at', { ascending: false });
    const list = (data ?? []) as unknown as Protest[];
    // сначала на рассмотрении
    list.sort((a, b) => Number(b.status === 'pending') - Number(a.status === 'pending'));
    this.protests.set(list);

    const stageIds = [...new Set(list.map((p) => p.stage_id))];
    if (!stageIds.length) return;
    const { data: bs } = await supabase
      .from('battles')
      .select('id, stage_id, round, slot, leader_id, chaser_id, winner_id, status, omt_count')
      .in('stage_id', stageIds);
    const all = (bs ?? []) as (BattleRef & { stage_id: number })[];
    this.battles.set(Object.fromEntries(all.map((b) => [b.id, b])));
    this.stageBattles.set(Object.fromEntries(stageIds.map((s) => [s, all.filter((b) => b.stage_id === s)])));
    const ids = [...new Set(all.map((b) => b.winner_id).filter(Boolean))] as string[];
    const { data: ps } = await supabase.from('profiles').select('id, nickname').in('id', ids);
    this.names.set(Object.fromEntries((ps ?? []).map((p) => [p.id, p.nickname])));
  }

  protected nick(id: string | null) {
    return (id && this.names()[id]) || '—';
  }

  protected changeable(p: Protest) {
    const b = this.battles()[p.battle_id];
    return !!b && canChange(b, this.stageBattles()[p.stage_id] ?? []);
  }

  async resolve(p: Protest, status: 'rejected' | 'reversed' | 'rerun') {
    const label = { rejected: 'Отклонить протест', reversed: `Отдать победу ${p.pilot?.nickname}`, rerun: 'Назначить перезаезд' }[status];
    if (!confirm(`${label}?`)) return;
    this.busy.set(true);
    const err = status === 'rejected' ? null : await this.applyToBracket(p, status);
    const res = err
      ? { error: { message: err } }
      : await supabase
          .from('protests')
          .update({ status, admin_comment: this.comment[p.id]?.trim() || null, resolved_by: this.auth.profile()?.id, resolved_at: new Date().toISOString() })
          .eq('id', p.id);
    this.busy.set(false);
    this.msg.set(res.error ? res.error.message : `Протест: ${STATUS[status].toLowerCase()}`);
    this.ok.set(!res.error);
    await this.load();
  }

  /** Отдать победу — победитель меняется в паре и дальше по сетке; перезаезд — дуэль снова открыта */
  private async applyToBracket(p: Protest, status: 'reversed' | 'rerun'): Promise<string | null> {
    const b = this.battles()[p.battle_id];
    const all = this.stageBattles()[p.stage_id] ?? [];
    if (!b || !canChange(b, all)) return 'Следующая дуэль уже началась';
    const q = await qualPlaces(p.stage_id);
    const { next, third } = targetsOf(b, all);
    const oldWinner = b.winner_id;
    const protester = p.profile_id;
    const ops =
      status === 'reversed'
        ? [
            supabase.from('battles').update({ winner_id: protester, result: 'normal' }).eq('id', b.id),
            ...(next ? [reseat(next, oldWinner, protester, q)] : []),
            ...(third ? [reseat(third, protester, oldWinner, q)] : []),
          ]
        : [
            ...(next ? [reseat(next, oldWinner, null, q)] : []),
            ...(third ? [reseat(third, protester, null, q)] : []),
            supabase.from('battle_votes').delete().eq('battle_id', b.id).eq('try', b.omt_count),
            supabase.from('battles').update({ winner_id: null, status: 'running', result: null, decided_at: null }).eq('id', b.id),
          ];
    const results = await Promise.all(ops);
    return results.find((r) => r.error)?.error?.message ?? null;
  }
}
