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
    /* --rc — цвет шкалы (r, g, b): акцент стиля; в LEGEND темнее (styles.scss, --rail-rgb), иначе теряется на перламутре */
    :host {
      --rc: var(--rail-rgb, var(--accent-rgb));
      --tw: 12px;   /* ширина шкалы (длинное деление) */
      --ds: 10px;   /* размер точки */
      position: fixed; z-index: 40; right: 4px; top: 96px; bottom: 28px; width: 18px;
      cursor: pointer; touch-action: none; opacity: 0; pointer-events: none;
      transition: opacity 0.4s var(--ease-out);
    }
    /* широкие экраны — крупнее и дальше от края */
    @media (min-width: 1440px) { :host { --tw: 16px; --ds: 12px; right: 10px; width: 24px; } }
    :host(.show) { opacity: 0.8; pointer-events: auto; }
    :host(.show.active), :host(.show:hover) { opacity: 1; }
    @media (max-width: 767px) { :host { display: none; } }

    .track {
      position: absolute; inset: 0 0 0 auto; width: var(--tw);
      /* ось по правому краю + деления: каждые 12px короткое, каждое пятое — длинное */
      background:
        linear-gradient(rgba(var(--rc), 0.35), rgba(var(--rc), 0.35)) right / 1px 100% no-repeat,
        repeating-linear-gradient(to bottom, rgba(var(--rc), 0.85) 0 1px, transparent 1px 60px) right / var(--tw) 100% no-repeat,
        repeating-linear-gradient(to bottom, rgba(var(--rc), 0.5) 0 1px, transparent 1px 12px) right / calc(var(--tw) / 2) 100% no-repeat;
    }
    /* пройденная часть — светящаяся линия по оси */
    .done {
      position: absolute; right: 0; top: 0; width: 2px; margin-right: -0.5px;
      background: linear-gradient(to bottom, transparent, rgba(var(--rc), 1));
      box-shadow: 0 0 8px rgba(var(--rc), 0.7);
    }
    .dot {
      position: absolute; right: calc(var(--ds) / -2 + 0.5px); width: var(--ds); height: var(--ds); margin-top: calc(var(--ds) / -2);
      border-radius: 50%; background: rgb(var(--rc));
      box-shadow: 0 0 0 3px rgba(var(--rc), 0.22), 0 0 14px rgba(var(--rc), 0.9);
      transition: transform var(--fast);
    }
    :host(.active) .dot { transform: scale(1.3); }
    .pct {
      position: absolute; right: calc(var(--ds) + 8px); top: 50%; transform: translateY(-50%);
      padding: 2px 6px; border-radius: var(--r-pill); background: var(--glass-strong); border: 1px solid rgba(var(--rc), 0.4);
      font: 500 10px var(--mono); color: rgb(var(--rc)); letter-spacing: 0.05em; white-space: nowrap;
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
    // (в тестовой среде ResizeObserver нет)
    const ro = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(update);
    ro?.observe(document.body);
    update();
    inject(DestroyRef).onDestroy(() => {
      removeEventListener('scroll', onScroll);
      removeEventListener('resize', update);
      ro?.disconnect();
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
