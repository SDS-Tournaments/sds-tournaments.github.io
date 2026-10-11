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

const STEP = 280; // расстояние между чекпоинтами
const PAD = 140; // отступ до первого/после последнего
const UP = 70; // y «верхнего» поворота дороги
const DOWN = 150; // y «нижнего»
const ROAD_TOP = 110; // где начинается полоса дороги в блоке
const ROAD_H = 220;

// «Дорога сезона»: серпантин с этапами-чекпоинтами; пройденное — в следах шин, машинка доезжает до текущего этапа
@Component({
  selector: 'app-season-road',
  imports: [DatePipe, TranslocoPipe, Reveal],
  template: `
    <div class="scroller">
      <div class="road" reveal [style.width.px]="width()" [style.--to]="carAt() + '%'">
        <svg class="asphalt" [attr.width]="width()" [attr.height]="roadH" [attr.viewBox]="'0 0 ' + width() + ' ' + roadH" aria-hidden="true">
          <defs>
            <filter id="glow"><feGaussianBlur stdDeviation="6" /></filter>
          </defs>
          <!-- выезд со старта -->
          <path [attr.d]="'M 0 ' + nodes()[0].y + ' L ' + nodes()[0].x + ' ' + nodes()[0].y" class="tar" />
          <path [attr.d]="path()" class="tar" />
          <path [attr.d]="path()" class="edge" />
          <path [attr.d]="path()" class="center" />
          <!-- пройденный участок: свечение + следы шин -->
          <path [attr.d]="path()" pathLength="100" class="trail-glow" [style.stroke-dasharray]="donePct() + ' 100'" filter="url(#glow)" />
          <path [attr.d]="path()" pathLength="100" class="tires" [style.stroke-dasharray]="donePct() + ' 100'" />
          <path [attr.d]="path()" pathLength="100" class="tires-gap" [style.stroke-dasharray]="donePct() + ' 100'" />
          @for (n of nodes(); track n.s.id) {
            <g class="node" [class]="n.state" [attr.transform]="'translate(' + n.x + ' ' + n.y + ')'">
              <circle r="15" />
              @if (n.state === 'done') {
                <!-- клетчатый флажок -->
                <rect x="-7" y="-7" width="7" height="7" /><rect x="0" y="0" width="7" height="7" />
              } @else {
                <text dy="5" text-anchor="middle">{{ n.s.ord }}</text>
              }
            </g>
          }
        </svg>

        @if (nodes().length > 1) {
          <div class="car" [style.offset-path]="carPath()" aria-hidden="true">
            <svg viewBox="0 0 44 22" width="58" height="29">
              <rect x="2" y="2" width="40" height="18" rx="6" class="body" />
              <rect x="22" y="4" width="10" height="14" rx="3" class="glass" />
              <rect x="0" y="1" width="4" height="20" rx="1" class="wing" />
            </svg>
            <i class="puff"></i><i class="puff two"></i>
          </div>
        }

        @for (n of nodes(); track n.s.id; let i = $index) {
          <article class="card stage" [class]="n.state" [class.above]="n.y === up" [style.left.px]="n.x - 110" [style.--i]="i">
            @if (n.state === 'done') { <span class="stamp mono">{{ 'road.done' | transloco }}</span> }
            <p class="eyebrow">
              @if (n.state === 'live') { <span class="dot"></span>{{ 'road.live' | transloco }} }
              @else if (n.state === 'next') { {{ 'road.next' | transloco }} }
              @else { {{ 'road.stage' | transloco: { n: n.s.ord } }} }
            </p>
            <h3>{{ n.s.title }}</h3>
            @if (n.s.track) { <p class="track subtle">{{ n.s.track }}</p> }
            @if (n.state === 'done') {
              <p class="winner">🏆 {{ n.s.winner ?? '—' }}</p>
            } @else {
              <p class="date mono">{{ n.s.starts_at ? (n.s.starts_at | date: 'dd.MM · HH:mm') : ('road.soon' | transloco) }}</p>
            }
          </article>
        }
      </div>
    </div>
  `,
  styles: `
    .scroller {
      overflow-x: auto;
      padding: 8px 0 16px;
      mask-image: linear-gradient(90deg, transparent, #000 4%, #000 96%, transparent);
      scrollbar-width: thin;
    }
    .road { position: relative; height: 440px; margin: 0 auto; }
    .asphalt { position: absolute; left: 0; top: ${ROAD_TOP}px; overflow: visible; }
    path { fill: none; stroke-linecap: round; }
    .tar { stroke: #141414; stroke-width: 34; }
    .edge { stroke: var(--hairline-strong); stroke-width: 36; opacity: 0.6; mix-blend-mode: screen; stroke-dasharray: 2 18; }
    .center { stroke: rgba(255, 255, 255, 0.18); stroke-width: 2; stroke-dasharray: 10 14; }
    .trail-glow { stroke: var(--primary); stroke-width: 30; opacity: 0.25; }
    /* две полосы от покрышек: тёмная широкая + узкая «щель» цвета асфальта посередине */
    .tires { stroke: #050505; stroke-width: 18; opacity: 0.95; }
    .tires-gap { stroke: #1b1b1b; stroke-width: 8; }

    .node circle { fill: var(--surface-1); stroke: var(--hairline-strong); stroke-width: 2; stroke-dasharray: 4 4; }
    .node text { fill: var(--ink-subtle); font: 600 13px var(--mono); }
    .node.done circle { fill: #f5f5f5; stroke: var(--primary); stroke-dasharray: none; }
    .node.done rect { fill: #000; }
    .node.next circle, .node.live circle { fill: var(--primary); stroke: var(--primary); stroke-dasharray: none; filter: drop-shadow(0 0 10px var(--primary)); }
    .node.next text, .node.live text { fill: var(--on-primary); }

    /* Машинка едет по той же кривой до текущего этапа */
    .car {
      position: absolute;
      left: 0;
      top: ${ROAD_TOP}px;
      offset-rotate: auto;
      offset-distance: var(--to);
      animation: drive 2.6s cubic-bezier(0.45, 0, 0.2, 1) both paused;
      filter: drop-shadow(0 0 10px var(--primary-glow));
    }
    .road.shown .car { animation-play-state: running; }
    @keyframes drive { from { offset-distance: 0%; } to { offset-distance: var(--to); } }
    .car .body { fill: var(--primary); }
    .car .glass { fill: #062a29; }
    .car .wing { fill: #0a0a0a; }
    .puff {
      position: absolute; left: -18px; top: -4px; width: 26px; height: 26px; border-radius: 50%;
      background: radial-gradient(circle, rgba(220, 245, 244, 0.5), transparent 70%); filter: blur(4px);
      animation: puff 0.9s ease-out infinite;
    }
    .puff.two { animation-delay: 0.45s; top: 2px; }
    @keyframes puff { from { transform: scale(0.4); opacity: 0.9; } to { transform: translateX(-26px) scale(1.6); opacity: 0; } }
    .road:not(.shown) .puff { animation: none; opacity: 0; }

    /* Карточки этапов — над или под поворотом */
    .stage {
      position: absolute;
      width: 220px;
      padding: 16px 18px;
      bottom: 0;
      overflow: hidden;
      display: grid;
      gap: 4px;
      transition: transform var(--base) var(--ease-out), border-color var(--base);
      h3 { font-size: 17px; }
      p { margin: 0; }
      &:hover { transform: translateY(-4px); }
    }
    .stage.above { top: 0; bottom: auto; }
    .eyebrow { display: flex; align-items: center; gap: 6px; font-size: 11px; }
    .track { font-size: 13px; }
    .date { font-size: 13px; color: var(--ink-muted); }
    .winner { font-size: 14px; font-weight: 600; }

    .stage.future { border-style: dashed; background: transparent; opacity: 0.6; }
    .stage.next, .stage.live { border-color: var(--primary); box-shadow: 0 0 32px -12px var(--primary-glow); }
    .stage.live .eyebrow { color: var(--error); }
    .dot { width: 7px; height: 7px; border-radius: 50%; background: var(--error); animation: blink 1.4s ease-in-out infinite; }
    @keyframes blink { 50% { opacity: 0.2; } }

    /* Пройденный этап: финишная клетка сверху, штамп и следы шин поперёк карточки */
    .stage.done { padding-top: 22px; }
    .stage.done::before {
      content: ''; position: absolute; inset: 0 0 auto; height: 8px;
      background: repeating-conic-gradient(#f5f5f5 0 25%, #000 0 50%) 0 0 / 8px 8px;
      opacity: 0.85;
    }
    .stage.done::after {
      content: ''; position: absolute; left: -20%; right: -20%; top: 48%; height: 26px;
      background: linear-gradient(transparent 0 2px, rgba(0, 0, 0, 0.75) 2px 9px, transparent 9px 17px, rgba(0, 0, 0, 0.75) 17px 24px, transparent 24px);
      transform: rotate(-14deg);
      filter: blur(0.6px);
      pointer-events: none;
      z-index: 0;
    }
    /* текст поверх следов шин */
    .stage.done > * { position: relative; z-index: 1; }
    .stage.done > .stamp { position: absolute; }
    .stage.done h3, .stage.done .track { color: var(--ink-muted); }
    .stamp {
      position: absolute; right: 10px; top: 16px; padding: 2px 8px; border: 2px solid var(--primary); border-radius: 4px;
      color: var(--primary); font-size: 11px; font-weight: 600; letter-spacing: 1.5px; transform: rotate(8deg); opacity: 0.9;
    }

    @media (prefers-reduced-motion: reduce) {
      .car { animation: none; }
      .puff { display: none; }
    }
  `,
})
export class SeasonRoad {
  readonly stages = input.required<RoadStage[]>();
  protected readonly up = UP;
  protected readonly roadH = ROAD_H;

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
    return this.stages().map((s, i) => {
      const state =
        s.status === 'finished' ? 'done' : s.status === 'qualifying' || s.status === 'battles' ? 'live' : i === cur ? 'next' : 'future';
      return { s, state, x: PAD + i * STEP, y: i % 2 ? DOWN : UP };
    });
  });

  protected readonly width = computed(() => PAD * 2 + Math.max(0, this.stages().length - 1) * STEP);

  /** Серпантин: между соседними чекпоинтами плавная S-кривая (все участки одинаковой длины) */
  protected readonly path = computed(() => {
    const n = this.nodes();
    if (!n.length) return '';
    let d = `M ${n[0].x} ${n[0].y}`;
    for (let i = 1; i < n.length; i++) {
      const a = n[i - 1];
      const b = n[i];
      d += ` C ${a.x + STEP / 2} ${a.y} ${b.x - STEP / 2} ${b.y} ${b.x} ${b.y}`;
    }
    return d;
  });

  protected readonly carPath = computed(() => `path('${this.path()}')`);

  /** Куда доезжает машинка (в % длины пути) — участки равны, поэтому % = индекс / (число участков) */
  protected readonly carAt = computed(() => {
    const segs = this.stages().length - 1;
    if (segs <= 0) return 0;
    // останавливаемся чуть раньше чекпоинта — «подъезжаем», не закрывая его
    return Math.max(0, (this.currentIdx() / segs) * 100 - 14 / segs);
  });

  /** Сколько дороги «пройдено» — до последнего завершённого этапа */
  protected readonly donePct = computed(() => {
    const segs = this.stages().length - 1;
    const lastDone = this.stages().reduce((m, s, i) => (s.status === 'finished' ? i : m), -1);
    return segs > 0 && lastDone >= 0 ? (lastDone / segs) * 100 : 0;
  });
}
