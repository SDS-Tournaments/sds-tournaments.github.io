import { Component, computed, DestroyRef, effect, inject, input, model, signal } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';

const PAGES = Array.from({ length: 10 }, (_, p) => ({ p, label: p ? `${p * 100}–${p * 100 + 99}` : '1–99' }));

// Выбор стартового номера: «наклейка» с номером + сетка свободных/занятых + случайный номер
@Component({
  selector: 'app-number-picker',
  imports: [TranslocoPipe],
  template: `
    <div class="plate" [class.rolling]="rolling()">
      <span class="tag mono">SDS</span>
      @for (n of [shown()]; track n) {
        <span class="big">{{ n ?? '—' }}</span>
      }
      <span class="name">{{ nickname() }}</span>
    </div>

    <div class="bar">
      <div class="tabs" role="tablist">
        @for (t of pages; track t.p) {
          <button type="button" role="tab" class="tab mono" [class.on]="page() === t.p" [attr.aria-selected]="page() === t.p" (click)="page.set(t.p)">
            {{ t.label }}
          </button>
        }
      </div>
      <button type="button" class="btn btn-secondary dice" (click)="roll()" [disabled]="rolling()">🎲 {{ 'picker.random' | transloco }}</button>
    </div>

    <div class="grid" role="listbox" [attr.aria-label]="'me.number' | transloco">
      @for (n of cells(); track n) {
        @let owner = ownerOf(n);
        <button
          type="button"
          role="option"
          class="cell mono"
          [class.taken]="owner"
          [class.sel]="value() === n"
          [attr.aria-selected]="value() === n"
          [disabled]="!!owner || rolling()"
          [title]="owner ? ('picker.takenBy' | transloco: { name: owner }) : ''"
          (click)="value.set(n)"
        >
          {{ n }}
        </button>
      }
    </div>

    <p class="legend subtle">
      <span class="sw free"></span>{{ 'picker.free' | transloco }}
      <span class="sw taken"></span>{{ 'picker.taken' | transloco }}
      <span class="sw sel"></span>{{ 'picker.selected' | transloco }}
    </p>
  `,
  styles: `
    :host { display: grid; gap: 16px; }

    /* Наклейка на заднее стекло */
    .plate {
      position: relative;
      display: grid;
      place-items: center;
      height: 150px;
      overflow: hidden;
      border-radius: var(--r-lg);
      background:
        linear-gradient(135deg, rgba(255, 255, 255, 0.06), transparent 40%),
        radial-gradient(80% 100% at 50% 120%, rgba(var(--accent-rgb), 0.25), transparent 70%),
        var(--surface-2);
      border: 1px solid rgba(var(--accent-rgb), 0.35);
      clip-path: polygon(6% 0, 94% 0, 100% 100%, 0 100%);
    }
    .big {
      font-size: 96px;
      font-weight: 600;
      font-style: italic;
      line-height: 1;
      letter-spacing: -0.04em;
      color: var(--ink);
      text-shadow: 3px 3px 0 var(--primary), 0 0 32px var(--primary-glow);
      transform: skewX(-8deg);
      animation: pop 400ms var(--ease-spring);
    }
    .rolling .big { animation: none; filter: blur(0.5px); }
    @keyframes pop {
      from { transform: skewX(-8deg) scale(0.6); opacity: 0; }
      to { transform: skewX(-8deg) scale(1); opacity: 1; }
    }
    .tag {
      position: absolute;
      top: 12px;
      left: 12%;
      font-size: 11px;
      padding: 2px 6px;
      border: 1px solid var(--primary);
      border-radius: var(--r-sm);
      color: var(--primary);
    }
    .name {
      position: absolute;
      bottom: 10px;
      font-size: 11px;
      letter-spacing: 2px;
      text-transform: uppercase;
      color: var(--ink-subtle);
    }

    .bar { display: flex; flex-wrap: wrap; gap: 12px; align-items: center; justify-content: space-between; }
    .tabs { display: flex; flex-wrap: wrap; gap: 4px; }
    .tab {
      padding: 6px 10px;
      border: 1px solid var(--hairline);
      border-radius: var(--r-pill);
      background: none;
      color: var(--ink-subtle);
      font-size: 12px;
      cursor: pointer;
      transition: color var(--fast), border-color var(--fast), background-color var(--fast);
      &:hover { color: var(--ink); border-color: var(--hairline-strong); }
      &.on { background: var(--primary-soft); border-color: var(--primary); color: var(--primary); }
    }
    .dice { min-height: 36px; padding: 6px 14px; }

    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(44px, 1fr));
      gap: 6px;
      max-height: 260px;
      overflow-y: auto;
      padding: 2px;
    }
    .cell {
      height: 40px;
      border: 1px solid var(--hairline-strong);
      border-radius: var(--r-sm);
      background: var(--surface-1);
      color: var(--ink);
      font-size: 14px;
      cursor: pointer;
      transition: transform var(--fast) var(--ease-out), border-color var(--fast), background-color var(--fast);
      &:hover:not(:disabled) { border-color: var(--primary); transform: translateY(-2px); }
      &.taken { background: transparent; border-style: dashed; border-color: var(--hairline); color: var(--ink-tertiary); text-decoration: line-through; cursor: not-allowed; }
      &.sel { background: var(--primary); border-color: var(--primary); color: var(--on-primary); box-shadow: 0 0 16px var(--primary-glow); }
    }

    .legend { display: flex; flex-wrap: wrap; align-items: center; gap: 6px 14px; margin: 0; font-size: 12px; }
    .sw { display: inline-block; width: 12px; height: 12px; border-radius: 3px; margin-right: -8px; border: 1px solid var(--hairline-strong); }
    .sw.taken { border-style: dashed; }
    .sw.sel { background: var(--primary); border-color: var(--primary); }
  `,
})
export class NumberPicker {
  readonly value = model<number | null>(null);
  /** номер → ник владельца (свой номер сюда не передаём) */
  readonly taken = input<Map<number, string>>(new Map());
  readonly nickname = input('');

  protected readonly pages = PAGES;
  protected readonly page = signal(0);
  protected readonly rolling = signal(false);
  private readonly rollNumber = signal<number | null>(null);
  protected readonly shown = computed(() => (this.rolling() ? this.rollNumber() : this.value()));
  protected readonly cells = computed(() => {
    const p = this.page();
    return Array.from({ length: p ? 100 : 99 }, (_, i) => (p ? p * 100 + i : i + 1));
  });
  private timer?: ReturnType<typeof setInterval>;

  constructor() {
    inject(DestroyRef).onDestroy(() => clearInterval(this.timer));
    // открыть страницу сетки с выбранным номером
    effect(() => {
      const v = this.value();
      if (v) this.page.set(Math.floor(v / 100));
    });
  }

  protected ownerOf(n: number) {
    return this.taken().get(n) ?? null;
  }

  /** Случайный свободный номер с анимацией «барабана» */
  roll() {
    const free = Array.from({ length: 999 }, (_, i) => i + 1).filter((n) => !this.taken().has(n));
    if (!free.length) return;
    const pick = free[Math.floor(Math.random() * free.length)];
    this.rolling.set(true);
    let ticks = 0;
    this.timer = setInterval(() => {
      this.rollNumber.set(1 + Math.floor(Math.random() * 999));
      if (++ticks < 18) return;
      clearInterval(this.timer);
      this.rolling.set(false);
      this.value.set(pick);
    }, 50);
  }
}
