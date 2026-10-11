import { DatePipe } from '@angular/common';
import { Component, computed, input } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { Reveal } from '../reveal';

export interface RoadStage {
  id: number;
  ord: number;
  title: string;
  track: string | null;
  starts_at: string | null;
  status: string;
  winner: string | null;
}

// «Дорога сезона»: тонкая линия с этапами; пройденное светится, название пройденного этапа перечёркивается
@Component({
  selector: 'app-season-road',
  imports: [DatePipe, TranslocoPipe, Reveal],
  template: `
    <div class="scroller">
      <ol class="tl" reveal [style.--n]="nodes().length" [style.--fill]="fill() + '%'">
        @if (nodes().length > 1) {
          <li class="rail" aria-hidden="true"><span class="fill"></span></li>
        }
        @for (n of nodes(); track n.s.id; let i = $index) {
          <li class="st" [class]="n.state" [style.--i]="i">
            <span class="dot" aria-hidden="true">
              @if (n.state === 'done') {
                <svg viewBox="0 0 12 12" width="12" height="12"><path d="M2.5 6.2l2.3 2.3 4.7-5" /></svg>
              }
            </span>
            <span class="num mono">{{ n.s.ord < 10 ? '0' + n.s.ord : n.s.ord }}</span>
            <p class="label">
              @if (n.state === 'live') { <span class="live">● {{ 'road.live' | transloco }}</span> }
              @else if (n.state === 'next') { {{ 'road.next' | transloco }} }
              @else if (n.state === 'done') { {{ 'road.done' | transloco }} }
              @else { {{ n.s.starts_at ? (n.s.starts_at | date: 'dd.MM') : ('road.soon' | transloco) }} }
            </p>
            <h3><span class="t">{{ n.s.title }}</span></h3>
            @if (n.s.track) { <p class="track">{{ n.s.track }}</p> }
            @if (n.state === 'done' && n.s.winner) {
              <p class="winner">🏆 {{ n.s.winner }}</p>
            } @else if (n.state === 'next' && n.s.starts_at) {
              <p class="when mono">{{ n.s.starts_at | date: 'dd.MM · HH:mm' }}</p>
            }
          </li>
        }
      </ol>
    </div>
  `,
  styles: `
    .scroller { overflow-x: auto; padding: 8px var(--gutter) 16px; scrollbar-width: thin; }
    .tl {
      --col: max(180px, calc((100% - 0px) / var(--n)));
      position: relative;
      display: grid;
      grid-template-columns: repeat(var(--n), minmax(180px, 1fr));
      max-width: var(--container);
      margin: 0 auto;
      padding: 0;
      list-style: none;
    }

    /* Линия от первого до последнего этапа; бирюзовая часть дорисовывается при появлении */
    .rail {
      position: absolute;
      top: 7px;
      left: calc(100% / var(--n) / 2);
      right: calc(100% / var(--n) / 2);
      height: 1px;
      background: var(--hairline-strong);
    }
    .fill {
      position: absolute;
      inset: 0 auto 0 0;
      width: 0;
      background: linear-gradient(90deg, rgba(10, 186, 181, 0.35), var(--primary));
      box-shadow: 0 0 12px var(--primary-glow);
      transition: width 1.8s var(--ease-out) 0.2s;
    }
    /* огонёк на конце пройденного */
    .fill::after {
      content: '';
      position: absolute;
      right: -3px;
      top: -3px;
      width: 7px;
      height: 7px;
      border-radius: 50%;
      background: #fff;
      box-shadow: 0 0 8px 2px var(--primary), 0 0 24px 6px var(--primary-glow);
      opacity: 0;
      transition: opacity 0.4s 1.6s;
    }
    .tl.shown .fill { width: var(--fill); }
    .tl.shown .fill::after { opacity: 1; }
    .tl.reveal { opacity: 1; transform: none; }

    .st { position: relative; display: grid; justify-items: center; align-content: start; gap: 6px; padding: 0 12px; text-align: center; }
    .dot {
      position: relative;
      z-index: 1;
      display: grid;
      place-items: center;
      width: 15px;
      height: 15px;
      margin-bottom: 14px;
      border-radius: 50%;
      border: 1px solid var(--ink-tertiary);
      background: var(--canvas);
      transition: background-color 0.4s, border-color 0.4s;
      transition-delay: calc(0.3s + var(--i) * 0.25s);
    }
    .dot svg path { fill: none; stroke: var(--on-primary); stroke-width: 1.8; stroke-linecap: round; stroke-linejoin: round; }
    .num { font-size: 40px; line-height: 1; color: transparent; -webkit-text-stroke: 1px var(--ink-tertiary); }
    .label { margin: 4px 0 0; font-size: 11px; letter-spacing: 1.5px; text-transform: uppercase; color: var(--ink-subtle); }
    h3 { font-size: 18px; font-weight: 600; margin: 0; }
    .t { position: relative; }
    .track, .when, .winner { margin: 0; font-size: 13px; color: var(--ink-subtle); }
    .winner { color: var(--ink); font-weight: 500; }

    /* пройден: заполненная точка с галочкой, название приглушено и перечёркнуто бирюзовой линией */
    .done .dot { background: var(--primary); border-color: var(--primary); }
    .done .num { -webkit-text-stroke-color: var(--primary); opacity: 0.6; }
    .done h3 { color: var(--ink-subtle); }
    .done .t::after {
      content: '';
      position: absolute;
      left: -4px;
      right: -4px;
      top: 55%;
      height: 2px;
      background: var(--primary);
      box-shadow: 0 0 8px var(--primary-glow);
      transform: scaleX(0);
      transform-origin: left;
      transition: transform 0.6s var(--ease-out);
      transition-delay: calc(0.6s + var(--i) * 0.25s);
    }
    .tl.shown .done .t::after { transform: scaleX(1); }

    /* текущий: пульсирующее кольцо */
    .next .dot, .live .dot { border-color: var(--primary); background: var(--canvas); box-shadow: 0 0 0 4px var(--primary-soft); }
    .next .dot::after, .live .dot::after {
      content: ''; position: absolute; inset: -1px; border-radius: 50%; border: 1px solid var(--primary);
      animation: ring 2s ease-out infinite;
    }
    @keyframes ring { to { transform: scale(2.6); opacity: 0; } }
    .next .num, .live .num { color: var(--ink); -webkit-text-stroke: 0; text-shadow: 0 0 24px var(--primary-glow); }
    .next .label { color: var(--primary); }
    .st .live { color: var(--error); }
    .live .dot, .live .dot::after { border-color: var(--error); }
    .live .dot { box-shadow: 0 0 0 4px rgba(255, 92, 92, 0.15); }

    .future { opacity: 0.55; }
  `,
})
export class SeasonRoad {
  readonly stages = input.required<RoadStage[]>();

  /** Текущий этап: идущий, иначе первый незавершённый */
  private readonly currentIdx = computed(() => {
    const s = this.stages();
    const live = s.findIndex((x) => x.status === 'qualifying' || x.status === 'battles');
    if (live >= 0) return live;
    const next = s.findIndex((x) => x.status !== 'finished');
    return next >= 0 ? next : s.length - 1;
  });

  protected readonly nodes = computed(() => {
    const cur = this.currentIdx();
    return this.stages().map((s, i) => ({
      s,
      state: s.status === 'finished' ? 'done' : s.status === 'qualifying' || s.status === 'battles' ? 'live' : i === cur ? 'next' : 'future',
    }));
  });

  /** Длина бирюзовой части линии — до текущего этапа */
  protected readonly fill = computed(() => {
    const segs = this.stages().length - 1;
    return segs > 0 ? (this.currentIdx() / segs) * 100 : 0;
  });
}
