import { Component, computed, DestroyRef, effect, ElementRef, inject, input, signal, untracked } from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { hype, HYPE_STEPS, hypeX } from './hype';
import { Bolt, makeBolt } from './lightning';

const pad = (n: number) => String(n).padStart(2, '0');
/** id маски молний: карточек на странице может быть несколько (UI kit) */
let maskSeq = 0;

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
    '[class.lvx]': 'hypeOn() && lvx()',
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
         9 уголки-прицелы, искры, «Куда столько?» · 10 сердцебиение, осколки, пламя, тряска, «ВЫ ЧТО ТВОРИТЕ?»
         X (скрытый, 120+) вокруг карточки бьют молнии (сами стоят на месте), выбросы энергии, «ЭТО НЕРЕАЛЬНО» -->
    @if (hypeOn() && hy().level >= 7) { <i class="echo e1" aria-hidden="true"></i><i class="echo e2" aria-hidden="true"></i> }
    @if (hypeOn() && hy().level >= 6) { <i class="orbit" aria-hidden="true"></i> }
    @if (hypeOn() && hy().level >= 9) { <span class="shout" [class.loud]="hy().level >= 10" [style]="hy().level >= 10 ? glitchVars() : null">{{ (lvx() ? 'home.next.shoutX' : hy().level >= 10 ? 'home.next.shout10' : 'home.next.shout9') | transloco }}</span> }
    @if (hypeOn() && hy().level >= 9) {
      <span class="lock" aria-hidden="true"><i></i><i></i><i></i><i></i></span>
      <span class="sparks" aria-hidden="true">
        @for (k of sparks; track k.x) { <i [style.left.%]="k.x" [style.--dl.s]="k.d" [style.--du.s]="k.t" [style.--dx.px]="k.dx"></i> }
      </span>
    }
    @if (hypeOn() && lvx()) {
      <div class="xsky" aria-hidden="true">
        <i class="xaura"></i>
        <svg class="xbolts" viewBox="0 0 100 100" preserveAspectRatio="none">
          <!-- под карточкой молнию не видно: дыра в маске размером с карточку и пульсирует вместе с ней -->
          <defs>
            <mask [attr.id]="maskId" maskUnits="userSpaceOnUse" x="-60" y="-60" width="220" height="220">
              <rect x="-60" y="-60" width="220" height="220" fill="#fff" />
              <rect class="xhole" x="27.3" y="27.3" width="45.4" height="45.4" fill="#000" />
            </mask>
          </defs>
          <g [attr.mask]="'url(#' + maskId + ')'">
            @for (b of bolts(); track b.id) {
              <g class="bolt" [style.--bd.s]="b.dur" [style.opacity]="0.5 + 0.5 * b.power">
                @for (p of b.paths; track $index) { <path [attr.d]="p.d" pathLength="1" [class]="'l' + p.lv" [style.stroke-width]="p.w" [style.--dl.s]="p.dl" [style.--du.s]="p.du" /> }
              </g>
            }
          </g>
        </svg>
      </div>
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
            @if (lvx()) { <span class="mono xlv">X</span> } @else { <span class="mono">{{ hy().level }}/{{ hy().max }}</span> }
          </div>
          <div class="segs" aria-hidden="true">
            @for (i of segs; track i) {
              <i class="seg" [style.--sc]="color(i + 1, 0.95)"><b [style.width.%]="segFill(i)"></b></i>
            }
          </div>
          <p class="hb-note">
            @if (hy().toNext; as n) { {{ 'home.next.hypeNext' | transloco: { n, w: ('home.next.pilots.' + plural(n)) | transloco, l: hy().level + 1 } }} }
            @else if (lvx()) { <span class="xnote">{{ 'home.next.hypeX' | transloco }}</span> }
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
    /* цвета расслоения в глитчах — из темы и уровня, а не «киберпанковые» */
    :host { --gA: var(--hc); --gB: color-mix(in oklab, var(--primary), #fff 25%); }
    /* 5: острые углы, рамка толще, карточка крупнее */
    :host(.g5) { border-radius: 0; border-width: 2px; scale: 1.03; transition: border-radius 600ms var(--ease-out), scale 600ms var(--ease-out); }
    /* 9–10: надпись-штамп поверх карточки: впечатывается, держится, пропадает и снова */
    .shout {
      position: absolute; left: 50%; top: 42%; z-index: 3; pointer-events: none; white-space: nowrap;
      padding: 8px 16px; border: 2px solid var(--hc); background: rgba(0, 0, 0, 0.82);
      color: var(--hc); font: 400 24px 'Russo One', var(--font); letter-spacing: 0.04em; text-transform: uppercase;
      text-shadow: 0 0 18px var(--hc); box-shadow: 0 0 30px -6px var(--hc);
      translate: -50% -50%; rotate: -8deg; opacity: 0;
      animation: shout 10s cubic-bezier(0.3, 1.5, 0.5, 1) 0.6s infinite;
    }
    /* 100+: без рамки, чуть шире карточки; пишется слева направо красным → вспыхивает белым → сильный глитч и тряска → исчезает */
    .shout.loud {
      padding: 0; border: 0; background: none; box-shadow: none; rotate: -5deg;
      font: 400 40px 'Russo One', var(--font); letter-spacing: 0.02em;
      color: var(--hc); text-shadow: none;
      mask-image: linear-gradient(90deg, #000 46%, transparent 54%); mask-size: 260% 100%; mask-repeat: no-repeat;
      animation: rage 10s linear 0.6s infinite;
    }
    /* во время глитча текст подменяется «сходящими с ума» вариантами (--g1…--g5 из glitchVars), --g0 — настоящий */
    .shout.loud::after {
      content: var(--g0); position: absolute; left: 0; top: 0; white-space: nowrap; color: color-mix(in oklab, var(--hc), #fff 70%);
      opacity: 0; animation: scram 10s steps(1) 0.6s infinite;
    }
    @keyframes scram {
      0%, 18.95% { opacity: 0; translate: 0 0; text-shadow: none; }
      19% { content: var(--g3); opacity: 1; translate: -8px -2px; text-shadow: 6px 0 var(--gA), -6px 0 var(--gB); }
      19.75% { content: var(--g1); opacity: 1; translate: 8px 1px; text-shadow: 6px 0 var(--gA), -6px 0 var(--gB); }
      20.5% { content: var(--g4); opacity: 1; translate: 3px -3px; text-shadow: 6px 0 var(--gA), -6px 0 var(--gB); }
      21.25% { content: var(--g0); opacity: 1; translate: 4px -3px; text-shadow: 7px 0 var(--gA), -7px 0 var(--gB); }
      22% { content: var(--g1); opacity: 1; translate: -10px 4px; text-shadow: 11px 0 var(--gA), -11px 0 var(--gB); }
      22.75% { content: var(--g0); opacity: 1; translate: -1px 4px; text-shadow: 4px 0 var(--gA), -4px 0 var(--gB); }
      23.5% { content: var(--g3); opacity: 1; translate: 4px -2px; text-shadow: 4px 0 var(--gA), -4px 0 var(--gB); }
      24.25% { content: var(--g3); opacity: 1; translate: -6px 0px; text-shadow: 5px 0 var(--gA), -5px 0 var(--gB); }
      25% { content: var(--g0); opacity: 1; translate: 6px -1px; text-shadow: 5px 0 var(--gA), -5px 0 var(--gB); }
      25.75% { content: var(--g0); opacity: 1; translate: 9px -2px; text-shadow: 10px 0 var(--gA), -10px 0 var(--gB); }
      26.5% { content: var(--g2); opacity: 1; translate: 2px -1px; text-shadow: 9px 0 var(--gA), -9px 0 var(--gB); }
      27.25% { content: var(--g1); opacity: 1; translate: -6px 0px; text-shadow: 3px 0 var(--gA), -3px 0 var(--gB); }
      28% { content: var(--g0); opacity: 1; translate: -2px 1px; text-shadow: 8px 0 var(--gA), -8px 0 var(--gB); }
      28.75% { content: var(--g2); opacity: 1; translate: -1px 0px; text-shadow: 6px 0 var(--gA), -6px 0 var(--gB); }
      29.5% { content: var(--g3); opacity: 1; translate: -1px -2px; text-shadow: 4px 0 var(--gA), -4px 0 var(--gB); }
      30.25% { content: var(--g1); opacity: 1; translate: -5px 2px; text-shadow: 10px 0 var(--gA), -10px 0 var(--gB); }
      31% { content: var(--g5); opacity: 1; translate: 8px 2px; text-shadow: 8px 0 var(--gA), -8px 0 var(--gB); }
      31.75% { content: var(--g1); opacity: 1; translate: -4px -1px; text-shadow: 4px 0 var(--gA), -4px 0 var(--gB); }
      32.5% { content: var(--g4); opacity: 0.25; translate: 5px -2px; text-shadow: 11px 0 var(--gA), -11px 0 var(--gB); }
      33.25% { content: var(--g3); opacity: 0.25; translate: -1px -3px; text-shadow: 11px 0 var(--gA), -11px 0 var(--gB); }
      34% { content: var(--g3); opacity: 1; translate: -1px -3px; text-shadow: 9px 0 var(--gA), -9px 0 var(--gB); }
      34.75% { content: var(--g1); opacity: 1; translate: -8px 2px; text-shadow: 8px 0 var(--gA), -8px 0 var(--gB); }
      35.5% { content: var(--g2); opacity: 0.25; translate: 7px -3px; text-shadow: 2px 0 var(--gA), -2px 0 var(--gB); }
      36%, 100% { opacity: 0; content: var(--g0); }
    }
    /* светлая тема LEGEND: надписи тёмные на светлом — белое там не видно */
    :host-context([data-theme='legend']) .shout { background: #fbf7ee; color: #6b4f08; text-shadow: none; }
    :host-context([data-theme='legend']) .shout.loud { background: none; color: var(--hc); --flash: #1a1405; }
    :host-context([data-theme='legend']) .shout.loud::after { color: #1a1405; }
    @keyframes rage {
      0% { opacity: 1; mask-position: 100% 0; color: var(--hc); }
      17% { mask-position: 0 0; color: var(--hc); }
      18% { color: var(--flash, #fff); }
      18.95% { color: var(--flash, #fff); }
      19%, 35.95% { color: transparent; mask-position: 0 0; opacity: 1; }
      36%, 100% { opacity: 0; mask-position: 0 0; color: transparent; }
    }
    @keyframes shout {
      0% { opacity: 0; scale: 2.4; }
      4% { opacity: 1; scale: 1; }
      30% { opacity: 1; scale: 1; }
      35%, 100% { opacity: 0; scale: 0.9; }
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
      88% { transform: translate(-4px, 1px) skewX(-10deg); text-shadow: 3px 0 var(--gA), -3px 0 var(--gB); }
      91% { transform: translate(4px, -1px); text-shadow: -4px 0 var(--gA), 4px 0 var(--gB); }
      94% { transform: translate(-2px, 0) skewX(6deg); text-shadow: 2px 0 var(--gA), -2px 0 var(--gB); }
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

    /* ── X: молнии вокруг карточки. Слой ×2.2 (карточка — середина 27.3…72.7%) и гасит пульс и тряску карточки обратной анимацией — молнии стоят на месте ── */
    .xsky {
      position: absolute; inset: -60%; z-index: -1; pointer-events: none;
      animation: x-heart-inv 1.1s ease-in-out infinite, x-jolt-inv 3.2s ease-in infinite;
    }
    @keyframes x-heart-inv { 0%, 100% { scale: 0.9709; } 12% { scale: 0.9174; } 24% { scale: 0.9709; } 36% { scale: 0.9346; } 50% { scale: 0.9709; } }
    @keyframes x-jolt-inv {
      0%, 74%, 100% { translate: 0 0; }
      76% { translate: 7px -3px; }
      78% { translate: -8px 4px; }
      80% { translate: 6px 2px; }
      82% { translate: -4px -3px; }
      85% { translate: 2px 0; }
    }
    .xbolts {
      position: absolute; inset: 0; width: 100%; height: 100%; overflow: visible;
      filter: drop-shadow(0 0 1.5px #fff) drop-shadow(0 0 7px var(--hc)) drop-shadow(0 0 22px var(--hc));
    }
    .xbolts path {
      fill: none; stroke: #fff; stroke-linecap: round; stroke-linejoin: round;
      /* прорастает от начала к концу: канал первым, отростки — когда канал дошёл до их места */
      stroke-dasharray: 1; stroke-dashoffset: 1;
    }
    @keyframes grow { to { stroke-dashoffset: 0; } }
    .xhole { transform-box: fill-box; transform-origin: center; animation: heart 1.1s ease-in-out infinite; }
    .xbolts path.l2 { opacity: 0.75; }
    /* удар: пока прорастает — видна; потом мерцание, повторный разряд и медленно гаснет */
    /* яркость — по силе удара (opacity на самой группе), мерцание — на пути */
    .bolt path { animation: grow var(--du) cubic-bezier(0.3, 0.6, 0.4, 1) var(--dl) forwards, strike var(--bd) linear forwards; }
    @keyframes strike {
      0%, 40% { opacity: 1; } 44% { opacity: 0.35; } 48% { opacity: 1; } 56% { opacity: 0.6; }
      61% { opacity: 1; } 78% { opacity: 0.7; } 100% { opacity: 0; }
    }
    .xaura {
      position: absolute; inset: 13.6%; z-index: -1; border-radius: 50%;
      background: radial-gradient(closest-side, color-mix(in oklab, var(--hc), #fff 45%), color-mix(in oklab, var(--hc), transparent 55%) 45%, transparent 75%);
      opacity: 0.35; animation: x-aura 3.2s ease-in infinite;
    }
    @keyframes x-aura { 0%, 70%, 100% { opacity: 0.3; scale: 0.9; } 78% { opacity: 0.85; scale: 1.15; } 90% { opacity: 0.4; scale: 1; } }
    /* карточку дёргает в момент выброса */
    :host(.lvx) { animation: heart 1.1s ease-in-out infinite, x-jolt 3.2s ease-in infinite; }
    @keyframes x-jolt {
      0%, 74%, 100% { translate: 0 0; }
      76% { translate: -7px 3px; }
      78% { translate: 8px -4px; }
      80% { translate: -6px -2px; }
      82% { translate: 4px 3px; }
      85% { translate: -2px 0; }
    }
    .xlv { font: 400 15px 'Russo One', var(--font); color: #fff; text-shadow: 0 0 6px var(--hc), 0 0 16px var(--hc); animation: glitch 2.8s steps(1) infinite; }
    .xnote { color: #fff; font-weight: 600; text-shadow: 0 0 10px var(--hc); }

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
      .shout, .echo, :host(.g8) .title, :host(.g8) .num, .lock i, .shards i,
      .xsky, .xaura, :host(.lvx), .xlv, .xhole { animation: none; }
      .xbolts path, .bolt path { animation: none; stroke-dashoffset: 0; }
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
  protected readonly lvx = computed(() => hypeX(this.registered()));
  /** молнии уровня X: каждые 0.9–1.8 с новый удар в случайном месте, живёт ~2.4 с */
  protected readonly bolts = signal<Bolt[]>([]);
  protected readonly maskId = 'xmask' + ++maskSeq;
  /** позиция заполнения полоски в делениях (0…7): плавно едет от 0 к уровню + доле текущего */
  private readonly fillPos = signal(0);
  /** деление i заполняется, только когда линия до него доехала — одна непрерывная линия слева направо */
  protected segFill(i: number) {
    return Math.min(1, Math.max(0, this.fillPos() - i)) * 100;
  }
  protected readonly segs = HYPE_STEPS.map((_, i) => i);
  /** «ВЫ ЧТО ТВОРИТЕ?» во время глитча: настоящий текст и 5 вариантов, где часть букв заменена мусором */
  private readonly tl = inject(TranslocoService);
  private readonly shout10 = toSignal(this.tl.selectTranslate('home.next.shout10'), { initialValue: '' });
  private readonly shoutX = toSignal(this.tl.selectTranslate('home.next.shoutX'), { initialValue: '' });
  protected readonly glitchVars = computed(() => {
    const text = this.lvx() ? this.shoutX() : this.shout10();
    const junk = '#@%&$!?/<>*+=0137'; // без букв (одинаково для RU и EN) и только из шрифта надписи
    const vars: Record<string, string> = { '--g0': JSON.stringify(text) };
    for (let v = 1; v <= 5; v++) {
      const out = [...text].map((ch, i) => (ch !== ' ' && (i * 7 + v * 13) % 10 < 4 ? junk[(i * 11 + v * 5) % junk.length] : ch)).join('');
      vars['--g' + v] = JSON.stringify(out);
    }
    return vars;
  });
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

    // уровень X: молнии бьют в такт прыжкам карточки — по её CSS-анимациям (heart 1.1 с, x-jolt 3.2 с):
    // главный удар сердца — средняя молния, второй (послабее) — слабая, рывок — две сильные.
    // Без анимаций (reduced motion) — одна молния стоит.
    const host = inject(ElementRef).nativeElement as HTMLElement;
    effect((onCleanup) => {
      if (!this.hypeOn() || !this.lvx()) return this.bolts.set([]);
      if (matchMedia('(prefers-reduced-motion: reduce)').matches) return this.bolts.set([makeBolt(0)]);
      let n = 0;
      let raf = 0;
      const timers = new Set<ReturnType<typeof setTimeout>>();
      const strike = (power: number, side?: number) => {
        const b = makeBolt(++n, power, Math.random, side);
        this.bolts.update((list) => [...list.slice(-6), b]);
        const t = setTimeout(() => {
          timers.delete(t);
          this.bolts.update((list) => list.filter((x) => x !== b));
        }, b.dur * 1000 + 100);
        timers.add(t);
      };
      // пороги — чуть раньше пика прыжка: молния успевает «ударить» в момент толчка
      const beats = [
        { name: 'heart', ms: 1100, at: 0.08, power: () => 0.55 },
        { name: 'heart', ms: 1100, at: 0.32, power: () => 0.3 },
        { name: 'x-jolt', ms: 3200, at: 0.73, power: () => 1, double: true },
      ];
      const last = new Map<number, number>();
      const tick = () => {
        const anims = host.getAnimations() as CSSAnimation[];
        beats.forEach((b, i) => {
          // Angular приписывает к именам @keyframes префикс компонента: _ngcontent-…_heart
          const a = anims.find((x) => x.animationName === b.name || x.animationName.endsWith('_' + b.name));
          const ct = a?.currentTime;
          if (typeof ct !== 'number') return;
          const ph = (ct % b.ms) / b.ms;
          const prev = last.get(i);
          last.set(i, ph);
          if (prev === undefined) return;
          if ((prev < b.at && ph >= b.at) || (prev > ph && ph >= b.at)) {
            const side = Math.floor(Math.random() * 4);
            strike(b.power(), side);
            if (b.double) strike(b.power(), (side + 2) % 4);
          }
        });
        raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
      onCleanup(() => {
        cancelAnimationFrame(raf);
        timers.forEach(clearTimeout);
      });
    });

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
