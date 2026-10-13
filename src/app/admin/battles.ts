import { Component, computed, input, isDevMode, OnDestroy, OnInit, output, signal } from '@angular/core';
import { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from '../auth';
import { battleOutcome, bracketSize, buildBracket, QualRow, Round, Vote } from '../scoring/scoring';
import { canChange, reseat, targetsOf } from './bracket-ops';
import { finishStage } from './finish';
import { notify } from '../notify';
import { BracketTree } from '../components/bracket-tree';
import { RouterLink } from '@angular/router';

interface Battle {
  id: number;
  round: Round;
  slot: number;
  leader_id: string | null;
  chaser_id: string | null;
  winner_id: string | null;
  omt_count: number;
  status: 'pending' | 'running' | 'done';
  result: 'normal' | 'tech_loss' | 'bye' | 'qual_tiebreak' | 'contact' | null;
}
type Crit = 'angle' | 'style' | 'line';
export interface PilotInfo {
  nickname: string;
  start_number: number | null;
}

const ORDER: Round[] = ['r32', 'r16', 'qf', 'sf', 'third', 'final'];
const ROUND_LABEL: Record<Round, string> = { r32: 'Top 32', r16: 'Top 16', qf: 'Top 8', sf: 'Полуфинал', third: 'За 3-е место', final: 'Финал' };
const CRITS: { key: Crit; label: string }[] = [
  { key: 'angle', label: 'Угол' },
  { key: 'style', label: 'Стиль' },
  { key: 'line', label: 'Траектория' },
];
const RESULT_LABEL: Record<string, string> = { normal: '', tech_loss: 'техпоражение', bye: 'проход без соперника', qual_tiebreak: 'по квалификации после 2 OMT', contact: 'контакт — соперник врезался' };

// Пульт судьи — сетка и парные заезды (spec §5.2–5.3). Только RU.
@Component({
  selector: 'app-admin-battles',
  imports: [BracketTree, RouterLink],
  template: `
    @if (!battles().length) {
      <section class="card empty">
        <h2>Сетка ещё не построена</h2>
        <p class="muted">
          Квалификацию прошли {{ standings().length }} пилотов → сетка <b>Top {{ size() }}</b>
          @if (byes() > 0) { , {{ byes() }} лидер(ов) квалификации пройдут первый раунд без соперника }.
        </p>
        @if (!qualDone()) { <p class="warn">Не все пилоты завершили квалификацию.</p> }
        <button class="btn btn-primary big" (click)="build()" [disabled]="busy() || standings().length < 2">Построить сетку и начать парные заезды</button>
      </section>
    } @else {
      <div class="layout">
        <!-- Текущая дуэль -->
        <section class="card duel">
          @if (current(); as b) {
            <p class="eyebrow">{{ roundLabel[b.round] }} · пара {{ b.slot + 1 }}
              @if (b.omt_count) { <span class="omt mono">OMT {{ b.omt_count }}/2</span> }
            </p>
            <div class="vs">
              <div class="side lead">
                <span class="role">Лидер в 1-м заезде</span>
                <span class="plate mono">{{ info(b.leader_id).start_number ?? '—' }}</span>
                <span class="nick">{{ info(b.leader_id).nickname }}</span>
                <span class="subtle mono">квал. #{{ qualPlace().get(b.leader_id!) }}</span>
              </div>
              <span class="x mono">VS</span>
              <div class="side chase">
                <span class="role">Чейзер в 1-м заезде</span>
                <span class="plate mono">{{ info(b.chaser_id).start_number ?? '—' }}</span>
                <span class="nick">{{ info(b.chaser_id).nickname }}</span>
                <span class="subtle mono">квал. #{{ qualPlace().get(b.chaser_id!) }}</span>
              </div>
            </div>

            @if (b.status === 'done') {
              <div class="decided">
                <p>Победитель: <b class="win">{{ info(b.winner_id).nickname }}</b>
                  @if (b.result && resultLabel[b.result]) { <span class="subtle">({{ resultLabel[b.result] }})</span> }
                </p>
                <button class="btn btn-ghost" (click)="undo(b)" [disabled]="busy() || !canUndo(b)">Отменить решение</button>
                @if (!canUndo(b)) { <span class="subtle small">Нельзя: следующая дуэль уже решена</span> }
                <button class="btn btn-secondary" (click)="selected.set(null)">К текущей дуэли →</button>
              </div>
            } @else {
              @if (blocked().has(b.id)) {
                <p class="protest-warn">⚠ По предыдущей дуэли одного из пилотов подан протест. Дуэль начнётся после решения организатора.</p>
              }
              <p class="muted small">Два заезда со сменой ролей. После обоих — голос каждого судьи. При дисконнекте — перезаезд, затем голосование.</p>
              <div class="votes">
                @for (c of crits; track c.key) {
                  <div class="vrow">
                    <span class="judge">{{ c.label }} <span class="subtle">· {{ judges()[c.key] || 'судья' }}</span></span>
                    <!-- Пилоты в том же порядке, что и карточки выше; OMT посередине -->
                    <div class="seg" role="radiogroup">
                      @for (v of voteKinds; track v) {
                        @let pid = v === 'leader' ? b.leader_id : v === 'chaser' ? b.chaser_id : null;
                        <button type="button" role="radio" [class.omt-btn]="v === 'omt'" [class.on]="votes()[c.key] === v" [attr.aria-checked]="votes()[c.key] === v" (click)="setVote(c.key, v)">
                          @if (pid) {
                            <span class="mono vn">{{ info(pid).start_number ?? '—' }}</span> {{ info(pid).nickname }}
                          } @else { OMT }
                        </button>
                      }
                    </div>
                  </div>
                }
              </div>
              <div class="commit">
                <span class="preview">{{ preview(b) }}</span>
                <button class="btn btn-primary big" (click)="submit(b)" [disabled]="busy() || !allVoted() || blocked().has(b.id)">Зафиксировать решение</button>
              </div>
              <div class="incidents">
                <button class="btn btn-ghost danger" (click)="techLoss(b, 'leader')" [disabled]="busy()">Техпоражение: {{ info(b.leader_id).nickname }}</button>
                <button class="btn btn-ghost danger" (click)="techLoss(b, 'chaser')" [disabled]="busy()">Техпоражение: {{ info(b.chaser_id).nickname }}</button>
                <button class="btn btn-ghost danger" (click)="contact(b, 'leader')" [disabled]="busy()" title="Врезался в соперника — поражение">💥 Врезался: {{ info(b.leader_id).nickname }}</button>
                <button class="btn btn-ghost danger" (click)="contact(b, 'chaser')" [disabled]="busy()" title="Врезался в соперника — поражение">💥 Врезался: {{ info(b.chaser_id).nickname }}</button>
              </div>
            }
            @if (msg()) { <p [class]="ok() ? 'ok' : 'bad'">{{ msg() }}</p> }
          } @else {
            <div class="champ">
              @if (finished()) {
                <p class="eyebrow">Этап завершён</p>
                <h2>🏆 {{ info(champion()).nickname }}</h2>
                <p class="muted">Итоги подведены — <a [routerLink]="['/stages', stageId()]">таблица на странице этапа</a>.</p>
                <!-- на случай исправлений после завершения (протест, ошибка судьи) -->
                <button class="btn btn-ghost small" (click)="finish(true)" [disabled]="busy()">↻ Пересчитать итоги</button>
              } @else {
                <p class="eyebrow">Все дуэли проведены</p>
                <h2>🏆 {{ info(champion()).nickname }}</h2>
                <button class="btn btn-primary big" (click)="finish()" [disabled]="busy()">Подвести итоги и завершить этап</button>
              }
              @if (msg()) { <p [class]="ok() ? 'ok' : 'bad'">{{ msg() }}</p> }
            </div>
          }
        </section>

        <!-- Сетка -->
        <section class="card bracket-card">
          <header class="bhead">
            <h2 class="h">Сетка</h2>
            @if (dev) {
              <button class="btn btn-ghost small test" (click)="testProtest()" [disabled]="busy()">Тест: протест от проигравшего последней дуэли</button>
            }
            <button class="btn btn-ghost danger small" (click)="wipe()" [disabled]="busy()">Удалить сетку</button>
          </header>
          <app-bracket-tree
            [battles]="battles()"
            [pilots]="pilots()"
            [labels]="roundLabel"
            [currentId]="current()?.id ?? null"
            [clickable]="true"
            [flags]="flags()"
            (pick)="selected.set($event)"
          />
        </section>
      </div>
    }
  `,
  styles: `
    :host { display: block; }
    .card { padding: 20px; }
    .h { font-size: 16px; }
    .big { min-height: 52px; padding: 12px 28px; font-size: 16px; }
    .small { font-size: 13px; }
    .warn { color: var(--warning); }
    .empty { display: grid; gap: 12px; justify-items: start; }
    .layout { display: grid; gap: 16px; grid-template-columns: minmax(420px, 1fr) 1.4fr; align-items: start; }
    @media (max-width: 1200px) { .layout { grid-template-columns: 1fr; } }

    .duel { display: grid; gap: 18px; }
    .eyebrow { margin: 0; display: flex; gap: 10px; align-items: center; }
    .omt { padding: 2px 8px; border-radius: var(--r-pill); background: rgba(245, 185, 66, 0.15); color: var(--warning); font-size: 11px; }
    .vs { display: grid; grid-template-columns: 1fr auto 1fr; align-items: center; gap: 12px; }
    .side { display: grid; justify-items: center; gap: 6px; padding: 16px 8px; border-radius: var(--r-md); background: var(--surface-2); text-align: center; }
    .lead { box-shadow: inset 0 3px 0 var(--primary); }
    .chase { box-shadow: inset 0 3px 0 var(--ink-tertiary); }
    .role { font-size: 11px; letter-spacing: 1.5px; text-transform: uppercase; color: var(--ink-subtle); }
    .plate { font-size: 40px; font-weight: 600; font-style: italic; line-height: 1; text-shadow: 2px 2px 0 var(--primary); }
    .nick { font-size: 18px; font-weight: 600; word-break: break-word; }
    .x { font-size: 20px; color: var(--primary); }

    .votes { display: grid; gap: 10px; }
    .vrow { display: grid; gap: 6px; }
    .judge { font-size: 14px; }
    .seg { display: grid; grid-template-columns: 1fr 72px 1fr; border: 1px solid var(--hairline-strong); border-radius: var(--r-md); overflow: hidden; }
    .seg button {
      min-height: 48px; padding: 6px 10px; border: 0; border-right: 1px solid var(--hairline-strong); background: var(--surface-1);
      color: var(--ink-muted); font: 500 14px var(--font); cursor: pointer; transition: background-color var(--fast), color var(--fast);
      overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
      &:last-child { border-right: 0; }
      &:hover { color: var(--ink); background: var(--surface-2); }
      &.on { background: var(--primary); color: var(--on-primary); }
      &.omt-btn { font-family: var(--mono); font-size: 13px; }
      &.omt-btn.on { background: var(--warning); }
    }
    .vn { color: var(--primary); margin-right: 4px; }
    .on .vn { color: inherit; }
    .commit { display: flex; flex-wrap: wrap; gap: 12px; align-items: center; justify-content: space-between; padding-top: 8px; border-top: 1px solid var(--hairline); }
    .preview { font-size: 15px; color: var(--primary); }
    .incidents { display: flex; flex-wrap: wrap; gap: 8px; }
    .danger { color: var(--error); }
    .decided { display: flex; flex-wrap: wrap; gap: 12px; align-items: center; p { margin: 0; flex-basis: 100%; } }
    .win { color: var(--primary); }
    .champ { display: grid; justify-items: center; gap: 12px; text-align: center; padding: 32px 0; h2 { margin: 0; font-size: 32px; color: var(--primary); } p { margin: 0; } }
    .ok { color: var(--primary); margin: 0; }
    .bad { color: var(--error); margin: 0; }

    .bhead { display: flex; flex-wrap: wrap; gap: 8px; justify-content: space-between; align-items: center; margin-bottom: 12px; }
    .bhead .h { flex: 1; }
    .test { color: var(--warning); }
    .protest-warn { margin: 0; padding: 10px 12px; border-radius: var(--r-sm); background: rgba(245, 185, 66, 0.12); color: var(--warning); font-size: 14px; }
  `,
})
export class AdminBattles implements OnInit, OnDestroy {
  readonly stageId = input.required<number>();
  readonly standings = input.required<QualRow[]>();
  readonly pilots = input.required<Map<string, PilotInfo>>();
  readonly bracketSetting = input<'auto' | '32' | '16' | '8'>('auto');
  readonly judges = input<Record<Crit, string>>({ angle: '', style: '', line: '' });
  readonly qualDone = input(true);
  /** этап перешёл в «Парные заезды» */
  readonly started = output<void>();

  protected readonly battles = signal<Battle[]>([]);
  /** id дуэлей с протестом на рассмотрении */
  protected readonly protested = signal<number[]>([]);
  protected readonly dev = isDevMode();
  protected readonly selected = signal<number | null>(null);
  protected readonly votes = signal<Partial<Record<Crit, Vote>>>({});
  protected readonly busy = signal(false);
  protected readonly msg = signal<string | null>(null);
  protected readonly ok = signal(true);
  protected readonly crits = CRITS;
  protected readonly roundLabel = ROUND_LABEL;
  protected readonly resultLabel = RESULT_LABEL;
  protected readonly voteKinds: Vote[] = ['leader', 'omt', 'chaser'];
  private channel?: RealtimeChannel;

  protected readonly qualPlace = computed(() => new Map(this.standings().map((r) => [r.id, r.place])));
  protected readonly size = computed(() => bracketSize(this.standings().length, this.bracketSetting()));
  protected readonly byes = computed(() => Math.max(0, this.size() - this.standings().length));
  protected readonly flags = computed(() => {
    const f: Record<number, string> = {};
    for (const id of this.blocked()) f[id] = 'ждёт';
    for (const id of this.protested()) f[id] = 'протест';
    return f;
  });
  private readonly sorted = computed(() => [...this.battles()].sort((a, b) => ORDER.indexOf(a.round) - ORDER.indexOf(b.round) || a.slot - b.slot));
  /** Пары, которые ждут решения по протесту (туда ушли участники оспоренной дуэли) */
  protected readonly blocked = computed(() => {
    const ids = new Set<number>();
    for (const pid of this.protested()) {
      const b = this.battles().find((x) => x.id === pid);
      if (!b) continue;
      const { next, third } = targetsOf(b, this.battles());
      if (next) ids.add(next.id);
      if (third) ids.add(third.id);
    }
    return ids;
  });
  protected readonly current = computed(() => {
    const sel = this.selected();
    if (sel) return this.battles().find((b) => b.id === sel) ?? null;
    return this.sorted().find((b) => b.status !== 'done' && b.leader_id && b.chaser_id && !this.blocked().has(b.id)) ?? null;
  });
  protected readonly champion = computed(() => this.battles().find((b) => b.round === 'final')?.winner_id ?? null);
  protected readonly allVoted = computed(() => CRITS.every((c) => this.votes()[c.key]));

  /** этап уже завершён (итоги подведены) */
  protected readonly finished = signal(false);

  async ngOnInit() {
    supabase.from('stages').select('status').eq('id', this.stageId()).single().then(({ data }) => this.finished.set(data?.status === 'finished'));
    await this.load();
    this.channel = supabase
      .channel(`battles-${this.stageId()}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'battles', filter: `stage_id=eq.${this.stageId()}` }, () => this.load())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'protests', filter: `stage_id=eq.${this.stageId()}` }, () => this.load())
      .subscribe();
  }

  ngOnDestroy() {
    if (this.channel) supabase.removeChannel(this.channel);
  }

  private async load() {
    const [battles, protests] = await Promise.all([
      supabase.from('battles').select('id, round, slot, leader_id, chaser_id, winner_id, omt_count, status, result').eq('stage_id', this.stageId()),
      supabase.from('protests').select('battle_id').eq('stage_id', this.stageId()).eq('status', 'pending'),
    ]);
    this.battles.set((battles.data ?? []) as Battle[]);
    this.protested.set((protests.data ?? []).map((p) => p.battle_id));
  }

  protected info(pid: string | null): PilotInfo {
    return (pid && this.pilots().get(pid)) || { nickname: '—', start_number: null };
  }
  protected byRound(round: Round) {
    return this.sorted().filter((b) => b.round === round);
  }

  protected setVote(judge: Crit, v: Vote) {
    this.votes.update((s) => ({ ...s, [judge]: v }));
  }

  protected preview(b: Battle) {
    if (!this.allVoted()) return 'Ждём голоса всех трёх судей';
    const out = battleOutcome(CRITS.map((c) => this.votes()[c.key]!), b.omt_count);
    const n = (v: Vote) => CRITS.filter((c) => this.votes()[c.key] === v).length;
    if (out === 'leader') return `${n('leader')}:${n('chaser')} → победа ${this.info(b.leader_id).nickname}`;
    if (out === 'chaser') return `${n('chaser')}:${n('leader')} → победа ${this.info(b.chaser_id).nickname}`;
    if (out === 'omt') return `→ OMT ${b.omt_count + 1}/2`;
    return `→ после 2 OMT побеждает лучший по квалификации: ${this.info(b.leader_id).nickname}`;
  }

  /** Построить сетку из итогов квалификации: первый раунд + пустые следующие, баи сразу продвигаются */
  async build() {
    const size = this.size();
    const stageId = this.stageId();
    const now = new Date().toISOString();
    const rows = buildBracket(this.standings().map((r) => r.id), size, this.qualPlace()).map((r) => ({
      stage_id: stageId,
      round: r.round,
      slot: r.slot,
      leader_id: r.leader,
      chaser_id: r.chaser,
      winner_id: r.winner,
      status: r.done ? 'done' : 'pending',
      result: r.bye ? 'bye' : null,
      decided_at: r.done ? now : null,
    }));
    this.busy.set(true);
    const ins = await supabase.from('battles').insert(rows);
    const st = ins.error ? ins : await supabase.from('stages').update({ status: 'battles' }).eq('id', stageId);
    this.busy.set(false);
    if (st.error) return this.note(st.error.message, false);
    this.started.emit();
    await this.load();
    this.note(`Сетка Top ${size} построена`, true);
  }

  async submit(b: Battle) {
    const v = this.votes();
    this.busy.set(true);
    const { error } = await supabase
      .from('battle_votes')
      .upsert(CRITS.map((c) => ({ battle_id: b.id, try: b.omt_count, judge: c.key, vote: v[c.key] })));
    if (error) {
      this.busy.set(false);
      return this.note(error.message, false);
    }
    const out = battleOutcome(CRITS.map((c) => v[c.key]!), b.omt_count);
    if (out === 'omt') {
      const r = await supabase.from('battles').update({ omt_count: b.omt_count + 1, status: 'running' }).eq('id', b.id);
      this.busy.set(false);
      if (r.error) return this.note(r.error.message, false);
      this.votes.set({});
      await this.load();
      return this.note(`OMT ${b.omt_count + 1}/2 — перезаезд`, true);
    }
    const winnerSide = out === 'chaser' ? 'chaser' : 'leader';
    await this.decide(b, winnerSide, out === 'tiebreak' ? 'qual_tiebreak' : 'normal');
  }

  async techLoss(b: Battle, loser: 'leader' | 'chaser') {
    const nick = this.info(loser === 'leader' ? b.leader_id : b.chaser_id).nickname;
    if (!confirm(`Техническое поражение: ${nick}?`)) return;
    this.busy.set(true);
    await this.decide(b, loser === 'leader' ? 'chaser' : 'leader', 'tech_loss');
  }

  /** Пилот врезался в соперника — поражение (на итогах даёт ачивку «Божественное касание») */
  async contact(b: Battle, loser: 'leader' | 'chaser') {
    const nick = this.info(loser === 'leader' ? b.leader_id : b.chaser_id).nickname;
    if (!confirm(`${nick} врезался в соперника — поражение?`)) return;
    this.busy.set(true);
    await this.decide(b, loser === 'leader' ? 'chaser' : 'leader', 'contact');
  }

  /** Записать победителя и продвинуть по сетке (проигравший полуфинала — в дуэль за 3-е) */
  private async decide(b: Battle, side: 'leader' | 'chaser', result: Battle['result']) {
    const winner = side === 'leader' ? b.leader_id! : b.chaser_id!;
    const loser = side === 'leader' ? b.chaser_id! : b.leader_id!;
    const { next, third } = targetsOf(b, this.battles());
    const q = this.qualPlace();
    const results = await Promise.all([
      supabase.from('battles').update({ winner_id: winner, status: 'done', result, decided_at: new Date().toISOString() }).eq('id', b.id),
      ...(next ? [reseat(next, winner, winner, q)] : []),
      ...(third ? [reseat(third, loser, loser, q)] : []),
    ]);
    this.busy.set(false);
    const err = results.find((r) => r.error)?.error;
    if (err) return this.note(err.message, false);
    this.votes.set({});
    this.selected.set(null);
    await this.load();
    this.note(`Победа: ${this.info(winner).nickname}`, true);
  }

  /** Отменить можно, пока пары, куда ушли победитель/проигравший, ещё не начались */
  protected canUndo(b: Battle) {
    return b.result !== 'bye' && canChange(b, this.battles());
  }

  async undo(b: Battle) {
    if (!confirm('Отменить решение по этой дуэли? Голоса будут удалены.')) return;
    this.busy.set(true);
    const { next, third } = targetsOf(b, this.battles());
    const q = this.qualPlace();
    const loser = b.winner_id === b.leader_id ? b.chaser_id : b.leader_id;
    const results = await Promise.all([
      ...(next ? [reseat(next, b.winner_id, null, q)] : []),
      ...(third ? [reseat(third, loser, null, q)] : []),
      supabase.from('battle_votes').delete().eq('battle_id', b.id),
      supabase.from('battles').update({ winner_id: null, status: 'pending', result: null, decided_at: null, omt_count: 0 }).eq('id', b.id),
    ]);
    this.busy.set(false);
    const err = results.find((r) => r.error)?.error;
    if (err) return this.note(err.message, false);
    this.votes.set({});
    await this.load();
    this.note('Решение отменено', true);
  }

  async finish(again = false) {
    if (again && !confirm('Пересчитать итоги этапа заново? Места, очки и ачивки будут посчитаны с нуля по текущей сетке.')) return;
    if (this.protested().length && !confirm('Есть протесты на рассмотрении. Всё равно подвести итоги?')) return;
    this.busy.set(true);
    const err = await finishStage(this.stageId());
    this.busy.set(false);
    if (!err) this.finished.set(true);
    this.note(err ?? (again ? 'Итоги пересчитаны' : 'Итоги посчитаны, этап завершён'), !err);
  }

  async testProtest() {
    this.busy.set(true);
    const { data, error } = await supabase.functions.invoke('test-pilots', { body: { action: 'protest', stageId: this.stageId() } });
    this.busy.set(false);
    // ошибка функции приходит телом ответа (например «Время на протест истекло»)
    const text = error ? ((await (error as { context?: Response }).context?.json?.())?.error ?? error.message) : data?.error;
    this.note(text ?? 'Тестовый протест подан', !text);
    if (!text && data?.id) notify('protest', data.id);
  }

  async wipe() {
    if (!confirm('Удалить всю сетку со всеми голосами? Квалификация останется.')) return;
    this.busy.set(true);
    const { error } = await supabase.from('battles').delete().eq('stage_id', this.stageId());
    this.busy.set(false);
    if (error) return this.note(error.message, false);
    this.selected.set(null);
    await this.load();
  }

  private note(text: string, ok: boolean) {
    this.msg.set(text);
    this.ok.set(ok);
  }
}
