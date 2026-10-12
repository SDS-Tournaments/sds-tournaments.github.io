import { Component, computed, DestroyRef, effect, inject, input, signal, untracked } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { hype } from './hype';

const pad = (n: number) => String(n).padStart(2, '0');

/** Цвет уровня: 1 — голубой, 7 — ярко-розово-фиолетовый */
const hue = (level: number) => 200 + ((Math.max(1, level) - 1) / 6) * 100;

// Карточка ближайшего этапа: таймер до старта + сколько пилотов уже записалось.
// «Хайп»: чем больше записавшихся, тем ярче свечение и чаще пульсация карточки (уровни — hype.ts)
@Component({
  selector: 'app-next-stage',
  imports: [RouterLink, TranslocoPipe],
  host: {
    '[class.hype]': 'hypeOn() && hy().level > 0',
    '[class.r2]': 'hypeOn() && hy().level >= 3',
    '[class.r3]': 'hypeOn() && hy().level >= 5',
    '[style.--hc]': 'color(hy().level, 0.95)',
    '[style.--hg]': 'color(hy().level, 0.18 + hy().level * 0.07)',
    '[style.--hr]': '10 + hy().level * 5 + "px"',
    '[style.--hs]': '3.4 - (hy().level - 1) * 0.38 + "s"',
  },
  template: `
    @if (stage(); as s) {
      @if (live()) {
        <p class="eyebrow live"><span class="dot"></span>LIVE · {{ 'home.next.' + status() | transloco }}</p>
      } @else {
        <p class="eyebrow">{{ 'home.next.eyebrow' | transloco }}</p>
      }
      <h2 class="title">{{ s }}</h2>

      @if (!live() && startsAt()) {
        <div class="timer mono" role="timer">
          @for (part of parts(); track part.key) {
            <div class="cell">
              <span class="val">{{ part.val }}</span>
              <span class="unit">{{ 'home.next.' + part.key | transloco }}</span>
            </div>
          }
        </div>
      }

      <div class="reg">
        <span class="num mono">{{ shown() }}</span>
        <span class="lbl">{{ (live() ? 'home.next.racing' : 'home.next.registered') | transloco }}</span>
      </div>
      @if (live()) {
        <a href="#live" class="btn btn-primary">{{ 'home.next.watch' | transloco }}</a>
      } @else if (status() === 'registration') {
        <a routerLink="/me" class="btn btn-primary">{{ 'home.next.cta' | transloco }}</a>
        <div class="hype-bar">
          <div class="hb-top">
            <span>{{ 'home.next.hype' | transloco }}</span>
            <span class="mono">{{ hy().level }}/{{ hy().max }}</span>
          </div>
          <div class="segs" aria-hidden="true">
            @for (i of segs; track i) {
              <i class="seg" [style.--sc]="color(i + 1, 0.95)"><b [style.width.%]="segFill(i)"></b></i>
            }
          </div>
          <p class="hb-note">
            @if (hy().toNext; as n) { {{ 'home.next.hypeNext' | transloco: { n, l: hy().level + 1 } }} }
            @else { {{ 'home.next.hypeMax' | transloco }} }
          </p>
        </div>
      }
    } @else {
      <p class="eyebrow">{{ 'home.next.eyebrow' | transloco }}</p>
      <p class="soon">{{ 'home.next.soon' | transloco }}</p>
    }
  `,
  styles: `
    :host {
      position: relative;
      display: grid;
      gap: 20px;
      width: min(100%, 360px);
      padding: 28px;
      border: 1px solid rgba(10, 186, 181, 0.25);
      border-radius: var(--r-xl);
      background: var(--glass);
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

    /* Хайп: рамка, свечение и число — цветом уровня; пульс чаще с ростом уровня */
    :host(.hype) { border-color: var(--hc); animation: hype-glow var(--hs) ease-in-out infinite; }
    :host(.hype) .num { color: var(--hc); text-shadow: 0 0 24px var(--hg); }
    @keyframes hype-glow {
      0%, 100% { box-shadow: 0 0 var(--hr) var(--hg); }
      50% { box-shadow: 0 0 calc(var(--hr) * 2.2) var(--hg), inset 0 0 calc(var(--hr) * 1.2) var(--hg); }
    }
    /* с 3-го уровня — расходящееся кольцо, с 5-го — второе */
    :host(.r2)::before, :host(.r3)::after {
      content: ''; position: absolute; inset: -1px; border-radius: inherit; border: 1px solid var(--hc);
      pointer-events: none; animation: hype-ring var(--hs) ease-out infinite;
    }
    :host(.r3)::after { animation-delay: calc(var(--hs) / -2); }
    @keyframes hype-ring { from { opacity: 0.8; transform: scale(1); } to { opacity: 0; transform: scale(1.09); } }

    .hype-bar { display: grid; gap: 8px; }
    .hb-top { display: flex; justify-content: space-between; font-size: 11px; letter-spacing: 1.5px; text-transform: uppercase; color: var(--ink-subtle); }
    .hb-top .mono { color: var(--hc, var(--ink-muted)); }
    .segs { display: grid; grid-template-columns: repeat(7, 1fr); gap: 4px; }
    .seg { height: 6px; border-radius: 3px; background: var(--surface-3); overflow: hidden; }
    .seg b { display: block; height: 100%; background: var(--sc); box-shadow: 0 0 8px var(--sc); }
    .hb-note { margin: 0; font-size: 12px; color: var(--ink-muted); }

    @media (prefers-reduced-motion: reduce) {
      :host(.hype), :host(.r2)::before, :host(.r3)::after { animation: none; }
      :host(.hype) { box-shadow: 0 0 var(--hr) var(--hg); }
    }
    .live { display: flex; align-items: center; gap: 8px; color: var(--error); }
    .live .dot { width: 8px; height: 8px; border-radius: 50%; background: var(--error); animation: pulse 1.6s ease-out infinite; }
    @keyframes pulse { from { box-shadow: 0 0 0 0 rgba(255, 92, 92, 0.6); } to { box-shadow: 0 0 0 10px transparent; } }
  `,
})
export class NextStage {
  stage = input<string | null>(null);
  startsAt = input<Date | null>(null);
  registered = input(0);
  status = input<string>('registration');
  protected readonly live = computed(() => this.status() === 'qualifying' || this.status() === 'battles');
  /** хайп только пока идёт регистрация */
  protected readonly hypeOn = computed(() => !!this.stage() && this.status() === 'registration');
  protected readonly hy = computed(() => hype(this.registered()));
  /** позиция заполнения полоски в делениях (0…7): плавно едет от 0 к уровню + доле текущего */
  private readonly fillPos = signal(0);
  /** деление i заполняется, только когда линия до него доехала — одна непрерывная линия слева направо */
  protected segFill(i: number) {
    return Math.min(1, Math.max(0, this.fillPos() - i)) * 100;
  }
  protected readonly segs = [0, 1, 2, 3, 4, 5, 6];
  protected color(level: number, alpha: number) {
    return `hsl(${hue(level)} 95% 66% / ${Math.min(1, alpha)})`;
  }

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

    // Полоска хайпа — своя плавная анимация (ease-in-out ~1.6 с), не привязана к целым числам счётчика
    effect((onCleanup) => {
      const h = this.hy();
      const target = h.level + (h.level < h.max ? h.progress : 0);
      const from = untracked(() => this.fillPos()); // без подписки — иначе эффект перезапускался бы каждый кадр
      const start = performance.now();
      const ease = (p: number) => (p < 0.5 ? 2 * p * p : 1 - (-2 * p + 2) ** 2 / 2);
      const tick = (t: number) => {
        const p = Math.min(1, (t - start) / 1600);
        this.fillPos.set(from + (target - from) * ease(p));
        if (p < 1) raf = requestAnimationFrame(tick);
      };
      let raf = requestAnimationFrame(tick);
      onCleanup(() => cancelAnimationFrame(raf));
    });
  }
}
