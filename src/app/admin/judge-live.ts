import { computed, inject, Injectable, OnDestroy, signal } from '@angular/core';
import { RealtimeChannel } from '@supabase/supabase-js';
import { Auth, supabase } from '../auth';
import { Vote } from '../scoring/scoring';

export type Crit = 'angle' | 'style' | 'line';
/** место судьи за пультом: свой критерий или «без оценки» (оператор, наблюдатель) */
export type Seat = Crit | 'none';
export interface Mark {
  target: string;
  crit: Crit;
  score: number | null;
  vote: Vote | null;
}
export interface Peer {
  nick: string;
  seat: Seat;
  chief: boolean;
}

function stored(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}
function store(key: string, v: string) {
  try {
    localStorage.setItem(key, v);
  } catch {
    /* приватный режим — место просто не запомнится */
  }
}

/**
 * Общий пульт судей (0024): несколько человек на одном этапе, каждый со своего устройства.
 * target — кого оценивают: 'q:<profile_id>:<attempt>' (квала, attempt пустой = следующая) или 'b:<battle_id>:<try>' (дуэль).
 * Черновые баллы / голоса видны всем сразу, в qual_runs / battle_votes их пишет главный судья.
 */
@Injectable()
export class JudgeLive implements OnDestroy {
  private readonly auth = inject(Auth);
  readonly seat = signal<Seat>((stored('sds-judge-seat') as Seat) ?? 'none');
  readonly chief = signal(stored('sds-judge-chief') === '1');
  /** общий выбор пилота / попытки в квалификации */
  readonly target = signal<string | null>(null);
  readonly marks = signal<Mark[]>([]);
  readonly peers = signal<Peer[]>([]);
  readonly error = signal<string | null>(null);
  private stageId = 0;
  private channel?: RealtimeChannel;

  /** кто за каким креслом: два человека на одном критерии — ошибка */
  readonly seatClash = computed(() => {
    const seats = this.peers().filter((p) => p.seat !== 'none').map((p) => p.seat);
    return seats.some((s, i) => seats.indexOf(s) !== i);
  });

  async start(stageId: number) {
    this.stageId = stageId;
    await Promise.all([this.loadMarks(), this.loadTarget()]);
    const me = this.auth.profile();
    this.channel = supabase
      .channel(`judges-${stageId}`, { config: { presence: { key: me?.id ?? crypto.randomUUID() } } })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'judge_marks', filter: `stage_id=eq.${stageId}` }, () => this.loadMarks())
      // удаление не фильтруется по stage_id — перечитываем на любое
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'judge_marks' }, () => this.loadMarks())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'judge_live', filter: `stage_id=eq.${stageId}` }, () => this.loadTarget())
      .on('presence', { event: 'sync' }, () => {
        const state = this.channel!.presenceState<Peer>();
        this.peers.set(Object.values(state).flatMap((list) => list.map(({ nick, seat, chief }) => ({ nick, seat, chief }))));
      })
      .subscribe((status) => status === 'SUBSCRIBED' && this.announce());
  }

  ngOnDestroy() {
    if (this.channel) supabase.removeChannel(this.channel);
  }

  private announce() {
    this.channel?.track({ nick: this.auth.profile()?.nickname ?? '?', seat: this.seat(), chief: this.chief() });
  }

  setSeat(seat: Seat) {
    this.seat.set(seat);
    store('sds-judge-seat', seat);
    this.announce();
  }
  setChief(on: boolean) {
    this.chief.set(on);
    store('sds-judge-chief', on ? '1' : '0');
    this.announce();
  }
  /** главный правит любой критерий, остальные — только свой */
  canEdit(crit: Crit) {
    return this.chief() || this.seat() === crit;
  }

  private async loadMarks() {
    const { data } = await supabase.from('judge_marks').select('target, crit, score, vote').eq('stage_id', this.stageId);
    this.marks.set(((data ?? []) as Mark[]).map((m) => ({ ...m, score: m.score === null ? null : Number(m.score) })));
  }
  private async loadTarget() {
    const { data } = await supabase.from('judge_live').select('target').eq('stage_id', this.stageId).maybeSingle();
    this.target.set(data?.target ?? null);
  }

  marksFor(target: string): Partial<Record<Crit, Mark>> {
    return Object.fromEntries(this.marks().filter((m) => m.target === target).map((m) => [m.crit, m]));
  }

  async setTarget(target: string | null) {
    this.target.set(target);
    const { error } = await supabase.from('judge_live').upsert({ stage_id: this.stageId, target, updated_at: new Date().toISOString() });
    this.error.set(error?.message ?? null);
  }

  /** балл (квала) или голос (дуэль); null — стереть */
  async setMark(target: string, crit: Crit, value: { score?: number | null; vote?: Vote | null }) {
    const score = value.score ?? null;
    const vote = value.vote ?? null;
    const rest = this.marks().filter((m) => m.target !== target || m.crit !== crit);
    const empty = score === null && vote === null;
    this.marks.set(empty ? rest : [...rest, { target, crit, score, vote }]);
    const q = empty
      ? supabase.from('judge_marks').delete().match({ stage_id: this.stageId, target, crit })
      : supabase
          .from('judge_marks')
          .upsert({ stage_id: this.stageId, target, crit, score, vote, judge: this.auth.profile()?.id ?? null, updated_at: new Date().toISOString() });
    const { error } = await q;
    this.error.set(error?.message ?? null);
  }

  /** убрать черновики после сохранения: точный target или все попытки дуэли ('b:<id>:') */
  async clear(target: string) {
    const prefix = target.endsWith(':');
    this.marks.update((all) => all.filter((m) => (prefix ? !m.target.startsWith(target) : m.target !== target)));
    const q = supabase.from('judge_marks').delete().eq('stage_id', this.stageId);
    await (prefix ? q.like('target', `${target}%`) : q.eq('target', target));
  }
}
