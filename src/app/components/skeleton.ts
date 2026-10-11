import { Component, computed, input } from '@angular/core';

// Заготовка на время загрузки: карточки или строки таблицы с бегущим бликом
@Component({
  selector: 'app-skeleton',
  template: `
    <div [class]="variant()" role="status" aria-live="polite">
      <span class="sr">Загрузка…</span>
      @for (i of items(); track i) {
        <div class="sk" [style.--i]="i"></div>
      }
    </div>
  `,
  styles: `
    .cards { display: grid; gap: 20px; grid-template-columns: repeat(auto-fill, minmax(min(100%, 260px), 1fr)); }
    .cards .sk { height: 180px; border-radius: var(--r-lg); }
    .rows { display: grid; gap: 6px; }
    .rows .sk { height: 44px; border-radius: var(--r-sm); }
    .block .sk { height: 320px; border-radius: var(--r-lg); }
    .sk {
      position: relative;
      overflow: hidden;
      background: var(--surface-1);
      border: 1px solid var(--hairline);
      animation: fade 400ms var(--ease-out) both;
      animation-delay: calc(var(--i) * 40ms);
    }
    .sk::after {
      content: '';
      position: absolute;
      inset: 0;
      transform: translateX(-100%);
      background: linear-gradient(90deg, transparent, rgba(10, 186, 181, 0.08), transparent);
      animation: sweep 1.4s ease-in-out infinite;
      animation-delay: calc(var(--i) * 80ms);
    }
    @keyframes sweep { to { transform: translateX(100%); } }
    @keyframes fade { from { opacity: 0; } }
    .sr { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); }
  `,
})
export class Skeleton {
  readonly variant = input<'cards' | 'rows' | 'block'>('rows');
  readonly count = input(6);
  protected readonly items = computed(() => Array.from({ length: this.count() }, (_, i) => i));
}
