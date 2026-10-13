import { Component, computed, DestroyRef, effect, inject, input, signal, untracked } from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { hype, HYPE_STEPS } from './hype';

const pad = (n: number) => String(n).padStart(2, '0');

/** доля уровня 0…1 (1-й уровень — 0, последний — 1); сам оттенок задаёт тема: --hype-h0 и --hype-span */
const step = (level: number) => (Math.max(1, level) - 1) / (HYPE_STEPS.length - 1);

// Карточка ближайшего этапа: таймер до старта + сколько пилотов уже записалось.
// «Хайп»: чем больше записавшихся, тем ярче свечение и чаще пульсация карточки (уровни — hype.ts)
@Component({
  selector: 'app-next-stage',
  imports: [DatePipe, RouterLink, TranslocoPipe],
  host: {
    '[class.hype]': 'hypeOn() && hy().level > 0',
    '[class.r2]': 'hypeOn() && hy().level >= 3',
    '[class.g5]': 'hypeOn() && hy().level >= 5',
    '[class.g8]': 'hypeOn() && hy().level >= 8',
    '[class.max]': 'hypeOn() && hy().level >= 10',
    '[style.--hc]': 'color(hy().level, 0.95)',
    // свечение и частота пульса растут только до 5-го уровня — дальше уровни отличаются новыми эффектами
    '[style.--hg]': 'color(hy().level, 0.18 + glowLv() * 0.07)',
    '[style.--hr]': '10 + glowLv() * 4 + "px"',
    '[style.--hs]': '3.4 - (glowLv() - 1) * 0.4 + "s"',
  },
  template: `
    <i class="hglow" aria-hidden="true"></i>
    <!-- лестница хайпа — меняется сама карточка:
         5 острые углы · 6 кометы по рамке · 7 «эхо»-рамки разъезжаются · 8 глитч
         9 уголки-прицелы, искры, «Куда столько?» · 10 сердцебиение, осколки, пламя, тряска, «ВЫ ЧТО ТВОРИТЕ?» -->
    @if (hypeOn() && hy().level >= 7) { <i class="echo e1" aria-hidden="true"></i><i class="echo e2" aria-hidden="true"></i> }
    @if (hypeOn() && hy().level >= 6) { <i class="orbit" aria-hidden="true"></i> }
    @if (hypeOn() && hy().level >= 9) { <span class="shout" [class.loud]="hy().level >= 10">{{ (hy().level >= 10 ? 'home.next.shout10' : 'home.next.shout9') | transloco }}</span> }
    @if (hypeOn() && hy().level >= 9) {
      <span class="lock" aria-hidden="true"><i></i><i></i><i></i><i></i></span>
      <span class="sparks" aria-hidden="true">
        @for (k of sparks; track k.x) { <i [style.left.%]="k.x" [style.--dl.s]="k.d" [style.--du.s]="k.t" [style.--dx.px]="k.dx"></i> }
      </span>
    }
    @if (hypeOn() && hy().level >= 10) {
      <i class="flames" aria-hidden="true"></i>
      <span class="shards" aria-hidden="true">
        @for (k of shards; track k.a) { <i [style.--a.deg]="k.a" [style.--dl.s]="k.d" [style.--sz.px]="k.s"></i> }
      </span>
    }
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
            @if (hy().toNext; as n) { {{ 'home.next.hypeNext' | transloco: { n, w: ('home.next.pilots.' + plural(n)) | transloco, l: hy().level + 1 } }} }
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
    /* с 3-го уровня — расходящееся кольцо */
    :host(.r2)::before {
      content: ''; position: absolute; inset: -1px; border-radius: inherit; border: 1px solid var(--hc);
      pointer-events: none; animation: hype-ring var(--hs) ease-out infinite;
    }
    @keyframes hype-ring { from { opacity: 0.8; transform: scale(1); } to { opacity: 0; transform: scale(1.09); } }

    /* 6+: кометы по рамке — вращается слой с коническим градиентом, видна только полоска рамки */
    .orbit {
      position: absolute; inset: -1px; z-index: -1; border-radius: inherit; padding: 3px; overflow: hidden; pointer-events: none;
      mask: linear-gradient(#000 0 0) content-box exclude, linear-gradient(#000 0 0);
    }
    .orbit::before {
      content: ''; position: absolute; left: 50%; top: 50%; width: 200%; aspect-ratio: 1; translate: -50% -50%;
      background: conic-gradient(transparent 0 25%, var(--hc) 44%, #fff 49%, transparent 50% 75%, var(--hc) 94%, #fff 99%, transparent 100%);
      animation: orbit calc(var(--hs) * 1.6) linear infinite;
    }
    @keyframes orbit { to { rotate: 360deg; } }


    /* 9+: искры поднимаются со дна карточки */
    .sparks { position: absolute; inset: 0; z-index: -1; overflow: visible; pointer-events: none; }
    .sparks i {
      position: absolute; bottom: 4px; width: 4px; height: 4px; border-radius: 50%;
      background: var(--hc); box-shadow: 0 0 8px var(--hc), 0 0 2px #fff;
      opacity: 0; animation: spark var(--du) ease-out var(--dl) infinite;
    }
    @keyframes spark {
      0% { opacity: 0; transform: translate(0, 0) scale(0.6); }
      15% { opacity: 1; }
      100% { opacity: 0; transform: translate(var(--dx), -150px) scale(1.2); }
    }

    /* 10: аншлаг — пламя снизу, карточку встряхивает, число пульсирует */
    .flames {
      position: absolute; left: 0; right: 0; bottom: 0; height: 55%; z-index: -1; border-radius: inherit; pointer-events: none;
      background:
        radial-gradient(70% 90% at 50% 100%, color-mix(in oklab, var(--hc), #ff8a3d 50%), transparent 72%),
        radial-gradient(40% 70% at 18% 100%, var(--hc), transparent 72%),
        radial-gradient(40% 70% at 82% 100%, var(--hc), transparent 72%);
      opacity: 0.8; transform-origin: bottom;
      animation: flame 0.9s ease-in-out infinite alternate;
    }
    @keyframes flame {
      from { transform: scaleY(0.82) scaleX(1); opacity: 0.6; }
      to { transform: scaleY(1.12) scaleX(1.04); opacity: 0.95; }
    }
    /* ── геометрия хайпа ── */
    /* 5: острые углы, рамка толще, карточка крупнее */
    :host(.g5) { border-radius: 0; border-width: 2px; scale: 1.03; transition: border-radius 600ms var(--ease-out), scale 600ms var(--ease-out); }
    /* 9–10: надпись-штамп поверх карточки: впечатывается, держится, пропадает и снова */
    .shout {
      position: absolute; left: 50%; top: 42%; z-index: 3; pointer-events: none; white-space: nowrap;
      padding: 8px 16px; border: 2px solid var(--hc); background: rgba(0, 0, 0, 0.82);
      color: var(--hc); font: 400 24px 'Russo One', var(--font); letter-spacing: 0.04em; text-transform: uppercase;
      text-shadow: 0 0 18px var(--hc); box-shadow: 0 0 30px -6px var(--hc);
      translate: -50% -50%; rotate: -8deg; opacity: 0;
      animation: shout 5s cubic-bezier(0.3, 1.5, 0.5, 1) 0.6s infinite;
    }
    /* 100+: «дьявольская» надпись — без плашки, выжигается слева направо, тлеет углями и уходит в дым */
    .shout.loud {
      padding: 0; border: 0; background: none; box-shadow: none; rotate: -4deg;
      font: 400 34px 'Ruslan Display', 'Russo One', var(--font); letter-spacing: 0.05em;
      color: #ff2a12; -webkit-text-stroke: 1px #ff7a2a;
      text-shadow: 0 0 6px #ff6a00, 0 0 18px #c40000, 0 0 42px rgba(255, 0, 0, 0.55);
      mask-image: linear-gradient(90deg, #000 45%, transparent 55%); mask-size: 260% 100%; mask-repeat: no-repeat;
      animation: hell 4.4s ease-out 0.6s infinite, ember 0.16s steps(2) infinite;
    }
    /* дымка за надписью — без краёв, чтобы читалась поверх таймера */
    .shout.loud::before {
      content: ''; position: absolute; inset: -34px -46px; z-index: -1;
      background: radial-gradient(closest-side, rgba(0, 0, 0, 0.92), rgba(20, 0, 0, 0.75) 55%, transparent);
    }
    @keyframes hell {
      0% { opacity: 0; mask-position: 100% 0; filter: blur(3px); }
      5% { opacity: 1; }
      26% { mask-position: 0 0; filter: blur(0); }
      64% { opacity: 1; mask-position: 0 0; filter: blur(0); translate: -50% -50%; }
      80%, 100% { opacity: 0; mask-position: 0 0; filter: blur(6px); translate: -50% -62%; }
    }
    @keyframes ember { 50% { text-shadow: 0 0 4px #ffb000, 0 0 14px #ff2a00, 0 0 34px rgba(255, 0, 0, 0.45); } }
    @keyframes shout {
      0% { opacity: 0; scale: 2.4; }
      8% { opacity: 1; scale: 1; }
      60% { opacity: 1; scale: 1; }
      70%, 100% { opacity: 0; scale: 0.9; }
    }
    /* 7: «эхо» — копии рамки разъезжаются из-под карточки, как колода */
    .echo {
      --o: 14px; position: absolute; inset: -2px; z-index: -2; border-radius: inherit; border: 2px solid var(--hc); pointer-events: none;
      opacity: 0; animation: echo 2.4s ease-in-out infinite;
    }
    .e2 { --o: 28px; animation-delay: 0.3s; }
    @keyframes echo { 0%, 100% { opacity: 0; transform: translate(0, 0); } 50% { opacity: 0.65; transform: translate(var(--o), var(--o)); } }
    /* 8: глитч — заголовок и число дёргаются с цветным расслоением */
    :host(.g8) .title, :host(.g8) .num { display: inline-block; animation: glitch 2.8s steps(1) infinite; }
    @keyframes glitch {
      0%, 86%, 100% { transform: none; text-shadow: none; }
      88% { transform: translate(-4px, 1px) skewX(-10deg); text-shadow: 3px 0 #ff2e63, -3px 0 #08f7fe; }
      91% { transform: translate(4px, -1px); text-shadow: -4px 0 #ff2e63, 4px 0 #08f7fe; }
      94% { transform: translate(-2px, 0) skewX(6deg); text-shadow: 2px 0 #ff2e63, -2px 0 #08f7fe; }
      97% { transform: translate(1px, 0); text-shadow: none; }
    }
    /* 9: уголки-прицелы «захватывают» карточку снаружи */
    .lock { position: absolute; inset: -18px; z-index: 2; pointer-events: none; }
    .lock i {
      position: absolute; width: 26px; height: 26px; border: 3px solid var(--hc);
      filter: drop-shadow(0 0 6px var(--hc)); animation: lock 1.6s ease-in-out infinite;
    }
    .lock i:nth-child(1) { top: 0; left: 0; border-right: 0; border-bottom: 0; --lx: -7px; --ly: -7px; }
    .lock i:nth-child(2) { top: 0; right: 0; border-left: 0; border-bottom: 0; --lx: 7px; --ly: -7px; }
    .lock i:nth-child(3) { bottom: 0; left: 0; border-right: 0; border-top: 0; --lx: -7px; --ly: 7px; }
    .lock i:nth-child(4) { bottom: 0; right: 0; border-left: 0; border-top: 0; --lx: 7px; --ly: 7px; }
    @keyframes lock { 0%, 100% { transform: translate(0, 0); } 50% { transform: translate(var(--lx), var(--ly)); } }
    /* 10: аншлаг — карточка бьётся как сердце, трясётся, из неё вылетают осколки */
    :host(.max) { animation: heart 1.1s ease-in-out infinite, rattle 2.6s ease-in-out infinite; }
    @keyframes heart { 0%, 100% { scale: 1.03; } 12% { scale: 1.09; } 24% { scale: 1.03; } 36% { scale: 1.07; } 50% { scale: 1.03; } }
    @keyframes rattle {
      0%, 74%, 100% { translate: 0 0; }
      77% { translate: -5px 2px; }
      80% { translate: 5px -2px; }
      83% { translate: -4px 1px; }
      86% { translate: 3px 0; }
      89% { translate: -1px 0; }
    }
    .shards { position: absolute; left: 50%; top: 50%; z-index: -1; pointer-events: none; }
    .shards i {
      position: absolute; width: var(--sz); height: var(--sz); background: var(--hc);
      clip-path: polygon(50% 0, 100% 100%, 0 70%); filter: drop-shadow(0 0 6px var(--hc));
      opacity: 0; animation: shard 2.2s cubic-bezier(0.2, 0.7, 0.3, 1) var(--dl) infinite;
    }
    @keyframes shard {
      0% { opacity: 0; transform: rotate(var(--a)) translateX(170px) rotate(0); }
      12% { opacity: 1; }
      100% { opacity: 0; transform: rotate(var(--a)) translateX(300px) rotate(540deg); }
    }
    :host(.max) .num { animation: glitch 2.8s steps(1) infinite, num-pump 1.1s ease-in-out infinite; }
    @keyframes num-pump { 12% { scale: 1.18; } 24% { scale: 1; } 36% { scale: 1.1; } 50% { scale: 1; } }

    .hype-bar { display: grid; gap: 8px; }
    .hb-top { display: flex; justify-content: space-between; font-size: 11px; letter-spacing: 1.5px; text-transform: uppercase; color: var(--ink-subtle); }
    .hb-top .mono { color: var(--hc, var(--ink-muted)); }
    .segs { display: grid; grid-template-columns: repeat(10, 1fr); gap: 3px; }
    .seg { height: 6px; border-radius: 3px; background: var(--surface-3); overflow: hidden; }
    .seg b { display: block; height: 100%; background: var(--sc); box-shadow: 0 0 8px var(--sc); }
    .hb-note { margin: 0; font-size: 12px; color: var(--ink-muted); }

    @media (prefers-reduced-motion: reduce) {
      :host(.hype) .hglow, :host(.r2)::before, .live .dot::after,
      .orbit::before, .sparks i, .flames, :host(.max), :host(.max) .num,
      .shout, .echo, :host(.g8) .title, :host(.g8) .num, .lock i, .shards i { animation: none; }
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
  protected readonly segs = HYPE_STEPS.map((_, i) => i);
  /** уровень для силы свечения: дальше 5-го не растёт */
  protected readonly glowLv = computed(() => Math.min(5, this.hy().level));
  /** искры: где вылетают, задержка, время полёта, снос вбок */
  /** осколки аншлага: направление разлёта, задержка, размер */
  protected readonly shards = Array.from({ length: 16 }, (_, i) => ({ a: i * 22.5 + ((i * 7) % 11), d: ((i * 0.37) % 2.2).toFixed(2), s: 8 + ((i * 5) % 9) }));
  protected readonly sparks = Array.from({ length: 12 }, (_, i) => ({
    x: 4 + ((i * 37) % 92),
    d: ((i * 0.53) % 2.4).toFixed(2),
    t: (1.6 + ((i * 0.31) % 1.2)).toFixed(2),
    dx: ((i * 13) % 30) - 15,
  }));
  /** форма слова «пилот» для числа: one (1, 21), few (2–4, 22–24), many (5–20, 25…) */
  protected plural(n: number) {
    const d = n % 10, h = n % 100;
    return d === 1 && h !== 11 ? 'one' : d >= 2 && d <= 4 && (h < 12 || h > 14) ? 'few' : 'many';
  }
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
