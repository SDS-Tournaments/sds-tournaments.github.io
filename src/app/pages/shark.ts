import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { LiveStage } from '../components/live-stage';
import { NextStage } from '../components/next-stage';
import { SeasonRoad } from '../components/season-road';
import { SharkScene } from '../components/shark-scene';
import { Reveal } from '../reveal';
import { Home } from './home';

// /test — черновик главной в коллаборации с Attack Shark: те же данные, что у главной (наследует Home),
// другой вид — океан, плавник над водой, сонар, «зубастые» разделители, акула на фоне блока партнёра.
// shortcut: тексты блока партнёра — заглушки и только по-русски; финальные — после согласования со спонсором
@Component({
  selector: 'app-shark',
  imports: [RouterLink, TranslocoPipe, Reveal, NextStage, LiveStage, SeasonRoad, SharkScene],
  template: `
    <svg width="0" height="0" style="position: absolute" aria-hidden="true">
      <defs>
        <g id="shark-body" transform="translate(280 0) scale(-1 1)">
          <path d="M8 50 C 60 22 160 20 232 40 L 266 18 L 258 48 L 272 76 L 234 60 C 172 80 72 80 8 50 Z" />
        <path d="M118 30 L 142 4 L 152 32 Z" />
        <path d="M112 64 L 130 88 L 140 64 Z" />
        </g>
      </defs>
    </svg>
    <svg class="megashark" viewBox="0 0 280 90" aria-hidden="true"><use href="#shark-body" /></svg>

    <!-- ── Hero: глубина, каустика, пузыри, плавник режет поверхность ── -->
    <section class="hero" aria-labelledby="shark-title">
      <div class="ocean" aria-hidden="true">
        <i class="caustic c1"></i><i class="caustic c2"></i><i class="caustic c3"></i>
        <!-- 3D-акулы (Three.js); пока модель не загрузилась — CSS-слои ниже -->
        <app-shark-scene />
        @for (b of bubbles; track $index) {
          <i class="bubble" [style.left.%]="b.x" [style.--s.px]="b.s" [style.--d.s]="b.d" [style.--t.s]="b.t"></i>
        }
        <svg class="waves" viewBox="0 0 1440 120" preserveAspectRatio="none">
          <path class="w3" d="M0 70 Q 180 40 360 70 T 720 70 T 1080 70 T 1440 70 T 1800 70 T 2160 70 V120 H0 Z" />
          <path class="w2" d="M0 80 Q 180 55 360 80 T 720 80 T 1080 80 T 1440 80 T 1800 80 T 2160 80 V120 H0 Z" />
          <path class="w1" d="M0 92 Q 180 72 360 92 T 720 92 T 1080 92 T 1440 92 T 1800 92 T 2160 92 V120 H0 Z" />
        </svg>
        <!-- плавник проплывает по поверхности, за ним — след -->
        <div class="fin-lane">
          <div class="fin">
            <svg viewBox="0 0 80 64"><path d="M78 62 C 62 50 44 20 8 3 C 16 18 22 34 20 62 Z" /></svg>
            <i class="wake"></i>
          </div>
        </div>
      </div>

      <div class="container inner">
        <div class="text">
          <p class="partner-chip rise"><span class="ping"></span>Официальный партнёр сезона</p>
          <h1 id="shark-title" class="rise" style="--i: 1">
            <span class="l1">Sad Drift Series</span>
            <span class="x">×</span>
            <span class="l2">Attack <b>Shark</b></span>
            <svg class="teeth" viewBox="0 0 300 18" preserveAspectRatio="none" aria-hidden="true">
              <polyline points="0,2 15,16 30,2 45,16 60,2 75,16 90,2 105,16 120,2 135,16 150,2 165,16 180,2 195,16 210,2 225,16 240,2 255,16 270,2 285,16 300,2" />
            </svg>
          </h1>
          <p class="lead rise" style="--i: 2">Дрифт-чемпионат в CarX Drift Racing Online 2 и команда Attack Shark — вместе в этом сезоне. Хищная точность на каждом заезде.</p>
          <div class="cta rise" style="--i: 3">
            <a routerLink="/stages" class="btn bite">{{ 'home.toStages' | transloco }} →</a>
            <a routerLink="/standings" class="btn btn-secondary">{{ 'home.toStandings' | transloco }}</a>
          </div>
        </div>
        <div class="sonar-wrap rise" style="--i: 4">
          <i class="sonar" aria-hidden="true"></i>
          <app-next-stage
            [stage]="next() ? stageTitle(next()!) : null"
            [startsAt]="next()?.starts_at ? toDate(next()!.starts_at!) : null"
            [battlesAt]="next()?.battles_at ? toDate(next()!.battles_at!) : null"
            [registered]="nextCount()"
            [status]="next()?.status ?? 'registration'"
          />
        </div>
      </div>
    </section>

    <!-- бегущая строка коллаборации -->
    <div class="ticker" aria-hidden="true">
      <div class="track">
        @for (i of [1, 2, 3, 4, 5, 6]; track i) { <span>SDS</span><b>×</b><span>ATTACK SHARK</span><i class="tf"></i> }
      </div>
    </div>

    @if (live(); as l) {
      <section id="live" class="section container live">
        <p class="eyebrow" reveal>LIVE</p>
        <h2 class="display-lg" reveal>{{ stageTitle(l) }}</h2>
        @defer {
          <app-live-stage [stageId]="l.id" [status]="l.status" [channel]="l.twitch_channel || twitch()" />
        }
      </section>
    }

    @if (road().length) {
      <section class="section road-sec">
        <div class="container">
          <p class="eyebrow" reveal>{{ seasonTitle() }}</p>
          <h2 class="display-lg" reveal>Маршрут хищника</h2>
        </div>
        <app-season-road [stages]="road()" />
      </section>
    }

    <!-- ── Блок партнёра: акула плывёт на фоне ── -->
    <section class="partner" aria-labelledby="partner-title">
      <i class="jaw top" aria-hidden="true"></i>
      <svg class="shark" viewBox="0 0 280 90" aria-hidden="true"><use href="#shark-body" /></svg>
      <app-shark-scene mode="partner" class="pscene" />
      <div class="container">
        <p class="eyebrow" reveal>Powered by</p>
        <h2 id="partner-title" class="display-lg brand" reveal>ATTACK SHARK</h2>
        <div class="perks">
          @for (p of perks; track p.t; let i = $index) {
            <article class="perk" reveal [style.--i]="i">
              <svg class="pi" viewBox="0 0 24 24" aria-hidden="true"><path [attr.d]="p.icon" /></svg>
              <h3>{{ p.t }}</h3>
              <p>{{ p.d }}</p>
            </article>
          }
        </div>
        <a class="btn bite site" [href]="site" target="_blank" rel="noopener">
          <svg class="sf" viewBox="0 0 80 64" aria-hidden="true"><path d="M78 62 C 62 50 44 20 8 3 C 16 18 22 34 20 62 Z" /></svg>
          Сайт Attack Shark
          <svg class="ext" viewBox="0 0 24 24" aria-hidden="true"><path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" /></svg>
          <span class="sr-only">(откроется в новой вкладке)</span>
        </a>
      </div>
      <i class="jaw bottom" aria-hidden="true"></i>
    </section>

    <section class="arsenal section container" aria-labelledby="arsenal-title">
      <p class="eyebrow" reveal>Девайсы Attack Shark</p>
      <h2 id="arsenal-title" class="display-lg" reveal>Арсенал хищника</h2>
      <div class="gear">
        @for (g of gear; track g.k; let i = $index) {
          <a class="dev" [class]="'dev ' + g.k" [href]="g.url" target="_blank" rel="noopener" reveal [style.--i]="i">
            <span class="art" aria-hidden="true">
              @switch (g.k) {
                @case ('mouse') {
                  <svg viewBox="0 0 120 120">
                    <path class="body" d="M60 10 C 86 10 96 30 96 56 L 96 84 C 96 102 80 112 60 112 C 40 112 24 102 24 84 L 24 56 C 24 30 34 10 60 10 Z" />
                    <path class="line" d="M60 10 V 48 M24 52 H 96" />
                    <rect class="wheel" x="56" y="22" width="8" height="16" rx="4" />
                    <circle class="ring r1" cx="60" cy="78" r="6" /><circle class="ring r2" cx="60" cy="78" r="6" /><circle class="ring r3" cx="60" cy="78" r="6" />
                    <circle class="sensor" cx="60" cy="78" r="3.5" />
                  </svg>
                }
                @case ('keyboard') {
                  <svg viewBox="0 0 160 90">
                    <rect class="body" x="4" y="14" width="152" height="62" rx="8" />
                    @for (k of keys; track $index) {
                      <rect class="key" [attr.x]="k.x" [attr.y]="k.y" [attr.width]="k.w" height="11" rx="2" [style.--kd.ms]="k.d" />
                    }
                  </svg>
                }
                @case ('headset') {
                  <svg viewBox="0 0 120 120">
                    <path class="body" d="M24 70 V 56 C 24 30 40 16 60 16 C 80 16 96 30 96 56 V 70" />
                    <rect class="cup" x="16" y="62" width="20" height="34" rx="8" /><rect class="cup" x="84" y="62" width="20" height="34" rx="8" />
                    <path class="wave w1" d="M10 70 Q 2 79 10 88" /><path class="wave w2" d="M4 64 Q -8 79 4 94" />
                    <path class="wave w1" d="M110 70 Q 118 79 110 88" /><path class="wave w2" d="M116 64 Q 128 79 116 94" />
                  </svg>
                }
                @case ('acc') {
                  <svg viewBox="0 0 160 90">
                    <rect class="pad" x="6" y="30" width="148" height="54" rx="10" />
                    <path class="coil" d="M14 18 q 6 -12 12 0 t 12 0 t 12 0 t 12 0 t 12 0 t 12 0 t 12 0 t 12 0 t 12 0 t 12 0" />
                  </svg>
                }
              }
            </span>
            <span class="dk">{{ g.tag }}</span>
            <h3>{{ g.t }}</h3>
            <p>{{ g.d }}</p>
            <span class="models mono">{{ g.models }}</span>
            <span class="go">Смотреть →</span>
          </a>
        }
      </div>
    </section>

    @if (pilots().length) {
      <section class="section container">
        <p class="eyebrow" reveal>{{ seasonTitle() }}</p>
        <h2 class="display-lg" reveal>Хищники сезона</h2>
        <ol class="card board" reveal>
          <li class="bhead"><span>{{ 'home.pilots' | transloco }}</span><span class="subtle">{{ 'home.points' | transloco }}</span></li>
          @for (p of pilots(); track p.id; let i = $index) {
            <li [class.first]="i === 0">
              <span class="mono place">{{ p.place }}</span>
              @if (p.avatar_url) { <img [src]="p.avatar_url" alt="" width="36" height="36" loading="lazy" decoding="async" /> } @else { <span class="ph"></span> }
              <span class="who"><b>{{ p.nickname }}</b><span class="subtle">{{ p.team ?? '' }}</span></span>
              <span class="mono pts">{{ p.points }}</span>
            </li>
          }
        </ol>
        <a routerLink="/standings" class="more" reveal>{{ 'home.fullStandings' | transloco }} →</a>
      </section>
    }

    <section class="section container">
      <p class="eyebrow" reveal>{{ 'home.how.eyebrow' | transloco }}</p>
      <h2 class="display-lg" reveal>{{ 'home.how.title' | transloco }}</h2>
      <div class="steps">
        @for (step of steps; track step; let i = $index) {
          <article class="card step" reveal [style.--i]="i">
            <span class="step-no">0{{ i + 1 }}</span>
            <span class="day mono">{{ (i === 0 ? 'home.how.day1' : 'home.how.day2') | transloco }}</span>
            <h3>{{ 'home.how.' + step + '.title' | transloco }}</h3>
            <p class="muted">{{ 'home.how.' + step + '.text' | transloco }}</p>
          </article>
        }
      </div>
      <!-- CC BY 4.0: указание автора 3D-модели обязательно -->
      <p class="credit">3D-модель акулы: <a href="https://sketchfab.com/3d-models/297ed35c6a5f43749b0ae189d991a3f1" target="_blank" rel="noopener">«Animated Swimming Great White Shark Loop»</a> — LasquetiSpice, лицензия <a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noopener">CC BY 4.0</a></p>
    </section>
  `,
  styles: `
    /* цвета — из темы сайта (NOIR, металлы, LEGEND): океан смешивается из акцента и фона темы */
    :host {
      --shark: var(--primary);
      --shark-rgb: var(--accent-rgb);
      --abyss: var(--canvas);
      --deep: color-mix(in oklab, var(--primary) 14%, var(--canvas));
      --sea: color-mix(in oklab, var(--primary) 26%, var(--canvas));
      position: relative; display: block; background: var(--canvas); isolation: isolate;
    }
    /* большая акула: раз в ~30 с тенью проносится по фону страницы */
    .megashark {
      position: fixed; top: 22vh; left: 0; z-index: 5; width: 150vw; max-width: none; pointer-events: none;
      fill: var(--shark); opacity: 0; filter: blur(3px);
      animation: mega 30s cubic-bezier(0.55, 0.05, 0.4, 0.95) 6s infinite;
    }
    @keyframes mega {
      0%, 72% { opacity: 0; transform: translateX(-160vw) scale(1); }
      76% { opacity: 0.07; }
      86% { opacity: 0.07; transform: translateX(10vw) translateY(-3vh) scale(1.04); }
      90%, 100% { opacity: 0; transform: translateX(120vw) scale(1); }
    }
    /* ── Hero ── */
    .hero { position: relative; overflow: hidden; min-height: calc(100svh - 64px); display: grid; align-items: center; isolation: isolate; }
    .ocean { position: absolute; inset: 0; z-index: -1; background: radial-gradient(120% 80% at 70% 0%, var(--sea), var(--deep) 40%, var(--abyss) 85%); }
    .caustic {
      position: absolute; border-radius: 50%; mix-blend-mode: screen; opacity: 0.35; filter: blur(40px);
      background: radial-gradient(circle, rgba(var(--shark-rgb), 0.55), transparent 65%);
      animation: drift 18s ease-in-out infinite alternate;
    }
    .c1 { width: 520px; height: 520px; left: 55%; top: -140px; }
    .c2 { width: 380px; height: 380px; left: 10%; top: 20%; animation-duration: 24s; animation-delay: -6s; opacity: 0.22; }
    .c3 { width: 300px; height: 300px; left: 75%; top: 45%; animation-duration: 21s; animation-delay: -11s; opacity: 0.18; }
    @keyframes drift { to { transform: translate(-60px, 40px) scale(1.15); } }
    .bubble {
      position: absolute; bottom: -20px; width: var(--s); height: var(--s); border-radius: 50%;
      border: 1px solid rgba(var(--shark-rgb), 0.5); background: radial-gradient(circle at 30% 30%, rgba(255, 255, 255, 0.5), transparent 60%);
      opacity: 0; animation: rise var(--t) linear var(--d) infinite;
    }
    @keyframes rise {
      10% { opacity: 0.8; }
      50% { transform: translate(14px, -50vh); }
      100% { opacity: 0; transform: translate(-6px, -100vh); }
    }
    .waves { position: absolute; left: 0; bottom: 0; width: 200%; height: 120px; }
    .waves path { animation: wave 14s linear infinite; }
    .w3 { fill: rgba(var(--shark-rgb), 0.06); animation-duration: 22s !important; }
    .w2 { fill: rgba(var(--shark-rgb), 0.1); animation-duration: 16s !important; animation-direction: reverse !important; }
    .w1 { fill: var(--canvas); }
    @keyframes wave { to { transform: translateX(-50%); } }
    /* плавник: проплывает слева направо раз в ~11 с, покачиваясь на волне */
    .fin-lane { position: absolute; left: 0; right: 0; bottom: 52px; height: 64px; overflow: hidden; }
    .fin { position: absolute; left: 0; bottom: 0; width: 80px; animation: swim 11s cubic-bezier(0.45, 0, 0.55, 1) 1s infinite; }
    .fin svg { position: relative; z-index: 1; width: 80px; height: 64px; fill: var(--surface-2); stroke: rgba(var(--shark-rgb), 0.7); stroke-width: 1.2; animation: bob 1.6s ease-in-out infinite; }
    .wake {
      position: absolute; right: 60px; bottom: 2px; width: 220px; height: 6px; border-radius: 6px;
      background: linear-gradient(90deg, transparent, color-mix(in oklab, var(--shark), var(--ink) 40%)); opacity: 0.55; filter: blur(1px);
    }
    @keyframes swim { 0% { transform: translateX(-140px); } 70%, 100% { transform: translateX(calc(100vw + 140px)); } }
    @keyframes bob { 50% { transform: translateY(5px) rotate(-3deg); } }

    .inner { display: flex; align-items: center; justify-content: space-between; gap: 48px; padding-block: 64px 140px; }
    @media (max-width: 900px) { .inner { flex-direction: column; align-items: flex-start; } }
    .partner-chip {
      display: inline-flex; align-items: center; gap: 10px; margin: 0; padding: 6px 14px; border-radius: var(--r-pill);
      border: 1px solid rgba(var(--shark-rgb), 0.4); background: rgba(var(--shark-rgb), 0.08); color: var(--shark);
      font-size: 12px; font-weight: 600; letter-spacing: 1.5px; text-transform: uppercase;
    }
    .ping { position: relative; width: 8px; height: 8px; border-radius: 50%; background: var(--shark); }
    .ping::after { content: ''; position: absolute; inset: 0; border-radius: 50%; background: var(--shark); animation: ping 2s ease-out infinite; }
    @keyframes ping { to { transform: scale(3.2); opacity: 0; } }
    h1 { position: relative; display: grid; gap: 4px; margin: 22px 0 26px; font-family: 'Russo One', var(--font); font-weight: 400; line-height: 0.95; }
    .l1 { font-size: clamp(36px, 5vw, 64px); color: var(--ink); }
    .x { font-size: clamp(28px, 3.4vw, 44px); color: rgba(var(--shark-rgb), 0.8); }
    .l2 { font-size: clamp(44px, 6.5vw, 88px); letter-spacing: 0.01em; color: var(--ink); text-transform: uppercase; }
    .l2 b {
      font-weight: 400; color: transparent; -webkit-text-stroke: 1.5px var(--shark);
      background: linear-gradient(100deg, var(--shark), color-mix(in oklab, var(--shark), #fff 70%) 45%, var(--shark) 60%) 0 0 / 240% 100%; -webkit-background-clip: text; background-clip: text;
      animation: sheen 5s ease-in-out 1.2s infinite;
    }
    @keyframes sheen { 0%, 40% { background-position: 120% 0; color: transparent; } 70%, 100% { background-position: -120% 0; } }
    /* «зубы» под заголовком прорисовываются слева направо */
    .teeth { width: min(100%, 420px); height: 16px; margin-top: 8px; }
    .teeth polyline { fill: none; stroke: var(--shark); stroke-width: 2; stroke-dasharray: 520; stroke-dashoffset: 520; animation: draw 1.4s cubic-bezier(0.2, 0.7, 0.3, 1) 0.6s forwards; }
    @keyframes draw { to { stroke-dashoffset: 0; } }
    .lead { max-width: 520px; margin: 0 0 32px; font-size: 18px; color: var(--ink-muted); }
    .cta { display: flex; flex-wrap: wrap; gap: 12px; }
    /* кнопка «укус»: при наведении сверху и снизу смыкаются зубы */
    .bite {
      position: relative; overflow: hidden; background: var(--shark); color: var(--on-primary); font-weight: 600;
      transition: transform 200ms var(--ease-out), box-shadow 200ms;
    }
    .bite::before, .bite::after {
      content: ''; position: absolute; left: 0; right: 0; height: 9px; background: var(--canvas); transition: transform 220ms var(--ease-out);
      mask: conic-gradient(from -45deg at bottom, #0000, #000 1deg 89deg, #0000 90deg) 50% / 14px 100%;
    }
    .bite::before { top: 0; transform: translateY(-100%); }
    .bite::after { bottom: 0; transform: translateY(100%) rotate(180deg); }
    .bite:hover, .bite:focus-visible { box-shadow: 0 0 28px -4px rgba(var(--shark-rgb), 0.8); transform: translateY(-2px); }
    .bite:hover::before, .bite:focus-visible::before { transform: translateY(0); }
    .bite:hover::after, .bite:focus-visible::after { transform: translateY(0) rotate(180deg); }
    /* сонар за карточкой ближайшего этапа */
    .sonar-wrap { position: relative; isolation: isolate; }
    .sonar {
      position: absolute; left: 50%; top: 50%; z-index: -1; width: 640px; aspect-ratio: 1; translate: -50% -50%; border-radius: 50%; pointer-events: none;
      background:
        repeating-radial-gradient(circle, transparent 0 58px, rgba(var(--shark-rgb), 0.12) 59px 60px),
        conic-gradient(from 0deg, rgba(var(--shark-rgb), 0.28), transparent 18%);
      mask: radial-gradient(circle, #000 35%, transparent 70%);
      animation: sweep 6s linear infinite;
    }
    @keyframes sweep { to { rotate: 360deg; } }

    /* ── бегущая строка ── */
    .ticker { overflow: hidden; border-block: 1px solid rgba(var(--shark-rgb), 0.25); background: var(--surface-1); }
    .track { display: flex; align-items: center; gap: 28px; width: max-content; padding: 14px 0; animation: tick 30s linear infinite; }
    .track span { font: 400 20px 'Russo One', var(--font); letter-spacing: 0.08em; color: var(--ink); }
    .track b { color: var(--shark); font-size: 20px; }
    .tf { width: 26px; height: 20px; background: var(--shark); clip-path: polygon(0 100%, 60% 0, 55% 55%, 100% 100%); opacity: 0.8; }
    @keyframes tick { to { transform: translateX(-50%); } }

    /* ── блок партнёра ── */
    .partner { position: relative; overflow: hidden; padding: 120px 0; background: radial-gradient(80% 120% at 20% 50%, var(--sea), var(--abyss) 70%); isolation: isolate; }
    .jaw { position: absolute; left: 0; right: 0; height: 22px; background: var(--canvas); z-index: 1; mask: conic-gradient(from -45deg at bottom, #0000, #000 1deg 89deg, #0000 90deg) 50% / 34px 100%; }
    .jaw.top { top: 0; }
    .jaw.bottom { bottom: 0; rotate: 180deg; }
    .shark {
      position: absolute; top: 34%; left: 0; z-index: -1; width: min(70vw, 760px); fill: rgba(var(--shark-rgb), 0.07);
      filter: drop-shadow(0 0 30px rgba(var(--shark-rgb), 0.15)); animation: cruise 26s linear infinite;
    }
    @keyframes cruise {
      0% { transform: translateX(-80%) translateY(0); }
      50% { transform: translateX(40vw) translateY(-18px); }
      100% { transform: translateX(110vw) translateY(0); }
    }
    .brand { margin: 6px 0 40px; font-family: 'Russo One', var(--font); font-weight: 400; letter-spacing: 0.04em; color: var(--shark); text-shadow: 0 0 40px rgba(var(--shark-rgb), 0.35); }
    .perks { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 16px; margin-bottom: 36px; }
    .perk {
      position: relative; padding: 24px; border: 1px solid rgba(var(--shark-rgb), 0.22); background: color-mix(in oklab, var(--surface-1), transparent 25%); backdrop-filter: blur(6px);
      clip-path: polygon(0 0, calc(100% - 26px) 0, 100% 26px, 100% 100%, 0 100%); /* срезанный угол — как плавник */
      transition: border-color 200ms, transform 200ms var(--ease-out);
    }
    .perk:hover { border-color: rgba(var(--shark-rgb), 0.6); transform: translateY(-4px); }
    .pi { width: 28px; height: 28px; fill: none; stroke: var(--shark); stroke-width: 1.6; stroke-linecap: round; stroke-linejoin: round; }
    .perk h3 { margin: 14px 0 6px; font-size: 18px; }
    .perk p { margin: 0; color: var(--ink-muted); font-size: 14px; }

    .site { display: inline-flex; align-items: center; gap: 10px; padding-inline: 22px; }
    .site .sf { width: 18px; height: 15px; fill: currentColor; }
    .site .ext { width: 16px; height: 16px; fill: none; stroke: currentColor; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }
    .sr-only { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }
    /* ── Арсенал: девайсы с живыми иллюстрациями ── */
    .gear { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 16px; }
    .dev {
      position: relative; display: grid; gap: 6px; align-content: start; padding: 22px; color: inherit; text-decoration: none;
      border: 1px solid rgba(var(--shark-rgb), 0.2); background: var(--surface-1);
      clip-path: polygon(0 0, calc(100% - 26px) 0, 100% 26px, 100% 100%, 0 100%);
      transition: border-color 200ms, transform 250ms var(--ease-out), box-shadow 250ms;
    }
    .dev:hover, .dev:focus-visible { border-color: var(--shark); transform: translateY(-6px); box-shadow: 0 24px 50px -24px rgba(var(--shark-rgb), 0.6); }
    .art { display: grid; place-items: center; height: 130px; margin-bottom: 8px; border-radius: var(--r-md); background: radial-gradient(circle at 50% 60%, rgba(var(--shark-rgb), 0.14), transparent 70%); }
    .art svg { width: 70%; max-height: 120px; overflow: visible; }
    .art .body, .art .cup, .art .pad { fill: var(--surface-2); stroke: rgba(var(--shark-rgb), 0.7); stroke-width: 1.5; }
    .art .line { fill: none; stroke: rgba(var(--shark-rgb), 0.35); stroke-width: 1.2; }
    .dk { font-size: 11px; letter-spacing: 1.5px; text-transform: uppercase; color: var(--shark); }
    .dev h3 { margin: 0; font: 400 22px 'Russo One', var(--font); }
    .dev p { margin: 0; font-size: 14px; color: var(--ink-muted); }
    .models { font-size: 12px; color: var(--ink-subtle); }
    .go { margin-top: 8px; font-size: 14px; font-weight: 600; color: var(--shark); }
    /* мышь: сенсор пускает сонар (8000 Гц), колесо светится */
    .sensor { fill: var(--shark); }
    .ring { fill: none; stroke: var(--shark); stroke-width: 1.2; transform-box: fill-box; transform-origin: center; animation: sonar 2.4s ease-out infinite; }
    .r2 { animation-delay: 0.8s; } .r3 { animation-delay: 1.6s; }
    @keyframes sonar { from { opacity: 0.9; transform: scale(1); } to { opacity: 0; transform: scale(7); } }
    .wheel { fill: rgba(var(--shark-rgb), 0.3); stroke: var(--shark); animation: wheel 1.6s ease-in-out infinite; }
    @keyframes wheel { 50% { fill: var(--shark); } }
    /* клавиатура: по клавишам бежит волна подсветки (rapid trigger) */
    .key { fill: color-mix(in oklab, var(--surface-2), var(--ink) 8%); stroke: rgba(var(--shark-rgb), 0.25); stroke-width: 0.8; animation: keywave 2.6s ease-in-out var(--kd) infinite; }
    @keyframes keywave { 0%, 70%, 100% { fill: color-mix(in oklab, var(--surface-2), var(--ink) 8%); } 12% { fill: var(--shark); } }
    /* гарнитура: звуковые волны */
    .wave { fill: none; stroke: var(--shark); stroke-width: 2; stroke-linecap: round; animation: sound 1.4s ease-in-out infinite; }
    .wave.w2 { animation-delay: 0.25s; }
    @keyframes sound { 0%, 100% { opacity: 0.15; } 40% { opacity: 1; } }
    /* коврик и витой кабель: кабель «дышит» */
    .coil { fill: none; stroke: var(--shark); stroke-width: 2.2; stroke-linecap: round; transform-box: fill-box; transform-origin: left center; animation: coil 2.2s ease-in-out infinite; }
    @keyframes coil { 50% { transform: scaleX(0.9) translateY(2px); } }
    .dev:hover .ring { animation-duration: 1.2s; }
    .dev:hover .key { animation-duration: 1.3s; }

    /* 3D готов — плоские силуэты-заглушки прячем */
    :host:has(.hero app-shark-scene.ready) .megashark,
    .partner:has(.pscene.ready) .shark { display: none; }
    .pscene { z-index: -1; }
    .credit { margin: 48px 0 0; font-size: 12px; color: var(--ink-subtle); }
    .credit a { color: var(--ink-muted); }

    /* ── нижние секции в «подводной» подаче ── */
    /* дорога сезона: линия — поверхность воды, огонёк пройденного пути — плавник, плывущий к следующему этапу */
    .road-sec { position: relative; }
    /* вода — тонкая волнистая линия; пройденный путь — та же волна, только яркая */
    .road-sec ::ng-deep .rail { height: 6px; top: 4px; background: none; }
    .road-sec ::ng-deep .rail::before { content: ''; position: absolute; inset: 0; background: rgba(var(--shark-rgb), 0.3); mask: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 12 6'%3E%3Cpath d='M0 3 Q 3 0.6 6 3 T 12 3' fill='none' stroke='black' stroke-width='1.4'/%3E%3C/svg%3E") 0 50% / 12px 6px repeat-x; }
    .road-sec ::ng-deep .fill {
      background: linear-gradient(90deg, rgba(var(--shark-rgb), 0.35), var(--shark)); box-shadow: none; mask: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 12 6'%3E%3Cpath d='M0 3 Q 3 0.6 6 3 T 12 3' fill='none' stroke='black' stroke-width='1.4'/%3E%3C/svg%3E") 0 50% / 12px 6px repeat-x;
    }
    .road-sec ::ng-deep .fill::after { display: none; } /* огонёк заменён плавником (ниже), маска волны его бы обрезала */
    /* плавник — отдельным слоем, едет вместе с концом пройденного пути; основание растворяется в воде */
    .road-sec ::ng-deep .rail::after {
      content: ''; position: absolute; left: 0; top: -17px; width: 28px; height: 22px; margin-left: -20px; opacity: 0;
      background: linear-gradient(180deg, color-mix(in oklab, var(--shark), #fff 30%), var(--shark) 55%, transparent 96%);
      mask: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 80 64'%3E%3Cpath d='M78 62 C 62 50 44 20 8 3 C 16 18 22 34 20 62 Z'/%3E%3C/svg%3E") center / contain no-repeat;
      filter: drop-shadow(0 0 5px rgba(var(--shark-rgb), 0.55));
      transition: left 1.8s var(--ease-out) 0.2s, opacity 0.4s 1.6s;
      animation: road-fin 1.8s ease-in-out infinite; /* только вверх-вниз */
    }
    .road-sec ::ng-deep .tl.shown .rail::after { left: var(--fill); opacity: 1; }
    @keyframes road-fin { 50% { transform: translateY(1px); } }
    .road-sec ::ng-deep .done .dot { clip-path: polygon(50% 100%, 0 0, 100% 0); border-radius: 0; } /* пройденные этапы — «зубы» */
    .eyebrow { color: var(--shark); }
    .board { list-style: none; margin: 0; padding: 8px; display: grid; gap: 4px; max-width: 640px; border-color: rgba(var(--shark-rgb), 0.2); }
    .board li { display: grid; grid-template-columns: 28px 36px 1fr auto; align-items: center; gap: 12px; padding: 10px 12px; border-radius: var(--r-sm); }
    .board li.first { background: linear-gradient(90deg, rgba(var(--shark-rgb), 0.16), transparent); box-shadow: inset 3px 0 0 var(--shark); }
    .bhead { font-size: 12px; letter-spacing: 1.5px; text-transform: uppercase; color: var(--ink-subtle); grid-template-columns: 1fr auto !important; }
    .board img, .ph { width: 36px; height: 36px; border-radius: 50%; background: var(--surface-3); }
    .who { display: grid; } .pts { color: var(--shark); }
    .more { display: inline-block; margin-top: 16px; color: var(--shark); }
    .steps { display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 16px; }
    .step { border-color: rgba(var(--shark-rgb), 0.18); clip-path: polygon(0 0, calc(100% - 22px) 0, 100% 22px, 100% 100%, 0 100%); }
    .step-no { display: block; font: 400 48px 'Russo One', var(--font); line-height: 1; color: transparent; -webkit-text-stroke: 1px var(--shark); }
    .day { display: block; margin-top: 10px; font-size: 11px; letter-spacing: 2px; text-transform: uppercase; color: var(--shark); }
    /* появление «из глубины»: блоки всплывают и проясняются */
    :host ::ng-deep .reveal { filter: blur(6px); transition: opacity 800ms var(--ease-out), transform 800ms var(--ease-out), filter 800ms var(--ease-out) !important; }
    :host ::ng-deep .reveal.shown { filter: none; }

    @media (prefers-reduced-motion: reduce) {
      .caustic, .bubble, .waves path, .fin, .fin svg, .l2 b, .teeth polyline, .ping::after, .sonar, .track, .shark,
      .megashark, .ring, .wheel, .key, .wave, .coil { animation: none !important; }
      .megashark { display: none; }
      .teeth polyline { stroke-dashoffset: 0; }
      .fin { display: none; }
    }
  `,
})
export class SharkHome extends Home {
  /** пузыри: позиция, размер, задержка, время всплытия (детерминированно) */
  protected readonly bubbles = Array.from({ length: 18 }, (_, i) => ({ x: (i * 37 + 5) % 100, s: 4 + ((i * 7) % 10), d: (i * 0.9) % 9, t: 9 + ((i * 3) % 8) }));
  /** официальный сайт и разделы магазина Attack Shark */
  protected readonly site = 'https://attackshark.com/';
  protected readonly gear = [
    { k: 'mouse', tag: '8000 Гц', t: 'Мыши', d: 'Сенсор и опрос 8K: реакция быстрее, чем машину успевает развернуть.', models: 'X8 Ultra · RS3 Ultra · X11', url: 'https://attackshark.com/collections/8000-hz' },
    { k: 'keyboard', tag: 'HE · Rapid Trigger', t: 'Клавиатуры', d: 'Магнитные свитчи: газ и ручник срабатывают на долю миллиметра.', models: 'X68 HE · R85 HE · R98 HE', url: 'https://attackshark.com/collections/best-selling-products' },
    { k: 'headset', tag: 'Tri-mode', t: 'Гарнитуры', d: 'Слышно мотор, отсечку и споттера — без задержек.', models: 'L80 · L90', url: 'https://attackshark.com/collections/best-selling-products' },
    { k: 'acc', tag: 'Аксессуары', t: 'Коврики и кабели', d: 'Ровный глайд и витые кабели — сетап как у пилотов.', models: 'Коврики · C01 Ultra · C06', url: 'https://attackshark.com/collections/all-accessories' },
  ];
  /** клавиши HE-клавиатуры: волна подсветки слева направо */
  protected readonly keys = Array.from({ length: 4 }, (_, row) =>
    Array.from({ length: 11 }, (_, col) => ({ x: 12 + col * 12.6, y: 22 + row * 13, w: 10, d: col * 70 + row * 30 })),
  ).flat();
  /** заглушки — заменить на согласованные с Attack Shark */
  protected readonly perks = [
    { t: 'Официальный партнёр', d: 'Attack Shark поддерживает сезон SDS: этапы, трансляции и комьюнити.', icon: 'M12 2l3 6 6 .9-4.5 4.3 1 6.3L12 16.6 6.5 19.5l1-6.3L3 8.9 9 8z' },
    { t: 'Хищная точность', d: 'Девайсы, на которых пилоты ловят угол и держат траекторию.', icon: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zm0 4v5l3 3' },
    { t: 'Для комьюнити', d: 'Следите за анонсами партнёра в Discord и на трансляциях этапов.', icon: 'M4 6h16v10H8l-4 4z' },
  ];
}
