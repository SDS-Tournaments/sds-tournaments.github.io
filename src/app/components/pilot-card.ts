import { Component, computed, ElementRef, input, signal, viewChild } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { toPng } from 'html-to-image';

export interface CardData {
  nickname: string;
  start_number: number | null;
  avatar_url: string | null;
  livery_url: string | null;
  team: string | null;
  car: string | null;
  overall: number | null;
  angle: number | null;
  style: number | null;
  line: number | null;
  wins: number;
}

export type Tier = 'bronze' | 'silver' | 'gold' | 'elite' | 'legend';

/** Уровень карточки по рейтингу: <75 бронза, 75–82 серебро, 83–89 золото, 90–94 элита, 95+ легенда */
export function tierOf(overall: number | null): Tier {
  const o = overall ?? 0;
  return o >= 95 ? 'legend' : o >= 90 ? 'elite' : o >= 83 ? 'gold' : o >= 75 ? 'silver' : 'bronze';
}

// FIFA-карточка пилота (5 уровней оформления) + скачивание PNG
@Component({
  selector: 'app-pilot-card',
  imports: [TranslocoPipe],
  template: `
    <div #card class="fut" [class]="tier()">
      <div class="bg" [style.background-image]="d().livery_url ? 'url(' + d().livery_url + ')' : null"></div>
      <div class="shade"></div>
      @if (tier() === 'elite' || tier() === 'legend') { <div class="shine"></div> }
      @if (tier() === 'legend') {
        <div class="ribbon">LEGEND</div>
        <span class="spark s1">✦</span><span class="spark s2">✦</span><span class="spark s3">✦</span>
      }
      <div class="top">
        <div class="ovr">
          <span class="big">{{ d().overall ?? '—' }}</span>
          <span class="tag">OVR</span>
          <span class="num mono">#{{ d().start_number ?? '—' }}</span>
        </div>
        <span class="brand mono">SDS</span>
      </div>
      <div class="face">
        @if (d().avatar_url) { <img [src]="d().avatar_url" alt="" crossorigin="anonymous" /> } @else { <span class="noface">{{ d().nickname[0] }}</span> }
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
    @property --ang { syntax: '<angle>'; inherits: false; initial-value: 0deg; }
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
    .bg { position: absolute; inset: 0; background: center / cover no-repeat; opacity: 0.85; }
    .shade { position: absolute; inset: 0; background: linear-gradient(180deg, rgba(0, 0, 0, 0.3) 0%, rgba(0, 0, 0, 0.6) 45%, var(--body) 86%); }
    .fut > :not(.bg):not(.shade):not(.shine):not(.spark):not(.ribbon) { position: relative; }
    .top { width: 100%; display: flex; justify-content: space-between; align-items: start; }
    .ovr { display: grid; justify-items: center; line-height: 1; }
    .big { font: 600 48px var(--mono); color: var(--accent); }
    .tag { font-size: 11px; letter-spacing: 2px; color: var(--muted); margin-top: 2px; }
    .num { margin-top: 10px; font-size: 18px; font-style: italic; }
    .brand { font-size: 12px; padding: 3px 7px; border: 1px solid var(--accent); border-radius: 6px; color: var(--accent); letter-spacing: 1px; }
    .face { width: 124px; height: 124px; margin-top: -18px; border-radius: 50%; overflow: hidden; box-shadow: 0 0 0 3px var(--body), 0 0 0 5px var(--accent); }
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
    .bronze .bg { opacity: 0.45; filter: sepia(0.6); }

    /* SILVER — холодный металл, минимальная окантовка */
    .silver {
      --accent: #e3e8eb;
      --frame: linear-gradient(150deg, #7d868c, #f4f7f8 40%, #9aa3a9 60%, #e9edef);
      --muted: #b7bec2;
      --glow: rgba(220, 230, 235, 0.25);
    }
    .silver .bg { opacity: 0.55; filter: grayscale(0.6); }

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
      --frame: conic-gradient(from var(--ang), #6a2cff, #c79bff, #ff4fd8, #0abab5, #6a2cff);
      --bw: 3px;
      --body: #0b0614;
      --muted: #b6a3d6;
      --glow: rgba(160, 90, 255, 0.6);
      animation: spin 6s linear infinite;
    }
    .elite .bg { filter: hue-rotate(40deg) saturate(1.2); }
    .elite .big, .legend .big { font-family: 'Russo One', var(--font); font-weight: 400; font-size: 52px; }
    .elite .big { background: linear-gradient(180deg, #fff, #c79bff); -webkit-background-clip: text; background-clip: text; color: transparent; filter: drop-shadow(0 0 12px rgba(199, 155, 255, 0.6)); }
    .elite .nick, .legend .nick { font-family: 'Russo One', var(--font); font-weight: 400; letter-spacing: 0.04em; text-transform: uppercase; font-size: 22px; }
    .elite .face { box-shadow: 0 0 0 3px var(--body), 0 0 0 5px var(--accent), 0 0 28px rgba(199, 155, 255, 0.6); }
    @keyframes spin { to { --ang: 360deg; } }

    /* LEGEND — белый перламутр, голографическая рамка, блеск, искры, лента */
    .legend {
      --accent: #2b2b2b;
      --frame: conic-gradient(from var(--ang), #ff6ec7, #ffd36e, #7dffb0, #6ee7ff, #b28dff, #ff6ec7);
      --bw: 4px;
      --body: #f4f2ee;
      --ink: #111;
      --muted: #6f6a63;
      --glow: rgba(255, 255, 255, 0.55);
      animation: spin 4s linear infinite;
    }
    .legend .bg { opacity: 0.35; filter: grayscale(1) contrast(1.1); }
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

    @media (prefers-reduced-motion: reduce) { .elite, .legend, .shine, .spark { animation: none; } }
    .bad { color: var(--error); font-size: 13px; margin: 0; }
  `,
})
export class PilotCard {
  readonly d = input.required<CardData>();
  readonly downloadable = input(true);
  protected readonly tier = computed(() => tierOf(this.d().overall));
  private readonly card = viewChild.required<ElementRef<HTMLElement>>('card');
  protected readonly busy = signal(false);
  protected readonly error = signal<string | null>(null);

  async download() {
    this.busy.set(true);
    this.error.set(null);
    try {
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
