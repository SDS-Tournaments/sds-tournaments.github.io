import { Component, input } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';

// Индикатор загрузки: тонкая линия с бегущим бирюзовым отрезком.
// Появляется через 200 мс — быстрые загрузки не мелькают вовсе.
@Component({
  selector: 'app-loader',
  imports: [TranslocoPipe],
  template: `
    <div class="wrap" [class.inline]="inline()" role="status" aria-live="polite">
      <span class="sr">{{ 'common.loading' | transloco }}</span>
      <span class="track"><span class="bar"></span></span>
    </div>
  `,
  styles: `
    .wrap { display: grid; place-items: center; min-height: 50vh; animation: show 300ms ease-out 200ms both; }
    .wrap.inline { min-height: 48px; }
    .track { position: relative; width: 140px; height: 2px; overflow: hidden; border-radius: 2px; background: var(--hairline-strong); }
    .bar {
      position: absolute; inset: 0 auto 0 0; width: 40%;
      background: linear-gradient(90deg, transparent, var(--primary), transparent);
      box-shadow: 0 0 12px var(--primary-glow);
      animation: run 1.1s var(--ease-in-out) infinite;
    }
    @keyframes run { from { transform: translateX(-100%); } to { transform: translateX(250%); } }
    @keyframes show { from { opacity: 0; } }
    .sr { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); }
  `,
})
export class Loader {
  readonly inline = input(false);
}
