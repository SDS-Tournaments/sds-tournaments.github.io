import { Component, input } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';

// Индикатор загрузки: машинка боком крутит «пончик», за ней — два следа шин и дымок.
// Появляется через 200 мс — быстрые загрузки не мелькают вовсе. Цвета — из темы сайта.
@Component({
  selector: 'app-loader',
  imports: [TranslocoPipe],
  template: `
    <div class="wrap" [class.inline]="inline()" role="status" aria-live="polite">
      <span class="sr">{{ 'common.loading' | transloco }}</span>
      <span class="donut" aria-hidden="true">
        <i class="lane"></i>
        <span class="spin">
          <i class="skid"></i>
          <span class="car">
            <i class="puff p1"></i><i class="puff p2"></i>
            <svg viewBox="0 0 28 16">
              <rect class="body" x="1" y="2" width="26" height="12" rx="4" />
              <rect class="glass" x="14" y="3.5" width="5" height="9" rx="1.5" />
              <rect class="glass" x="5" y="4" width="3.5" height="8" rx="1" />
              <rect class="lamp" x="24.5" y="3" width="2" height="3" rx="1" /><rect class="lamp" x="24.5" y="10" width="2" height="3" rx="1" />
            </svg>
          </span>
        </span>
      </span>
    </div>
  `,
  styles: `
    .wrap { --s: 72px; display: grid; place-items: center; min-height: 50vh; animation: show 300ms ease-out 200ms both; }
    .wrap.inline { --s: 40px; min-height: 48px; }
    .donut { position: relative; width: var(--s); height: var(--s); }
    /* «площадка» — пунктирный круг, по которому едет машинка */
    .lane { position: absolute; inset: 14%; border: 1px dashed var(--hairline-strong); border-radius: 50%; }
    .spin { position: absolute; inset: 0; animation: spin 1.25s linear infinite; }
    /* след: хвост за машинкой гаснет, две тонкие полосы — левые и правые колёса */
    .skid {
      position: absolute; inset: 0; border-radius: 50%;
      background: conic-gradient(from 240deg, transparent, rgba(var(--accent-rgb), 0.85) 118deg, transparent 118deg);
      -webkit-mask: radial-gradient(farthest-side, transparent 66%, #000 67% 72%, transparent 73% 80%, #000 81% 86%, transparent 87%);
      mask: radial-gradient(farthest-side, transparent 66%, #000 67% 72%, transparent 73% 80%, #000 81% 86%, transparent 87%);
    }
    /* машинка сверху круга, нос смотрит по ходу (по часовой) и довёрнут внутрь — занос */
    .car { position: absolute; left: 50%; top: 12.5%; width: 40%; translate: -50% -50%; rotate: 28deg; }
    .car svg { display: block; width: 100%; filter: drop-shadow(0 0 6px var(--primary-glow)); }
    .body { fill: var(--primary); }
    .glass { fill: var(--canvas); opacity: 0.75; }
    .lamp { fill: #fff; }
    .puff {
      position: absolute; left: -10%; top: 50%; width: 38%; aspect-ratio: 1; border-radius: 50%;
      background: radial-gradient(circle, rgba(var(--accent-rgb), 0.35), transparent 70%);
      animation: puff 0.6s ease-out infinite;
    }
    .p2 { animation-delay: 0.3s; top: 20%; }
    .inline .puff { display: none; }
    @keyframes spin { to { rotate: 360deg; } }
    @keyframes puff { from { translate: 0 -50%; scale: 0.5; opacity: 1; } to { translate: -120% -50%; scale: 1.6; opacity: 0; } }
    @keyframes show { from { opacity: 0; } }
    @media (prefers-reduced-motion: reduce) {
      .spin { animation-duration: 4s; }
      .puff { display: none; }
    }
    .sr { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); }
  `,
})
export class Loader {
  readonly inline = input(false);
}
