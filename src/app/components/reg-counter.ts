import { Component, computed, effect, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';

// Кольцо «зарегистрировано N из 32» для ближайшего этапа
@Component({
  selector: 'app-reg-counter',
  imports: [RouterLink, TranslocoPipe],
  template: `
    <div class="ring">
      <svg viewBox="0 0 200 200" aria-hidden="true">
        <circle class="track" cx="100" cy="100" r="88" />
        <circle class="fill" cx="100" cy="100" r="88" pathLength="100" [style.stroke-dasharray]="fill() + ' 100'" />
        @for (t of ticks; track t) {
          <line x1="100" y1="4" x2="100" y2="10" [attr.transform]="'rotate(' + t * 11.25 + ' 100 100)'" />
        }
      </svg>
      <div class="center">
        <span class="num mono">{{ count() === null ? '—' : shown() }}</span>
        <span class="of mono">/ {{ slots() }}</span>
      </div>
    </div>
    <p class="lbl">{{ 'home.reg.label' | transloco }}</p>
    @if (stage(); as s) {
      <p class="stage">{{ s }}</p>
      <a routerLink="/me" class="btn btn-secondary">{{ 'home.reg.cta' | transloco }}</a>
    } @else {
      <p class="stage subtle">{{ 'home.reg.soon' | transloco }}</p>
    }
  `,
  styles: `
    :host {
      display: grid;
      justify-items: center;
      text-align: center;
      gap: 4px;
      width: min(100%, 320px);
      padding: 28px;
      border: 1px solid rgba(10, 186, 181, 0.25);
      border-radius: var(--r-xl);
      background: rgba(10, 10, 10, 0.55);
      backdrop-filter: blur(10px);
      flex-shrink: 0;
    }
    .ring { position: relative; width: 200px; }
    svg { display: block; width: 100%; rotate: -90deg; }
    circle { fill: none; stroke-width: 6; }
    .track { stroke: var(--hairline-strong); }
    .fill {
      stroke: var(--primary);
      stroke-linecap: round;
      filter: drop-shadow(0 0 8px var(--primary-glow));
    }
    line { stroke: var(--ink-tertiary); stroke-width: 1; }
    .center {
      position: absolute;
      inset: 0;
      display: flex;
      align-items: baseline;
      justify-content: center;
      padding-top: 78px;
      gap: 6px;
    }
    .num { font-size: 52px; line-height: 1; font-weight: 500; }
    .of { color: var(--ink-subtle); font-size: 16px; }
    .lbl {
      margin: 16px 0 0;
      font-size: 12px;
      letter-spacing: 1.2px;
      text-transform: uppercase;
      color: var(--ink-subtle);
    }
    .stage { margin: 0 0 12px; font-weight: 500; }
  `,
})
export class RegCounter {
  count = input<number | null>(null);
  slots = input(32);
  stage = input<string | null>(null);

  protected readonly ticks = Array.from({ length: 32 }, (_, i) => i);
  protected readonly shown = signal(0);
  protected readonly fill = computed(() => Math.min(100, (this.shown() / this.slots()) * 100));

  constructor() {
    // Счёт от 0 до N за ~1.2 с
    effect((onCleanup) => {
      const target = this.count() ?? 0;
      const start = performance.now();
      const tick = (now: number) => {
        const p = Math.min(1, (now - start) / 1200);
        this.shown.set(Math.round(target * (1 - (1 - p) ** 3)));
        if (p < 1) raf = requestAnimationFrame(tick);
      };
      let raf = requestAnimationFrame(tick);
      onCleanup(() => cancelAnimationFrame(raf));
    });
  }
}
