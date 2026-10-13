import { Component, computed, DestroyRef, effect, inject, input, signal, untracked } from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { hype } from './hype';

const pad = (n: number) => String(n).padStart(2, '0');

/** Цвет уровня: 1 — голубой, 7 — ярко-розово-фиолетовый */
/** доля уровня 0…1 (1-й уровень — 0, 7-й — 1); сам оттенок задаёт тема: --hype-h0 и --hype-span */
const step = (level: number) => (Math.max(1, level) - 1) / 6;

// Карточка ближайшего этапа: таймер до старта + сколько пилотов уже записалось.
// «Хайп»: чем больше записавшихся, тем ярче свечение и чаще пульсация карточки (уровни — hype.ts)
@Component({
  selector: 'app-next-stage',
  imports: [DatePipe, RouterLink, TranslocoPipe],
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
    <i class="hglow" aria-hidden="true"></i>
    @if (stage(); as s) {
      @if (live()) {
        <p class="eyebrow live"><span class="dot"></span>LIVE · {{ 'home.next.' + status() | transloco }}</p>
      } @else {
        <p class="eyebrow">{{ 'home.next.eyebrow' | transloco }}</p>
      }
      <h2 class="title">{{ s }}</h2>
      <!-- этап в два дня: квалификация и парные -->
      @if (startsAt()) {
        <div class="days" [class.one]="!battlesAt()">
          <div class="day" [class.past]="status() === 'qual_done'">
            <span class="dl">{{ 'home.next.day1' | transloco }}@if (status() === 'qual_done') { ✓ }</span>
            <span class="dv mono"><b>{{ startsAt() | date: 'dd.MM' }}</b> {{ startsAt() | date: 'HH:mm' }}</span>
          </div>
          @if (battlesAt(); as b) {
            <div class="day">
              <span class="dl">{{ 'home.next.day2' | transloco }}</span>
              <span class="dv mono"><b>{{ b | date: 'dd.MM' }}</b> {{ b | date: 'HH:mm' }}</span>
            </div>
          }
        </div>
      }
      @if (status() === 'qual_done') { <p class="eyebrow wait">{{ 'home.next.untilBattles' | transloco }}</p> }

      @if (!live() && target()) {
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
      border: 1px solid rgba(var(--accent-rgb), 0.25);
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
    /* расписание этапа: две плитки «День 1 / День 2» */
    .days { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-top: -6px; }
    .days.one { grid-template-columns: 1fr; }
    .day { display: grid; gap: 4px; padding: 10px 12px; border: 1px solid var(--hairline-strong); border-radius: var(--r-md); background: var(--surface-1); }
    .dl { font-size: 10px; letter-spacing: 1.2px; text-transform: uppercase; color: var(--primary); }
    .dv { font-size: 13px; color: var(--ink-muted); }
    .dv b { font-size: 18px; font-weight: 500; color: var(--ink); margin-right: 4px; }
    .day.past { opacity: 0.5; }
    .wait { margin: -6px 0 0; }

    /* Хайп: рамка, свечение и число — цветом уровня; пульс чаще с ростом уровня */
    :host(.hype) { border-color: var(--hc); box-shadow: 0 0 var(--hr) var(--hg); isolation: isolate; }
    .hglow { display: none; }
    :host(.hype) .hglow {
      display: block; position: absolute; inset: -1px; z-index: -1; border-radius: inherit; pointer-events: none;
      box-shadow: 0 0 calc(var(--hr) * 2.2) var(--hg), inset 0 0 calc(var(--hr) * 1.2) var(--hg);
      opacity: 0; animation: hype-glow var(--hs) ease-in-out infinite;
    }
    :host(.hype) .num { color: var(--hc); text-shadow: 0 0 24px var(--hg); }
    @keyframes hype-glow { 50% { opacity: 1; } }
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
      :host(.hype) .hglow, :host(.r2)::before, :host(.r3)::after, .live .dot::after { animation: none; }
    }
    .live { display: flex; align-items: center; gap: 8px; color: var(--error); }
    .live .dot { width: 8px; height: 8px; border-radius: 50%; background: var(--error); }
    .live .dot { position: relative; }
.live .dot::after { content: ''; position: absolute; inset: 0; border-radius: 50%; background: var(--error); animation: ring-out 1.6s ease-out infinite; }
    @keyframes ring-out { from { transform: scale(1); opacity: 0.6; } to { transform: scale(3.4); opacity: 0; } }
  `,
})
export class NextStage {
  stage = input<string | null>(null);
  startsAt = input<Date | null>(null);
  battlesAt = input<Date | null>(null);
  /** до чего считаем: квала уже прошла — до парных */
  protected readonly target = computed(() => (this.status() === 'qual_done' ? this.battlesAt() : this.startsAt()));
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
    return `hsl(calc(var(--hype-h0, 200) + ${step(level)} * var(--hype-span, 100)) 95% var(--hype-l, 66%) / ${Math.min(1, alpha)})`;
  }

  private readonly now = signal(Date.now());
  protected readonly shown = signal(0);

  protected readonly parts = computed(() => {
    const ms = Math.max(0, (this.target()?.getTime() ?? 0) - this.now());
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
