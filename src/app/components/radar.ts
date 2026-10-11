import { Component, computed, input } from '@angular/core';

const R = 100; // радиус «паутинки»
const C = 130; // центр в viewBox 260×260
// оси: угол — вверх, стиль — вправо-вниз, траектория — влево-вниз
const AXES = [-90, 30, 150].map((deg) => (deg * Math.PI) / 180);
const pt = (a: number, r: number) => `${(C + Math.cos(a) * r).toFixed(1)},${(C + Math.sin(a) * r).toFixed(1)}`;

// «Паутинка» навыков: угол / стиль / траектория в % от максимума
@Component({
  selector: 'app-radar',
  template: `
    <svg viewBox="0 0 260 260" role="img" [attr.aria-label]="labels()[0] + ' ' + values()[0] + '%, ' + labels()[1] + ' ' + values()[1] + '%, ' + labels()[2] + ' ' + values()[2] + '%'">
      @for (lvl of [0.25, 0.5, 0.75, 1]; track lvl) {
        <polygon class="grid" [attr.points]="ring(lvl)" />
      }
      @for (a of axes; track $index) {
        <line class="axis" [attr.x1]="c" [attr.y1]="c" [attr.x2]="end(a).x" [attr.y2]="end(a).y" />
      }
      <polygon class="shape" [attr.points]="shape()" />
      @for (p of dots(); track $index) {
        <circle class="dot" [attr.cx]="p.x" [attr.cy]="p.y" r="4" />
      }
      @for (a of axes; track $index; let i = $index) {
        <text class="lbl" [attr.x]="label(a).x" [attr.y]="label(a).y" text-anchor="middle">
          <tspan class="name">{{ labels()[i] }}</tspan>
          <tspan class="val" [attr.x]="label(a).x" dy="16">{{ values()[i] }}%</tspan>
        </text>
      }
    </svg>
  `,
  styles: `
    :host { display: block; }
    svg { width: 100%; max-width: 320px; display: block; margin: 0 auto; overflow: visible; }
    .grid { fill: none; stroke: var(--hairline-strong); stroke-width: 1; }
    .axis { stroke: var(--hairline-strong); stroke-width: 1; }
    .shape {
      fill: rgba(10, 186, 181, 0.22); stroke: var(--primary); stroke-width: 2; stroke-linejoin: round;
      filter: drop-shadow(0 0 12px var(--primary-glow));
      transform-origin: 130px 130px; animation: grow 900ms var(--ease-out) both;
    }
    .dot { fill: var(--primary); animation: grow 900ms var(--ease-out) both; transform-origin: 130px 130px; }
    @keyframes grow { from { transform: scale(0); opacity: 0; } }
    .lbl { font-family: var(--font); }
    .name { fill: var(--ink-subtle); font-size: 11px; letter-spacing: 1px; text-transform: uppercase; }
    .val { fill: var(--ink); font-family: var(--mono); font-size: 14px; }
  `,
})
export class Radar {
  /** [угол, стиль, траектория] в % */
  readonly values = input.required<number[]>();
  readonly labels = input<string[]>(['Угол', 'Стиль', 'Траектория']);
  protected readonly axes = AXES;
  protected readonly c = C;

  protected ring(lvl: number) {
    return AXES.map((a) => pt(a, R * lvl)).join(' ');
  }
  protected end(a: number) {
    return { x: C + Math.cos(a) * R, y: C + Math.sin(a) * R };
  }
  protected label(a: number) {
    const r = R + 24;
    return { x: C + Math.cos(a) * r, y: C + Math.sin(a) * r - (Math.sin(a) < 0 ? 12 : -4) };
  }
  protected readonly shape = computed(() => AXES.map((a, i) => pt(a, (R * Math.min(100, this.values()[i] ?? 0)) / 100)).join(' '));
  protected readonly dots = computed(() =>
    AXES.map((a, i) => {
      const r = (R * Math.min(100, this.values()[i] ?? 0)) / 100;
      return { x: C + Math.cos(a) * r, y: C + Math.sin(a) * r };
    }),
  );
}
