import { DatePipe } from '@angular/common';
import { Component, computed, DestroyRef, inject, input, signal } from '@angular/core';
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

const DAY = 86_400_000;
/** Обычный промежуток между этапами — для отсчёта, если у пройденного этапа нет даты */
const GAP = 30 * DAY;
/** Огонёк всегда хотя бы на 20% участка — видно, что едем к следующему этапу */
const MIN_POS = 0.2;
const isLive = (s: { status: string }) => s.status === 'qualifying' || s.status === 'battles';

/**
 * Где огонёк на линии и насколько он «горячий».
 * Между последним пройденным и следующим этапом — по доле прошедшего времени между их датами,
 * но не ближе 20% участка к пройденному; в день старта (и во время этапа) — на самом этапе, жар = 1.
 * Нет даты у предыдущего — отсчёт за 30 дней до старта.
 * fill — % длины линии, heat — 0..1.
 */
export function roadProgress(stages: { status: string; starts_at: string | null }[], now: number): { fill: number; heat: number } {
  const segs = stages.length - 1;
  const pct = (pos: number) => (segs > 0 ? (pos / segs) * 100 : 0);
  const live = stages.findIndex(isLive);
  if (live >= 0) return { fill: pct(live), heat: 1 };
  const next = stages.findIndex((s) => s.status !== 'finished');
  if (next < 0) return { fill: 100, heat: 0 };

  const at = (i: number) => (i >= 0 && stages[i].starts_at ? Date.parse(stages[i].starts_at!) : NaN);
  const nextAt = at(next);
  const prevAt = at(next - 1);
  const clamp = (x: number) => Math.min(1, Math.max(0, x));
  // доля времени → позиция на участке: плавно от MIN_POS до конца
  const seat = (t: number) => MIN_POS + (1 - MIN_POS) * t;
  if (Number.isNaN(nextAt)) return { fill: next === 0 ? 0 : pct(next - 1 + MIN_POS), heat: 0 };
  if (now >= nextAt) return { fill: pct(next), heat: 1 };
  // У предыдущего этапа нет даты — считаем, что он был за обычный промежуток до следующего
  const from = !Number.isNaN(prevAt) && prevAt < nextAt ? prevAt : nextAt - GAP;
  const t = clamp((now - from) / (nextAt - from));
  // первый этап сезона: до него ехать неоткуда — стоим на старте, только краснеем
  if (next === 0) return { fill: 0, heat: t };
  return { fill: pct(next - 1 + seat(t)), heat: t };
}

// «Дорога сезона»: тонкая линия с этапами; пройденное светится, название пройденного этапа перечёркивается
@Component({
  selector: 'app-season-road',
  imports: [DatePipe, TranslocoPipe, Reveal],
  template: `
    <div class="scroller">
      <ol class="tl" reveal [style.--n]="nodes().length" [style.--fill]="fill() + '%'" [style.--heat]="heat() * 100 + '%'" [style.--heat-n]="heat()" [style.--pulse]="2 - heat() * 1.3 + 's'">
        @if (nodes().length > 1) {
          <li class="rail" aria-hidden="true"><span class="fill"></span></li>
        }
        @for (n of nodes(); track n.s.id; let i = $index) {
          @if (n.state === 'origin') {
            <li class="st origin" [style.--i]="i">
              <span class="dot" aria-hidden="true"></span>
              <span class="flag" aria-hidden="true">◆</span>
              <p class="label">{{ 'road.start' | transloco }}</p>
            </li>
          } @else {
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
        }
      </ol>
    </div>
  `,
  styles: `
    /* запас сверху — под расходящиеся кольца (overflow-x обрезает и по вертикали) */
    .scroller { overflow-x: auto; padding: 32px var(--gutter) 16px; scrollbar-width: thin; }
    .tl {
      /* «жар» приближения этапа: бирюзовый → красный */
      /* через синий и фиолетовый неон, без серой середины */
      --hot: color-mix(in oklch longer hue, var(--primary), var(--error) var(--heat, 0%));
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
      background: linear-gradient(90deg, rgba(var(--accent-rgb), 0.35), var(--primary) 60%, var(--hot));
      box-shadow: 0 0 12px color-mix(in oklab, var(--hot), transparent 55%);
      transition: width 1.8s var(--ease-out) 0.2s;
    }
    /* огонёк на конце пройденного */
    .fill::after {
      content: '';
      position: absolute;
      right: -4px;
      top: -4px;
      width: 9px;
      height: 9px;
      border-radius: 50%;
      background: #fff;
      /* чем ближе этап, тем краснее и ярче */
      box-shadow:
        0 0 8px 2px var(--hot),
        0 0 calc(18px + 24px * var(--heat-n, 0)) calc(4px + 8px * var(--heat-n, 0)) color-mix(in oklab, var(--hot), transparent 50%);
      animation: flicker 1.6s ease-in-out infinite;
      opacity: 0;
      transition: opacity 0.4s 1.6s;
    }
    @keyframes flicker { 50% { transform: scale(0.8); } }
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

    /* текущий: пульсирующее кольцо; цвет и частота — по «жару» приближения */
    .next .dot, .live .dot { border-color: var(--hot); background: var(--canvas); box-shadow: 0 0 0 4px color-mix(in oklab, var(--hot), transparent 85%); }
    .next .dot::after, .live .dot::after {
      content: ''; position: absolute; inset: -1px; border-radius: 50%; border: 1px solid var(--hot);
      animation: ring var(--pulse, 2s) ease-out infinite;
    }
    @keyframes ring { to { transform: scale(2.6); opacity: 0; } }
    .next .num, .live .num { color: var(--ink); -webkit-text-stroke: 0; text-shadow: 0 0 24px color-mix(in oklab, var(--hot), transparent 50%); }
    .next .label { color: var(--hot); }
    .st .live { color: var(--error); }

    .future { opacity: 0.55; }

    /* точка отсчёта: «Начало сезона» — от неё огонёк едет к первому этапу */
    .origin .dot { background: var(--primary); border-color: var(--primary); box-shadow: 0 0 10px var(--primary-glow); }
    .origin .flag { font-size: 28px; line-height: 40px; color: var(--primary); text-shadow: 0 0 18px var(--primary-glow); }
    .origin .label { color: var(--primary); }
  `,
})
export class SeasonRoad {
  readonly stages = input.required<RoadStage[]>();

  /** Дорога = «Начало сезона» + этапы. Старт считается пройденным, без даты — отсчёт к первому этапу за 30 дней */
  private readonly road = computed<RoadStage[]>(() =>
    this.stages().length ? [{ id: -1, ord: 0, title: '', track: null, starts_at: null, status: 'finished', winner: null }, ...this.stages()] : [],
  );

  /** Текущий этап: идущий, иначе первый незавершённый */
  private readonly currentIdx = computed(() => {
    const s = this.road();
    const live = s.findIndex((x) => x.status === 'qualifying' || x.status === 'battles');
    if (live >= 0) return live;
    const next = s.findIndex((x) => x.status !== 'finished');
    return next >= 0 ? next : s.length - 1;
  });

  protected readonly nodes = computed(() => {
    const cur = this.currentIdx();
    return this.road().map((s, i) => ({
      s,
      state: s.id === -1 ? 'origin' : s.status === 'finished' ? 'done' : s.status === 'qualifying' || s.status === 'battles' ? 'live' : i === cur ? 'next' : 'future',
    }));
  });

  /** Время идёт — огонёк ползёт к следующему этапу (пересчёт раз в минуту) */
  private readonly now = signal(Date.now());
  private readonly progress = computed(() => roadProgress(this.road(), this.now()));
  protected readonly fill = computed(() => this.progress().fill);
  protected readonly heat = computed(() => this.progress().heat);

  constructor() {
    const id = setInterval(() => this.now.set(Date.now()), 60_000);
    inject(DestroyRef).onDestroy(() => clearInterval(id));
  }
}
