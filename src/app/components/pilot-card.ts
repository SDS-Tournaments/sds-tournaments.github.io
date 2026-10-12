import { Component, computed, ElementRef, input, signal, viewChild } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { Tier, tierOf } from '../tier';

export { tierOf };
export type { Tier };

export interface CardData {
  nickname: string;
  start_number: number | null;
  avatar_url: string | null;
  team: string | null;
  car: string | null;
  overall: number | null;
  angle: number | null;
  style: number | null;
  line: number | null;
  wins: number;
}


// FIFA-карточка пилота (5 уровней оформления) + скачивание PNG
@Component({
  selector: 'app-pilot-card',
  imports: [TranslocoPipe],
  template: `
    <div #card class="fut" [class]="tier()" [class.champ]="champ()">
      <div class="shade"></div>
      @if (tier() === 'elite' || tier() === 'legend') { <div class="shine"></div> }
      @if (tier() === 'legend') {
        <div class="ribbon">LEGEND</div>
        <span class="spark s1">✦</span><span class="spark s2">✦</span><span class="spark s3">✦</span>
      }
      <!-- спецкарточка чемпиона: фольга, корона со звёздами побед, лавровый венок — в цветах своего уровня -->
      @if (champ()) {
        <div class="foil"></div>
        <div class="champ-badge" [attr.aria-label]="('pilot.wins' | transloco) + ': ' + d().wins">
          <svg class="crown" viewBox="0 0 40 26" aria-hidden="true">
            <path d="M3 22 L1 6 L11 13 L20 1 L29 13 L39 6 L37 22 Z" />
            <rect x="3" y="22.5" width="34" height="3" rx="1.5" />
          </svg>
          <span class="st">
            @if (d().wins <= 5) {
              @for (s of [1, 2, 3, 4, 5].slice(0, d().wins); track s) { <i [style.animation-delay.ms]="s * 300">★</i> }
            } @else {
              <i>★</i><b>×{{ d().wins }}</b>
            }
          </span>
          <span class="cap">CHAMPION</span>
        </div>
      }
      <div class="top">
        <div class="ovr">
          <span class="big">{{ d().overall ?? '—' }}</span>
          <span class="tag">OVR</span>
          <span class="num mono">#{{ d().start_number ?? '—' }}</span>
        </div>
        <span class="brand mono">SDS</span>
      </div>
      <div class="face-wrap">
        @if (champ()) {
          <svg class="laurel" viewBox="0 0 200 160" aria-hidden="true">
            @for (l of leaves; track $index) {
              <ellipse [attr.cx]="l.x" [attr.cy]="l.y" rx="10" ry="4.2" [attr.transform]="'rotate(' + l.r + ' ' + l.x + ' ' + l.y + ')'" />
            }
          </svg>
        }
        <div class="face">
          @if (d().avatar_url) { <img [src]="d().avatar_url" alt="" crossorigin="anonymous" /> } @else { <span class="noface">{{ d().nickname[0] }}</span> }
        </div>
      </div>
      <p class="nick">{{ d().nickname }}</p>
      <p class="team">{{ d().team ?? 'Sad Drift Series' }}</p>
      <div class="stats mono">
        <span><b>{{ d().angle ?? '—' }}</b>ANG</span>
        <span><b>{{ d().style ?? '—' }}</b>STY</span>
        <span><b>{{ d().line ?? '—' }}</b>LIN</span>
        <span><b>{{ d().wins }}</b>WIN</span>
      </div>
      <p class="foot"><span class="tiername">{{ tier() }}</span>@if (d().car) { · {{ d().car }} }</p>
    </div>
    @if (downloadable()) {
      <button class="btn btn-secondary dl" (click)="download()" [disabled]="busy()">⬇ {{ 'pilot.download' | transloco }}</button>
    }
    @if (error()) { <p class="bad">{{ error() }}</p> }
  `,
  styles: `
    :host { display: grid; gap: 12px; justify-items: center; }

    /* Общая форма. Рамка — градиент в border-box под тёмной подложкой */
    .fut {
      --accent: #d08b52;
      --frame: linear-gradient(160deg, #6e4520, #d9a066 45%, #7a4a20);
      --ink: #fff;
      --muted: #a8a8a8;
      --body: #070707;
      --bw: 2px;
      --glow: transparent;
      position: relative; width: 300px; height: 440px; overflow: hidden;
      display: grid; justify-items: center; align-content: start;
      padding: 22px 22px 16px; color: var(--ink); text-align: center;
      border: var(--bw) solid transparent;
      border-radius: 22px 22px 60px 60px / 22px 22px 40px 40px;
      background: linear-gradient(var(--body), var(--body)) padding-box, var(--frame) border-box;
      box-shadow: 0 24px 60px -24px var(--glow);
    }
    .shade { position: absolute; inset: 0; background: linear-gradient(180deg, rgba(0, 0, 0, 0.3) 0%, rgba(0, 0, 0, 0.6) 45%, var(--body) 86%); }
    .fut > :not(.shade):not(.shine):not(.spark):not(.ribbon):not(.foil):not(.champ-badge) { position: relative; }

    /* ── Чемпион: всё в цвете уровня (--champ), сама тема карточки не меняется ── */
    .fut { --champ: var(--accent); }
    .legend { --champ: #c9971c; }
    .champ { box-shadow: 0 24px 70px -18px color-mix(in srgb, var(--champ), transparent 35%); }
    /* фольга: косая штриховка + бегущий перелив */
    .foil {
      position: absolute; inset: 0; overflow: hidden; pointer-events: none;
      background: repeating-linear-gradient(115deg, transparent 0 11px, color-mix(in srgb, var(--champ), transparent 88%) 11px 12px);
      mask-image: linear-gradient(180deg, #000 0%, rgba(0, 0, 0, 0.55) 55%, transparent 80%);
    }
    .foil::after {
      content: ''; position: absolute; inset: 0;
      background: linear-gradient(115deg, transparent 30%, color-mix(in srgb, var(--champ), transparent 72%) 45%, transparent 60%);
      animation: foil 5s linear infinite;
    }
    @keyframes foil { from { transform: translateX(-100%); } to { transform: translateX(100%); } }
    /* корона + звёзды побед */
    .champ-badge {
      position: absolute; top: 16px; left: 50%; z-index: 2; transform: translateX(-50%);
      display: grid; justify-items: center; gap: 3px; color: var(--champ);
      filter: drop-shadow(0 0 8px color-mix(in srgb, var(--champ), transparent 40%));
    }
    .crown { width: 38px; height: 25px; fill: currentColor; }
    .st { display: flex; align-items: center; gap: 2px; font-size: 14px; line-height: 1; }
    .st i { font-style: normal; animation: star 2.4s ease-in-out infinite; }
    .st b { margin-left: 3px; font: 400 13px 'Russo One', var(--font); }
    .cap { font: 400 9px 'Russo One', var(--font); letter-spacing: 3px; opacity: 0.85; }
    @keyframes star { 0%, 100% { transform: scale(1); opacity: 1; } 50% { transform: scale(1.25); opacity: 0.7; } }
    /* лавровый венок вокруг аватара */
    .face-wrap { position: relative; margin-top: -18px; }
    .laurel {
      position: absolute; left: 50%; top: 50%; transform: translate(-50%, -46%);
      width: 200px; height: 160px; fill: var(--champ); opacity: 0.95;
      filter: drop-shadow(0 0 6px color-mix(in srgb, var(--champ), transparent 50%));
    }
    .fut.champ .face { box-shadow: 0 0 0 3px var(--body), 0 0 0 5px var(--champ), 0 0 30px color-mix(in srgb, var(--champ), transparent 45%); }
    .top { width: 100%; display: flex; justify-content: space-between; align-items: start; }
    .ovr { display: grid; justify-items: center; line-height: 1; }
    .big { font: 600 48px var(--mono); color: var(--accent); }
    .tag { font-size: 11px; letter-spacing: 2px; color: var(--muted); margin-top: 2px; }
    .num { margin-top: 10px; font-size: 18px; font-style: italic; }
    .brand { font-size: 12px; padding: 3px 7px; border: 1px solid var(--accent); border-radius: 6px; color: var(--accent); letter-spacing: 1px; }
    .face { width: 124px; height: 124px; border-radius: 50%; overflow: hidden; box-shadow: 0 0 0 3px var(--body), 0 0 0 5px var(--accent); }
    .face img { width: 100%; height: 100%; object-fit: cover; }
    .noface { display: grid; place-items: center; width: 100%; height: 100%; background: #1a1a1a; font: 600 48px var(--font); color: var(--accent); }
    .nick { margin: 16px 0 0; font-size: 24px; font-weight: 600; letter-spacing: -0.02em; max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .team { margin: 2px 0 0; font-size: 12px; letter-spacing: 1.5px; text-transform: uppercase; color: var(--accent); }
    .stats { width: 100%; display: grid; grid-template-columns: repeat(4, 1fr); margin-top: 16px; padding-top: 12px; border-top: 1px solid color-mix(in srgb, var(--accent), transparent 70%); }
    .stats span { display: grid; font-size: 10px; letter-spacing: 1px; color: var(--muted); }
    .stats b { font-size: 22px; color: var(--ink); font-weight: 500; }
    .foot { margin: 12px 0 0; font-size: 11px; color: var(--muted); }
    .tiername { text-transform: uppercase; letter-spacing: 2px; color: var(--accent); }

    /* BRONZE — простая */

    /* SILVER — холодный металл, минимальная окантовка */
    .silver {
      --accent: #e3e8eb;
      --frame: linear-gradient(150deg, #7d868c, #f4f7f8 40%, #9aa3a9 60%, #e9edef);
      --muted: #b7bec2;
      --glow: rgba(220, 230, 235, 0.25);
    }

    /* GOLD — двойная окантовка и металлический перелив */
    .gold {
      --accent: #f5d77a;
      --frame: linear-gradient(135deg, #7a5a14, #f8e08e 22%, #b8902c 45%, #fff2b8 62%, #8a6a1c 82%, #e8c763);
      --bw: 3px;
      --muted: #c9b98a;
      --glow: rgba(245, 215, 122, 0.45);
    }
    .gold::after {
      content: ''; position: absolute; inset: 6px; border-radius: 18px 18px 54px 54px / 18px 18px 36px 36px;
      border: 1px solid rgba(245, 215, 122, 0.35); pointer-events: none;
    }
    .gold .big { text-shadow: 0 0 18px rgba(245, 215, 122, 0.5); }

    /* ELITE — фиолетовый неон, вращающаяся рамка, спортивный шрифт */
    .elite {
      --accent: #c79bff;
      --spin: conic-gradient(#6a2cff, #c79bff, #ff4fd8, #0abab5, #6a2cff);
      --spin-s: 6s;
      --bw: 3px;
      --body: #0b0614;
      --muted: #b6a3d6;
      --glow: rgba(160, 90, 255, 0.6);
    }
    /* рамка без border: снизу вращается конический градиент, сверху — тело карточки с отступом в толщину рамки */
    .elite, .legend {
      border: 0; isolation: isolate; background: none;
      padding: calc(22px + var(--bw)) calc(22px + var(--bw)) calc(16px + var(--bw));
    }
    .elite::before, .legend::before {
      content: ''; position: absolute; inset: -60%; z-index: -2; background: var(--spin);
      animation: spin var(--spin-s) linear infinite;
    }
    .elite::after, .legend::after { content: ''; position: absolute; z-index: -1; background: var(--body); }
    /* тело и слои, которые раньше лежали внутри border, — внутрь рамки */
    .elite::after, .legend::after, .elite .shade, .legend .shade, .elite .foil, .legend .foil {
      inset: var(--bw);
      border-radius: calc(22px - var(--bw)) calc(22px - var(--bw)) calc(60px - var(--bw)) calc(60px - var(--bw)) / calc(22px - var(--bw)) calc(22px - var(--bw)) calc(40px - var(--bw)) calc(40px - var(--bw));
    }
    .elite .big, .legend .big { font-family: 'Russo One', var(--font); font-weight: 400; font-size: 52px; }
    .elite .big { background: linear-gradient(180deg, #fff, #c79bff); -webkit-background-clip: text; background-clip: text; color: transparent; filter: drop-shadow(0 0 12px rgba(199, 155, 255, 0.6)); }
    .elite .nick, .legend .nick { font-family: 'Russo One', var(--font); font-weight: 400; letter-spacing: 0.04em; text-transform: uppercase; font-size: 22px; }
    .elite .face { box-shadow: 0 0 0 3px var(--body), 0 0 0 5px var(--accent), 0 0 28px rgba(199, 155, 255, 0.6); }
    @keyframes spin { to { transform: rotate(360deg); } }

    /* LEGEND — белый перламутр, голографическая рамка, блеск, искры, лента */
    .legend {
      --accent: #2b2b2b;
      --spin: conic-gradient(#ff6ec7, #ffd36e, #7dffb0, #6ee7ff, #b28dff, #ff6ec7);
      --spin-s: 4s;
      --bw: 4px;
      --body: #f4f2ee;
      --ink: #111;
      --muted: #6f6a63;
      --glow: rgba(255, 255, 255, 0.55);
    }
    .legend .shade { background: linear-gradient(180deg, rgba(244, 242, 238, 0.4) 0%, rgba(244, 242, 238, 0.75) 45%, var(--body) 86%); }
    .legend .big { background: linear-gradient(120deg, #111, #6b5d45 40%, #111); -webkit-background-clip: text; background-clip: text; color: transparent; }
    .legend .brand { visibility: hidden; } /* место под ленту LEGEND */
    .legend .noface { background: linear-gradient(135deg, #fff, #e4ddd0); color: #8a6a1c; }
    .legend .face { box-shadow: 0 0 0 3px var(--body), 0 0 0 6px #111, 0 0 30px rgba(255, 211, 110, 0.7); }
    .legend .team { color: #8a6a1c; }
    .legend .tiername { background: linear-gradient(90deg, #ff6ec7, #ffd36e, #6ee7ff, #b28dff); -webkit-background-clip: text; background-clip: text; color: transparent; font-weight: 700; }
    .ribbon {
      position: absolute; top: 18px; right: -34px; z-index: 2; transform: rotate(38deg); width: 140px; padding: 4px 0;
      background: linear-gradient(90deg, #111, #3a3226, #111); color: #ffd36e; font: 400 11px 'Russo One', var(--font); letter-spacing: 3px; text-align: center;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
    }
    .spark { position: absolute; z-index: 2; color: #ffd36e; text-shadow: 0 0 8px #fff; animation: twinkle 2.4s ease-in-out infinite; }
    .s1 { top: 120px; left: 28px; font-size: 14px; }
    .s2 { top: 210px; right: 30px; font-size: 18px; animation-delay: 0.8s; }
    .s3 { top: 70px; left: 140px; font-size: 10px; animation-delay: 1.6s; }
    @keyframes twinkle { 0%, 100% { opacity: 0.2; transform: scale(0.7); } 50% { opacity: 1; transform: scale(1.15); } }

    /* Блик, пробегающий по Elite и Legend */
    .shine {
      position: absolute; inset: -40%; z-index: 1; pointer-events: none;
      background: linear-gradient(105deg, transparent 42%, rgba(255, 255, 255, 0.22) 50%, transparent 58%);
      animation: sweep 3.5s ease-in-out infinite;
    }
    .legend .shine { background: linear-gradient(105deg, transparent 40%, rgba(255, 255, 255, 0.7) 50%, transparent 60%); }
    @keyframes sweep { from { transform: translateX(-60%); } to { transform: translateX(60%); } }

    @media (prefers-reduced-motion: reduce) { .elite, .legend, .elite::before, .legend::before, .shine, .spark, .foil::after, .st i { animation: none; } }
    .bad { color: var(--error); font-size: 13px; margin: 0; }
  `,
})
export class PilotCard {
  readonly d = input.required<CardData>();
  readonly downloadable = input(true);
  protected readonly tier = computed(() => tierOf(this.d().overall));
  /** выигрывал этапы — спецкарточка чемпиона */
  protected readonly champ = computed(() => this.d().wins > 0);
  /** листья венка: две ветви по дуге вокруг аватара (центр 100,80, радиус 80) */
  protected readonly leaves = [0, 1, 2, 3, 4, 5, 6].flatMap((i) => {
    const a = ((100 + i * 19) * Math.PI) / 180;
    const x = 100 + 80 * Math.cos(a), y = 80 + 80 * Math.sin(a);
    const r = 100 + i * 19 + 90 - 35;
    return [{ x, y, r }, { x: 200 - x, y, r: -r }];
  });
  private readonly card = viewChild.required<ElementRef<HTMLElement>>('card');
  protected readonly busy = signal(false);
  protected readonly error = signal<string | null>(null);

  async download() {
    this.busy.set(true);
    this.error.set(null);
    try {
      const { toPng } = await import('html-to-image'); // библиотека грузится только при скачивании
      const url = await toPng(this.card().nativeElement, { pixelRatio: 2, cacheBust: true });
      const a = document.createElement('a');
      a.href = url;
      a.download = `SDS-${this.d().start_number ?? ''}-${this.d().nickname}.png`;
      a.click();
    } catch (e) {
      this.error.set(String((e as Error)?.message ?? e));
    } finally {
      this.busy.set(false);
    }
  }
}
