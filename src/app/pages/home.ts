import { Component, isDevMode } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { NextStage } from '../components/next-stage';
import { Reveal } from '../reveal';

// Шум fractalNoise → полупрозрачный светлый «дым»; stitchTiles даёт бесшовный повтор по ширине тайла
const smoke = (seed: number, w: number, h: number) =>
  `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='${w}' height='${h}'%3E%3Cfilter id='f' x='0' y='0' width='100%25' height='100%25'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='${(3 / w).toFixed(4)} ${(2 / h).toFixed(4)}' numOctaves='4' seed='${seed}' stitchTiles='stitch'/%3E%3CfeColorMatrix values='0 0 0 0 0.82 0 0 0 0 0.96 0 0 0 0 0.95 1.9 0 0 0 -0.78'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23f)'/%3E%3C/svg%3E")`;

// Живой этап, лидеры и спонсоры — шаг 5.1
@Component({
  selector: 'app-home',
  imports: [RouterLink, TranslocoPipe, Reveal, NextStage],
  template: `
    <section class="hero">
      <div class="glow" aria-hidden="true"><i></i><i></i></div>
      <span class="kanji" aria-hidden="true">ドリフト</span>
      <div class="smoke back" aria-hidden="true" [style.background-image]="smokeBack"></div>
      <div class="smoke front" aria-hidden="true" [style.background-image]="smokeFront"></div>
      <div class="grain" aria-hidden="true"></div>

      <div class="container inner">
        <div class="text">
          <p class="chip rise"><span class="dot"></span>{{ 'home.chip' | transloco }}</p>
          <h1 class="display-xl rise" style="--i: 1">Sad Drift<br /><span class="accent">Series</span></h1>
          <p class="lead muted rise" style="--i: 2">{{ 'home.lead' | transloco }}</p>
          <div class="cta rise" style="--i: 3">
            <a routerLink="/stages" class="btn btn-primary">{{ 'home.toStages' | transloco }} →</a>
            <a routerLink="/standings" class="btn btn-secondary">{{ 'home.toStandings' | transloco }}</a>
          </div>
          <!-- shortcut: спонсор вписан вручную; перейдёт в таблицу sponsors на шаге 7.1 -->
          <a class="sponsor rise" style="--i: 4" href="https://carx-online.com" target="_blank" rel="noopener">
            <span class="sponsor-lbl">{{ 'sponsor.general' | transloco }}</span>
            <span class="sponsor-name">CarX Technologies</span>
          </a>
        </div>
        <app-next-stage class="rise" style="--i: 4" [stage]="demo ? 'Этап 1 · Ebisu Minami' : null" [startsAt]="demoStart" [registered]="demo ? 41 : 0" />
      </div>
    </section>

    <section class="section container">
      <p class="eyebrow" reveal>{{ 'home.how.eyebrow' | transloco }}</p>
      <h2 class="display-lg" reveal>{{ 'home.how.title' | transloco }}</h2>
      <div class="steps">
        @for (step of steps; track step; let i = $index) {
          <article class="card card-hover step" reveal [style.--i]="i">
            <span class="step-no mono">0{{ i + 1 }}</span>
            <h3>{{ 'home.how.' + step + '.title' | transloco }}</h3>
            <p class="muted">{{ 'home.how.' + step + '.text' | transloco }}</p>
          </article>
        }
      </div>
    </section>
  `,
  styles: `
    .hero {
      position: relative;
      overflow: hidden;
      min-height: calc(100svh - 64px);
      display: flex;
      align-items: center;
      padding: 64px 0 160px;
      isolation: isolate;
    }
    .inner {
      position: relative;
      width: 100%;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 48px;
    }
    @media (max-width: 900px) {
      .inner { flex-direction: column; align-items: flex-start; }
    }

    /* Бирюзовое свечение, как от неона в ночи */
    .glow i {
      position: absolute;
      z-index: -2;
      border-radius: 50%;
      filter: blur(70px);
      animation: breathe 14s var(--ease-in-out) infinite alternate;
    }
    .glow i:nth-child(1) {
      width: 50vw; height: 50vw; right: -8vw; top: -12vw;
      background: radial-gradient(circle, rgba(10, 186, 181, 0.3), transparent 65%);
    }
    .glow i:nth-child(2) {
      width: 36vw; height: 36vw; left: -10vw; bottom: -6vw;
      background: radial-gradient(circle, rgba(10, 186, 181, 0.14), transparent 65%);
      animation-delay: -7s;
    }
    @keyframes breathe {
      from { transform: scale(1); opacity: 0.8; }
      to { transform: scale(1.12) translate(-3vw, 2vw); opacity: 1; }
    }

    /* Дым от шин: два слоя бесшовной текстуры плывут с разной скоростью */
    .smoke {
      position: absolute;
      left: 0;
      bottom: 0;
      z-index: -1;
      background-repeat: repeat-x;
      background-position: left bottom;
      mask-image: linear-gradient(to top, #000 0%, rgba(0, 0, 0, 0.8) 30%, transparent 100%);
      pointer-events: none;
      will-change: transform;
    }
    .smoke.back {
      width: calc(100% + 900px);
      height: 75%;
      background-size: 900px 100%;
      opacity: 0.35;
      animation: roll 90s linear infinite;
      --tile: -900px;
    }
    .smoke.front {
      width: calc(100% + 1400px);
      height: 55%;
      background-size: 1400px 100%;
      opacity: 0.55;
      animation: roll 60s linear infinite reverse;
      --tile: -1400px;
    }
    @keyframes roll {
      to { transform: translateX(var(--tile)); }
    }
    /* Низ героя растворяется в фоне — без жёсткого края */
    .hero::after {
      content: '';
      position: absolute;
      inset: auto 0 0;
      height: 120px;
      z-index: -1;
      background: linear-gradient(to bottom, transparent, var(--canvas));
    }

    .grain {
      position: absolute;
      inset: 0;
      z-index: -1;
      opacity: 0.06;
      pointer-events: none;
      background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
    }

    .kanji {
      position: absolute;
      right: -2vw;
      bottom: 4vw;
      z-index: -2;
      font-size: clamp(120px, 20vw, 300px);
      font-weight: 600;
      line-height: 1;
      color: transparent;
      -webkit-text-stroke: 1px rgba(10, 186, 181, 0.25);
      user-select: none;
      pointer-events: none;
    }

    .chip {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      margin: 0;
      padding: 6px 14px;
      border: 1px solid rgba(10, 186, 181, 0.35);
      border-radius: var(--r-pill);
      background: rgba(10, 186, 181, 0.08);
      color: var(--primary);
      font-size: 12px;
      font-weight: 500;
      letter-spacing: 1px;
      text-transform: uppercase;
      backdrop-filter: blur(6px);
    }
    .dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: var(--primary);
      animation: pulse 2s ease-out infinite;
    }
    @keyframes pulse {
      from { box-shadow: 0 0 0 0 var(--primary-glow); }
      to { box-shadow: 0 0 0 10px transparent; }
    }

    h1 { margin: 20px 0 24px; }
    .accent {
      background: linear-gradient(100deg, #0abab5 0%, #7ff5ef 45%, #0abab5 60%, #067f7b 100%);
      background-size: 250% 100%;
      -webkit-background-clip: text;
      background-clip: text;
      color: transparent;
      filter: drop-shadow(0 0 28px rgba(10, 186, 181, 0.45));
      animation: shine 2.5s var(--ease-out) 0.6s both;
    }
    @keyframes shine {
      from { background-position: 100% 0; }
      to { background-position: 0 0; }
    }
    .lead { max-width: 520px; font-size: 18px; margin: 0 0 32px; }
    .cta { display: flex; flex-wrap: wrap; gap: 12px; }

    /* Генеральный спонсор */
    .sponsor {
      display: inline-grid;
      gap: 4px;
      margin-top: 48px;
      padding: 0 0 0 16px;
      border-left: 2px solid var(--primary);
      background: none;
      color: var(--ink);
      &:hover { color: var(--primary-hover); }
    }
    .sponsor-lbl {
      font-size: 11px;
      letter-spacing: 1.5px;
      text-transform: uppercase;
      color: var(--ink-subtle);
    }
    .sponsor-name {
      font-size: 20px;
      font-weight: 600;
      letter-spacing: 0.04em;
      text-transform: uppercase;
      transition: color var(--fast);
    }

    h2 { margin: 12px 0 48px; max-width: 640px; }
    .steps {
      display: grid;
      gap: 24px;
      grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
    }
    .step {
      h3 { font-size: 20px; margin: 16px 0 8px; }
      p { margin: 0; }
    }
    .step-no {
      font-size: 48px;
      line-height: 1;
      color: transparent;
      -webkit-text-stroke: 1px var(--primary);
    }
  `,
})
export class Home {
  protected readonly steps = ['qual', 'bracket', 'final'];
  protected readonly smokeBack = smoke(7, 900, 500);
  protected readonly smokeFront = smoke(21, 1400, 450);
  // shortcut: демо-цифры счётчика только в dev, пока нет базы; заменить данными этапа на шаге 5.1
  protected readonly demo = isDevMode();
  protected readonly demoStart = this.demo ? new Date(Date.now() + (3 * 24 + 5) * 3600_000) : null;
}
