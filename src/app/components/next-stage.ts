import { Component, computed, DestroyRef, effect, inject, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';

const pad = (n: number) => String(n).padStart(2, '0');

// Карточка ближайшего этапа: таймер до старта + сколько пилотов уже записалось
@Component({
  selector: 'app-next-stage',
  imports: [RouterLink, TranslocoPipe],
  template: `
    @if (stage(); as s) {
      <p class="eyebrow">{{ 'home.next.eyebrow' | transloco }}</p>
      <h2 class="title">{{ s }}</h2>

      <div class="timer mono" role="timer">
        @for (part of parts(); track part.key) {
          <div class="cell">
            <span class="val">{{ part.val }}</span>
            <span class="unit">{{ 'home.next.' + part.key | transloco }}</span>
          </div>
        }
      </div>

      <div class="reg">
        <span class="num mono">{{ shown() }}</span>
        <span class="lbl">{{ 'home.next.registered' | transloco }}</span>
      </div>
      <a routerLink="/me" class="btn btn-primary">{{ 'home.next.cta' | transloco }}</a>
    } @else {
      <p class="eyebrow">{{ 'home.next.eyebrow' | transloco }}</p>
      <p class="soon">{{ 'home.next.soon' | transloco }}</p>
    }
  `,
  styles: `
    :host {
      display: grid;
      gap: 20px;
      width: min(100%, 360px);
      padding: 28px;
      border: 1px solid rgba(10, 186, 181, 0.25);
      border-radius: var(--r-xl);
      background: rgba(10, 10, 10, 0.55);
      backdrop-filter: blur(10px);
      flex-shrink: 0;
    }
    .eyebrow { margin: 0; }
    .title { font-size: 22px; letter-spacing: -0.02em; margin: -12px 0 0; }
    .timer {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 8px;
    }
    .cell {
      display: grid;
      justify-items: center;
      padding: 12px 0 8px;
      border: 1px solid var(--hairline-strong);
      border-radius: var(--r-md);
      background: var(--surface-1);
    }
    .val { font-size: 28px; line-height: 1; color: var(--ink); }
    .unit {
      margin-top: 6px;
      font-family: var(--font);
      font-size: 10px;
      letter-spacing: 1px;
      text-transform: uppercase;
      color: var(--ink-subtle);
    }
    .reg {
      display: flex;
      align-items: baseline;
      gap: 10px;
      padding-top: 16px;
      border-top: 1px solid var(--hairline);
    }
    .num {
      font-size: 40px;
      line-height: 1;
      color: var(--primary);
      text-shadow: 0 0 24px var(--primary-glow);
    }
    .lbl { color: var(--ink-muted); font-size: 14px; }
    .soon { margin: 0; color: var(--ink-muted); }
  `,
})
export class NextStage {
  stage = input<string | null>(null);
  startsAt = input<Date | null>(null);
  registered = input(0);

  private readonly now = signal(Date.now());
  protected readonly shown = signal(0);

  protected readonly parts = computed(() => {
    const ms = Math.max(0, (this.startsAt()?.getTime() ?? 0) - this.now());
    const s = Math.floor(ms / 1000);
    return [
      { key: 'd', val: pad(Math.floor(s / 86400)) },
      { key: 'h', val: pad(Math.floor(s / 3600) % 24) },
      { key: 'm', val: pad(Math.floor(s / 60) % 60) },
      { key: 's', val: pad(s % 60) },
    ];
  });

  constructor() {
    const id = setInterval(() => this.now.set(Date.now()), 1000);
    inject(DestroyRef).onDestroy(() => clearInterval(id));

    // Счёт регистраций от 0 до N за ~1.2 с
    effect((onCleanup) => {
      const target = this.registered();
      const start = performance.now();
      const tick = (t: number) => {
        const p = Math.min(1, (t - start) / 1200);
        this.shown.set(Math.round(target * (1 - (1 - p) ** 3)));
        if (p < 1) raf = requestAnimationFrame(tick);
      };
      let raf = requestAnimationFrame(tick);
      onCleanup(() => cancelAnimationFrame(raf));
    });
  }
}
