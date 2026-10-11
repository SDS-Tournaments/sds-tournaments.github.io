import { NgTemplateOutlet } from '@angular/common';
import { Component, computed, input, output } from '@angular/core';
import type { Round } from '../scoring/scoring';

export interface TreeBattle {
  id: number;
  round: Round;
  slot: number;
  leader_id: string | null;
  chaser_id: string | null;
  winner_id: string | null;
  omt_count: number;
  status: string;
  result: string | null;
}
export interface TreePilot {
  nickname: string;
  start_number: number | null;
}

const ORDER: Round[] = ['r32', 'r16', 'qf', 'sf', 'third', 'final'];

// Дерево сетки с линиями (пульт судьи и страница этапа)
@Component({
  selector: 'app-bracket-tree',
  imports: [NgTemplateOutlet],
  template: `
    <div class="scroll">
      <!-- пара раунда i занимает 2^(i+1) строк — и встаёт ровно между своими «кормильцами» -->
      <div class="tree" [style.--cols]="tree().length" [style.--rows]="treeRows()">
        @for (r of tree(); track r.round; let i = $index) {
          <h3 class="rtitle" [style.grid-column]="i + 1">{{ labels()[r.round] }}</h3>
          @for (b of r.battles; track b.id) {
            <div
              class="cell"
              [class.out]="r.round !== 'final'"
              [class.in]="i > 0"
              [class.even]="b.slot % 2 === 0"
              [class.lit]="b.status === 'done' && b.winner_id"
              [style.grid-column]="i + 1"
              [style.grid-row]="2 + b.slot * r.span + ' / span ' + r.span"
            >
              <ng-container [ngTemplateOutlet]="match" [ngTemplateOutletContext]="{ $implicit: b }" />
            </div>
          }
        }
      </div>
    </div>
    @if (third(); as t) {
      <div class="third">
        <h3 class="rtitle">{{ labels().third }}</h3>
        <ng-container [ngTemplateOutlet]="match" [ngTemplateOutletContext]="{ $implicit: t }" />
      </div>
    }

    <ng-template #match let-b>
      <button
        type="button"
        class="match"
        [class.cur]="b.id === currentId()"
        [class.done]="b.status === 'done'"
        [class.bye]="b.result === 'bye'"
        [class.static]="!clickable()"
        [disabled]="!clickable()"
        (click)="pick.emit(b.id)"
      >
        @for (pid of [b.leader_id, b.chaser_id]; track $index) {
          <span class="slotp" [class.win]="pid && pid === b.winner_id" [class.lose]="b.winner_id && pid !== b.winner_id">
            <span class="mono n">{{ pid ? (info(pid).start_number ?? '—') : '' }}</span>
            <span class="nm">{{ pid ? info(pid).nickname : (b.result === 'bye' && $index === 1 ? 'bye' : '…') }}</span>
          </span>
        }
        @if (b.omt_count && b.status !== 'done') { <span class="omt-dot mono">OMT {{ b.omt_count }}</span> }
        @if (flags()[b.id]; as f) { <span class="flag mono">{{ f }}</span> }
      </button>
    </ng-template>
  `,
  styles: `
    :host { display: block; }
    .scroll { overflow-x: auto; padding-bottom: 8px; }
    /* колонки по 168px, между ними 40px под линии: 20px «выход» + 20px «вход» */
    .tree {
      --line: var(--hairline-strong);
      display: grid;
      grid-template-columns: repeat(var(--cols), 168px);
      grid-template-rows: 28px repeat(var(--rows), 34px);
      column-gap: 40px;
      width: max-content;
    }
    .rtitle { font-size: 11px; letter-spacing: 1px; text-transform: uppercase; color: var(--ink-subtle); font-weight: 500; margin: 0; grid-row: 1; }
    .cell { position: relative; display: flex; align-items: center; }
    .cell > .match { width: 100%; }
    .cell.out::after { content: ''; position: absolute; left: 100%; top: 50%; width: 20px; border-top: 1px solid var(--line); }
    .cell.out::before { content: ''; position: absolute; left: calc(100% + 20px); border-left: 1px solid var(--line); }
    .cell.out.even::before { top: 50%; height: 50%; }
    .cell.out:not(.even)::before { top: 0; height: 50%; }
    .cell.in > .match::before { content: ''; position: absolute; right: 100%; top: 50%; width: 21px; border-top: 1px solid var(--line); }
    .cell.lit::after, .cell.lit::before { border-color: var(--primary); }
    .third { display: grid; gap: 8px; width: 168px; margin: 24px 0 0 auto; }

    .match {
      position: relative; display: grid; gap: 1px; padding: 0; border: 1px solid var(--hairline-strong); border-radius: var(--r-sm);
      background: var(--hairline); cursor: pointer; text-align: left; font: inherit; color: inherit;
      &.cur { border-color: var(--primary); box-shadow: 0 0 16px -4px var(--primary-glow); }
      &:hover:not(.static) { border-color: var(--primary); }
      &.bye { opacity: 0.6; }
      &.static { cursor: default; }
    }
    .match > .slotp:first-of-type { border-radius: 3px 3px 0 0; }
    .match > .slotp:last-of-type { border-radius: 0 0 3px 3px; }
    .slotp { display: flex; gap: 6px; padding: 5px 8px; background: var(--surface-1); color: var(--ink); font-size: 12px; }
    .slotp .n { color: var(--primary); min-width: 24px; }
    .slotp .nm { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .slotp.win { background: var(--primary-soft); font-weight: 600; }
    .slotp.lose { color: var(--ink-tertiary); }
    .omt-dot { position: absolute; right: 4px; top: 4px; font-size: 9px; color: var(--warning); }
    .flag { position: absolute; right: 4px; bottom: 4px; font-size: 9px; padding: 0 4px; border-radius: 3px; background: var(--warning); color: #000; }
  `,
})
export class BracketTree {
  readonly battles = input.required<TreeBattle[]>();
  readonly pilots = input.required<Map<string, TreePilot>>();
  readonly labels = input.required<Record<Round, string>>();
  readonly currentId = input<number | null>(null);
  readonly clickable = input(false);
  /** пометки на парах: id → текст («протест», «ждёт») */
  readonly flags = input<Record<number, string>>({});
  readonly pick = output<number>();

  private readonly sorted = computed(() => [...this.battles()].sort((a, b) => ORDER.indexOf(a.round) - ORDER.indexOf(b.round) || a.slot - b.slot));
  /** раунды дерева (без дуэли за 3-е); span — сколько строк сетки занимает пара: 2, 4, 8… */
  protected readonly tree = computed(() =>
    ORDER.filter((r) => r !== 'third')
      .map((round) => this.sorted().filter((b) => b.round === round))
      .filter((battles) => battles.length)
      .map((battles, i) => ({ round: battles[0].round, battles, span: 2 ** (i + 1) })),
  );
  protected readonly treeRows = computed(() => (this.tree()[0]?.battles.length ?? 0) * 2);
  protected readonly third = computed(() => this.battles().find((b) => b.round === 'third') ?? null);

  protected info(pid: string | null): TreePilot {
    return (pid && this.pilots().get(pid)) || { nickname: '—', start_number: null };
  }
}
