import { Component, computed, input, output, signal } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { supabase } from '../auth';
import { countsFor, myPick, PredictionCount, rememberPick, RUN_PICK_LABEL, RUN_PICKS, voterId } from '../predict';

// Прогноз зрителей в блоке эфира: квалификация — сколько наберёт пилот на трассе, парные — кто победит.
// До голоса — кнопки, после — распределение голосов (свой вариант подсвечен). Голос один, закрывается с оценкой судей.
@Component({
  selector: 'app-prediction-poll',
  imports: [TranslocoPipe],
  template: `
    <div class="poll">
      <div class="head">
        <p class="lbl">{{ 'poll.title' | transloco }}</p>
        <span class="mono votes">{{ 'poll.votes' | transloco: { n: total() } }}</span>
      </div>
      <p class="q">
        @if (battleId()) { {{ 'poll.battle' | transloco }} } @else { {{ 'poll.run' | transloco: { name: pilotName(), n: attempt() } }} }
      </p>
      @if (!mine()) {
        <div class="opts" [class.two]="!!battleId()">
          @for (o of options(); track o.k) {
            <button type="button" class="opt" (click)="vote(o.k)" [disabled]="busy()" [title]="o.label">{{ o.label }}</button>
          }
        </div>
      } @else {
        <div class="bars">
          @for (o of options(); track o.k) {
            <div class="bar" [class.mine]="mine() === o.k">
              <span class="k" [title]="o.label">{{ o.label }}</span>
              <span class="track"><span class="fill" [style.width.%]="pct(o.k)"></span></span>
              <span class="mono v">{{ pct(o.k) }}%</span>
            </div>
          }
        </div>
        <p class="note">✓ {{ 'poll.mine' | transloco }}</p>
      }
      @if (error()) { <p class="err">{{ error() | transloco }}</p> }
    </div>
  `,
  styles: `
    .poll { display: grid; gap: 10px; padding-top: 16px; margin-top: 16px; border-top: 1px solid var(--hairline); }
    .head { display: flex; justify-content: space-between; align-items: baseline; gap: 8px; }
    .lbl { margin: 0; font-size: 11px; letter-spacing: 2px; text-transform: uppercase; color: var(--primary); }
    .votes { font-size: 12px; color: var(--ink-subtle); }
    .q { margin: 0; font-size: 14px; font-weight: 500; }
    .opts { display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px; }
    .opts.two { grid-template-columns: 1fr 1fr; }
    .opt {
      padding: 9px 6px; border: 1px solid var(--hairline-strong); border-radius: var(--r-sm); background: var(--surface-2);
      color: var(--ink); font: 600 14px var(--mono); cursor: pointer; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
      transition: border-color var(--fast), background-color var(--fast), translate var(--fast);
      &:hover:not(:disabled) { border-color: var(--primary); background: rgba(var(--accent-rgb), 0.12); }
      &:active:not(:disabled) { translate: 0 1px; }
      &:disabled { opacity: 0.6; cursor: default; }
    }
    .two .opt { font-family: var(--font); }
    .bars { display: grid; gap: 6px; }
    .bar { display: grid; grid-template-columns: minmax(44px, 34%) 1fr 44px; align-items: center; gap: 8px; font-size: 13px; }
    .k { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--ink-muted); font-family: var(--mono); }
    .track { height: 8px; border-radius: 4px; background: var(--surface-3); overflow: hidden; }
    .fill { display: block; height: 100%; border-radius: 4px; background: var(--ink-subtle); transition: width 600ms var(--ease-out); }
    .v { text-align: right; color: var(--ink-muted); }
    .mine .k, .mine .v { color: var(--primary); }
    .mine .fill { background: var(--primary); box-shadow: 0 0 10px var(--primary-glow); }
    .note { margin: 0; font-size: 12px; color: var(--primary); }
    .err { margin: 0; font-size: 12px; color: var(--error); }
    @media (prefers-reduced-motion: reduce) { .fill { transition: none; } }
  `,
})
export class PredictionPoll {
  readonly stageId = input.required<number>();
  /** квалификация: пилот на трассе и попытка */
  readonly pilotId = input<string | null>(null);
  readonly attempt = input<number | null>(null);
  readonly pilotName = input('');
  /** парные: дуэль и ники пары */
  readonly battleId = input<number | null>(null);
  readonly leaderName = input('');
  readonly chaserName = input('');
  /** итоги голосования этапа (грузит и обновляет родитель) */
  readonly counts = input.required<PredictionCount[]>();
  readonly voted = output<void>();

  protected readonly busy = signal(false);
  protected readonly error = signal<string | null>(null);
  /** голоса, отданные в этой вкладке (до перезагрузки — плюс localStorage) */
  private readonly picked = signal<Record<string, string>>({});

  private readonly key = computed(() => (this.battleId() ? `b${this.battleId()}` : `r${this.stageId()}-${this.pilotId()}-${this.attempt()}`));
  protected readonly mine = computed(() => this.picked()[this.key()] ?? myPick(this.key()));
  protected readonly options = computed(() =>
    this.battleId()
      ? [
          { k: 'leader', label: this.leaderName() },
          { k: 'chaser', label: this.chaserName() },
        ]
      : RUN_PICKS.map((k) => ({ k: k as string, label: RUN_PICK_LABEL[k] })),
  );
  private readonly mapped = computed(() => {
    const b = this.battleId();
    return countsFor(this.counts(), b ? { battleId: b } : { profileId: this.pilotId() ?? '', attempt: this.attempt() ?? 0 });
  });
  protected readonly total = computed(() => [...this.mapped().values()].reduce((s, n) => s + n, 0));

  protected pct(k: string) {
    const t = this.total();
    return t ? Math.round(((this.mapped().get(k) ?? 0) / t) * 100) : 0;
  }

  async vote(pick: string) {
    if (this.busy()) return;
    this.busy.set(true);
    this.error.set(null);
    const b = this.battleId();
    const { error } = await supabase.from('predictions').insert({
      stage_id: this.stageId(),
      battle_id: b,
      profile_id: b ? null : this.pilotId(),
      attempt: b ? null : this.attempt(),
      pick,
      voter: voterId(),
    });
    this.busy.set(false);
    // 23505 — уже голосовали с этого браузера (например, в другой вкладке): просто показываем итоги
    if (error && error.code !== '23505') return this.error.set(/закрыто/i.test(error.message) ? 'poll.closed' : 'poll.error');
    rememberPick(this.key(), pick);
    this.picked.update((m) => ({ ...m, [this.key()]: pick }));
    this.voted.emit();
  }
}
