import { Component, DestroyRef, ElementRef, inject, signal } from '@angular/core';

// Своя полоса прокрутки (системная скрыта): шкала с делениями и светящаяся точка цвета стиля.
// Точку можно тянуть, клик по шкале — перемотка; колесо и клавиатура работают как обычно.
@Component({
  selector: 'app-scroll-rail',
  host: {
    'aria-hidden': 'true',
    '[class.show]': 'scrollable()',
    '[class.active]': 'active()',
    '(pointerdown)': 'grab($event)',
  },
  template: `
    <div class="track">
      <div class="done" [style.height.%]="pos() * 100"></div>
      <div class="dot" [style.top.%]="pos() * 100">
        <span class="pct">{{ round(pos() * 100) }}</span>
      </div>
    </div>
  `,
  styles: `
    :host {
      position: fixed; z-index: 40; right: 3px; top: 96px; bottom: 28px; width: 16px;
      cursor: pointer; touch-action: none; opacity: 0; pointer-events: none;
      transition: opacity 0.4s var(--ease-out);
    }
    :host(.show) { opacity: 0.55; pointer-events: auto; }
    :host(.show.active), :host(.show:hover) { opacity: 1; }
    @media (max-width: 767px) { :host { display: none; } }

    .track {
      position: absolute; inset: 0 0 0 auto; width: 10px;
      /* деления: каждые 12px короткое, каждое пятое — длиннее */
      background:
        repeating-linear-gradient(to bottom, rgba(var(--accent-rgb), 0.5) 0 1px, transparent 1px 60px) right / 10px 100% no-repeat,
        repeating-linear-gradient(to bottom, rgba(var(--accent-rgb), 0.28) 0 1px, transparent 1px 12px) right / 5px 100% no-repeat;
    }
    /* пройденная часть — тонкая светящаяся линия по правому краю */
    .done {
      position: absolute; right: 0; top: 0; width: 1px;
      background: linear-gradient(to bottom, transparent, rgba(var(--accent-rgb), 0.9));
      box-shadow: 0 0 6px rgba(var(--accent-rgb), 0.6);
    }
    .dot {
      position: absolute; right: -4px; width: 9px; height: 9px; margin-top: -4.5px; border-radius: 50%;
      background: var(--primary);
      box-shadow: 0 0 0 3px rgba(var(--accent-rgb), 0.18), 0 0 12px rgba(var(--accent-rgb), 0.8);
      transition: transform var(--fast);
    }
    :host(.active) .dot { transform: scale(1.25); }
    .pct {
      position: absolute; right: 16px; top: 50%; transform: translateY(-50%);
      padding: 2px 6px; border-radius: var(--r-pill); background: var(--glass-strong); border: 1px solid rgba(var(--accent-rgb), 0.3);
      font: 500 10px var(--mono); color: var(--primary); letter-spacing: 0.05em;
      opacity: 0; transition: opacity var(--fast); pointer-events: none;
    }
    :host(.active) .pct, :host(:hover) .pct { opacity: 1; }
    @media (prefers-reduced-motion: reduce) { :host, .dot, .pct { transition: none; } }
  `,
})
export class ScrollRail {
  private readonly el = inject(ElementRef<HTMLElement>);
  /** 0…1 — сколько страницы пролистано */
  protected readonly pos = signal(0);
  /** страница длиннее окна — есть что листать */
  protected readonly scrollable = signal(false);
  /** идёт прокрутка или перетаскивание — шкала ярче, виден процент */
  protected readonly active = signal(false);
  private idle?: ReturnType<typeof setTimeout>;
  protected readonly round = Math.round;

  constructor() {
    const update = () => {
      const max = document.documentElement.scrollHeight - innerHeight;
      this.scrollable.set(max > 40);
      this.pos.set(max > 0 ? Math.min(1, Math.max(0, scrollY / max)) : 0);
    };
    const onScroll = () => {
      update();
      this.active.set(true);
      clearTimeout(this.idle);
      this.idle = setTimeout(() => this.active.set(false), 900);
    };
    addEventListener('scroll', onScroll, { passive: true });
    addEventListener('resize', update);
    // высота страницы меняется при загрузке данных и смене страниц
    const ro = new ResizeObserver(update);
    ro.observe(document.body);
    update();
    inject(DestroyRef).onDestroy(() => {
      removeEventListener('scroll', onScroll);
      removeEventListener('resize', update);
      ro.disconnect();
      clearTimeout(this.idle);
    });
  }

  /** нажали на шкалу — перемотка в эту точку; тянем — страница едет за указателем */
  protected grab(e: PointerEvent) {
    const host = this.el.nativeElement as HTMLElement;
    const seek = (y: number) => {
      const r = host.getBoundingClientRect();
      const p = Math.min(1, Math.max(0, (y - r.top) / r.height));
      scrollTo({ top: p * (document.documentElement.scrollHeight - innerHeight) });
    };
    host.setPointerCapture(e.pointerId);
    seek(e.clientY);
    const move = (ev: PointerEvent) => seek(ev.clientY);
    const up = () => {
      host.removeEventListener('pointermove', move);
      host.removeEventListener('pointerup', up);
      host.removeEventListener('pointercancel', up);
    };
    host.addEventListener('pointermove', move);
    host.addEventListener('pointerup', up);
    host.addEventListener('pointercancel', up);
    e.preventDefault();
  }
}
