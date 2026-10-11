import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { Reveal } from '../reveal';

// Живой этап, лидеры и спонсоры — шаг 5.1
@Component({
  selector: 'app-home',
  imports: [RouterLink, TranslocoPipe, Reveal],
  template: `
    <section class="hero">
      <div class="smoke" aria-hidden="true"><i></i><i></i><i></i></div>
      <div class="floor" aria-hidden="true"></div>
      <div class="streaks" aria-hidden="true"><i></i><i></i><i></i></div>
      <div class="grain" aria-hidden="true"></div>
      <span class="kanji" aria-hidden="true">ドリフト</span>

      <div class="container inner">
        <figure class="gauge rise" style="--i: 3" aria-hidden="true">
          <svg viewBox="0 0 240 240">
            <circle class="ring" cx="120" cy="120" r="100" />
            <circle class="arc" cx="120" cy="120" r="100" pathLength="100" />
            @for (t of ticks; track t) {
              <line class="tick" [class.major]="t % 15 === 0" x1="120" y1="24" x2="120" [attr.y2]="t % 15 === 0 ? 38 : 32" [attr.transform]="'rotate(' + (t * 4 - 120) + ' 120 120)'" />
            }
            <g class="needle"><line x1="120" y1="120" x2="120" y2="36" /><circle cx="120" cy="120" r="6" /></g>
          </svg>
          <figcaption>
            <span class="mono val">52°</span>
            <span class="lbl">{{ 'home.gauge' | transloco }}</span>
          </figcaption>
        </figure>
        <p class="chip rise"><span class="dot"></span>{{ 'home.chip' | transloco }}</p>
        <h1 class="display-xl rise" style="--i: 1">Sad Drift<br /><span class="accent">Series</span></h1>
        <p class="lead muted rise" style="--i: 2">{{ 'home.lead' | transloco }}</p>
        <div class="cta rise" style="--i: 3">
          <a routerLink="/stages" class="btn btn-primary">{{ 'home.toStages' | transloco }} →</a>
          <a routerLink="/standings" class="btn btn-secondary">{{ 'home.toStandings' | transloco }}</a>
        </div>
        <dl class="facts rise" style="--i: 4">
          <div><dt class="mono">32</dt><dd>{{ 'home.fact.bracket' | transloco }}</dd></div>
          <div><dt class="mono">3</dt><dd>{{ 'home.fact.judges' | transloco }}</dd></div>
          <div><dt class="mono">100</dt><dd>{{ 'home.fact.max' | transloco }}</dd></div>
        </dl>
      </div>
    </section>

    <div class="ticker" aria-hidden="true">
      <div class="track">
        @for (n of [0, 1]; track n) {
          <span>{{ 'home.ticker' | transloco }}</span>
        }
      </div>
    </div>

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
      padding: 64px 0 96px;
      isolation: isolate;
    }
    .inner { position: relative; width: 100%; }

    /* Дым от шин: размытые пятна медленно дрейфуют */
    .smoke i {
      position: absolute;
      border-radius: 50%;
      filter: blur(60px);
      z-index: -1;
      animation: drift 18s var(--ease-in-out) infinite alternate;
    }
    .smoke i:nth-child(1) {
      width: 55vw; height: 55vw; right: -10vw; top: -10vw;
      background: radial-gradient(circle, rgba(10, 186, 181, 0.28), transparent 65%);
    }
    .smoke i:nth-child(2) {
      width: 40vw; height: 40vw; right: 20vw; bottom: -20vw;
      background: radial-gradient(circle, rgba(10, 186, 181, 0.16), transparent 65%);
      animation-duration: 24s;
      animation-delay: -6s;
    }
    .smoke i:nth-child(3) {
      width: 35vw; height: 35vw; left: -12vw; top: 20%;
      background: radial-gradient(circle, rgba(255, 255, 255, 0.07), transparent 65%);
      animation-duration: 30s;
    }
    @keyframes drift {
      from { transform: translate(0, 0) scale(1); }
      to { transform: translate(-6vw, 4vw) scale(1.15); }
    }

    /* Телеметрическая сетка-асфальт в перспективе */
    .floor {
      position: absolute;
      left: -50%;
      right: -50%;
      bottom: 0;
      height: 50%;
      z-index: -1;
      background-image:
        linear-gradient(rgba(10, 186, 181, 0.4) 1px, transparent 1px),
        linear-gradient(90deg, rgba(10, 186, 181, 0.4) 1px, transparent 1px);
      background-size: 64px 64px;
      transform: perspective(500px) rotateX(62deg);
      transform-origin: bottom;
      mask-image: linear-gradient(to top, #000 0%, transparent 85%);
      animation: road 3s linear infinite;
    }
    @keyframes road {
      to { background-position: 0 64px; }
    }

    .grain {
      position: absolute;
      inset: 0;
      z-index: -1;
      opacity: 0.07;
      pointer-events: none;
      background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
    }

    /* Датчик угла заноса */
    .gauge {
      position: absolute;
      right: var(--gutter);
      top: 50%;
      width: min(34vw, 420px);
      margin: 0;
      translate: 0 -50%;
      filter: drop-shadow(0 0 24px rgba(10, 186, 181, 0.25));
      svg { width: 100%; display: block; overflow: visible; }
      circle { fill: none; }
      .ring { stroke: var(--hairline-strong); stroke-width: 1; }
      .arc {
        stroke: var(--primary);
        stroke-width: 3;
        stroke-linecap: round;
        stroke-dasharray: 0 100;
        transform: rotate(-210deg);
        transform-origin: center;
        animation: arc 2s var(--ease-out) 0.8s forwards;
      }
      .tick { stroke: var(--ink-tertiary); stroke-width: 1; }
      .tick.major { stroke: var(--ink-muted); stroke-width: 2; }
      .needle {
        transform-origin: 120px 120px;
        rotate: -120deg;
        animation: needle 2s var(--ease-spring) 0.8s forwards, sway 3.2s var(--ease-in-out) 2.8s infinite alternate;
        line { stroke: var(--primary); stroke-width: 3; stroke-linecap: round; }
        circle { fill: var(--primary); }
      }
      figcaption {
        position: absolute;
        left: 0;
        right: 0;
        bottom: 18%;
        display: grid;
        justify-items: center;
      }
      .val { font-size: clamp(32px, 4vw, 48px); line-height: 1; }
      .lbl { font-size: 11px; letter-spacing: 2px; text-transform: uppercase; color: var(--ink-subtle); }
    }
    @keyframes arc { to { stroke-dasharray: 46 100; } }
    /* -120° + 46% окружности = 46°: стрелка стоит на конце дуги */
    @keyframes needle { to { rotate: 46deg; } }
    @keyframes sway { from { rotate: 46deg; } to { rotate: 30deg; } }
    @media (max-width: 900px) {
      .gauge { display: none; }
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
      box-shadow: 0 0 0 0 var(--primary-glow);
      animation: pulse 2s ease-out infinite;
    }
    @keyframes pulse {
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

    .facts {
      display: flex;
      flex-wrap: wrap;
      gap: 12px 40px;
      margin: 56px 0 0;
      dt {
        font-size: 28px;
        font-weight: 500;
        color: var(--ink);
        line-height: 1;
      }
      dd {
        margin: 6px 0 0;
        font-size: 12px;
        letter-spacing: 1px;
        text-transform: uppercase;
        color: var(--ink-subtle);
      }
      div {
        padding-left: 14px;
        border-left: 2px solid var(--primary);
      }
    }

    .kanji {
      position: absolute;
      right: -2vw;
      bottom: -3vw;
      z-index: -1;
      font-size: clamp(120px, 22vw, 320px);
      font-weight: 600;
      line-height: 1;
      color: transparent;
      -webkit-text-stroke: 1px rgba(10, 186, 181, 0.3);
      user-select: none;
      pointer-events: none;
    }

    /* Следы фар на длинной выдержке */
    .streaks i {
      position: absolute;
      left: -40%;
      height: 2px;
      width: 50%;
      z-index: -1;
      background: linear-gradient(90deg, transparent, var(--primary), #fff, transparent);
      filter: drop-shadow(0 0 6px var(--primary));
      opacity: 0.7;
      transform: translateX(300%);
      animation: streak 7s var(--ease-in-out) infinite;
    }
    .streaks i:nth-child(1) { top: 28%; animation-delay: 0.2s; }
    .streaks i:nth-child(2) { top: 52%; animation-delay: 2.6s; opacity: 0.45; }
    .streaks i:nth-child(3) { top: 74%; animation-delay: 4.8s; opacity: 0.3; }
    @keyframes streak {
      from { transform: translateX(0); }
      35%, to { transform: translateX(300%); }
    }

    /* Бегущая строка, как на трансляции */
    .ticker {
      overflow: hidden;
      border-block: 1px solid var(--hairline-strong);
      background: linear-gradient(90deg, rgba(10, 186, 181, 0.1), rgba(10, 186, 181, 0.02));
      transform: skewY(-1.5deg);
      margin: -24px 0 0;
    }
    .track {
      display: flex;
      width: max-content;
      animation: marquee 40s linear infinite;
      span {
        padding: 14px 0;
        white-space: pre;
        font: 500 13px var(--mono);
        letter-spacing: 3px;
        text-transform: uppercase;
        color: var(--primary);
      }
    }
    @keyframes marquee {
      to { transform: translateX(-50%); }
    }

    h2 { margin: 12px 0 48px; max-width: 640px; }
    .steps {
      display: grid;
      gap: 24px;
      grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
    }
    .step {
      position: relative;
      overflow: hidden;
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
  protected readonly ticks = Array.from({ length: 61 }, (_, i) => i); // 0..60, шаг 4° → дуга 240°
}
