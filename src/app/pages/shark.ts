import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { LiveStage } from '../components/live-stage';
import { NextStage } from '../components/next-stage';
import { SeasonRoad } from '../components/season-road';
import { Reveal } from '../reveal';
import { Home } from './home';

// /test — черновик главной в коллаборации с Attack Shark: те же данные, что у главной (наследует Home),
// другой вид — океан, плавник над водой, сонар, «зубастые» разделители, акула на фоне блока партнёра.
// shortcut: тексты блока партнёра — заглушки и только по-русски; финальные — после согласования со спонсором
@Component({
  selector: 'app-shark',
  imports: [RouterLink, TranslocoPipe, Reveal, NextStage, LiveStage, SeasonRoad],
  template: `
    <!-- ── Hero: глубина, каустика, пузыри, плавник режет поверхность ── -->
    <section class="hero" aria-labelledby="shark-title">
      <div class="ocean" aria-hidden="true">
        <i class="caustic c1"></i><i class="caustic c2"></i><i class="caustic c3"></i>
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
            <svg viewBox="0 0 80 64"><path d="M2 62 C 22 46 36 16 66 2 C 58 26 60 46 78 62 Z" /></svg>
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

    <!-- ── Блок партнёра: акула плывёт на фоне ── -->
    <section class="partner" aria-labelledby="partner-title">
      <i class="jaw top" aria-hidden="true"></i>
      <svg class="shark" viewBox="0 0 280 90" aria-hidden="true">
        <path d="M8 50 C 60 22 160 20 232 40 L 266 18 L 258 48 L 272 76 L 234 60 C 172 80 72 80 8 50 Z" />
        <path d="M118 30 L 142 4 L 152 32 Z" />
        <path d="M112 64 L 130 88 L 140 64 Z" />
      </svg>
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
        <a class="btn bite" href="#" (click)="$event.preventDefault()">Узнать о партнёре →</a>
      </div>
      <i class="jaw bottom" aria-hidden="true"></i>
    </section>

    @if (road().length) {
      <section class="section road-sec">
        <div class="container">
          <p class="eyebrow" reveal>{{ seasonTitle() }}</p>
          <h2 class="display-lg" reveal>{{ 'road.title' | transloco }}</h2>
        </div>
        <app-season-road [stages]="road()" />
      </section>
    }

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
    </section>
  `,
  styles: `
    :host {
      --abyss: #020a12;
      --deep: #04202c;
      --shark: #3fd0ff;            /* акцент коллаборации — заменить на фирменный цвет Attack Shark */
      --shark-rgb: 63, 208, 255;
      display: block;
      background: linear-gradient(180deg, var(--abyss), #010508 60%);
    }
    /* ── Hero ── */
    .hero { position: relative; overflow: hidden; min-height: calc(100svh - 64px); display: grid; align-items: center; isolation: isolate; }
    .ocean { position: absolute; inset: 0; z-index: -1; background: radial-gradient(120% 80% at 70% 0%, #06364a, var(--deep) 40%, var(--abyss) 85%); }
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
    .w1 { fill: #010508; }
    @keyframes wave { to { transform: translateX(-50%); } }
    /* плавник: проплывает слева направо раз в ~11 с, покачиваясь на волне */
    .fin-lane { position: absolute; left: 0; right: 0; bottom: 52px; height: 64px; overflow: hidden; }
    .fin { position: absolute; left: 0; bottom: 0; width: 80px; animation: swim 11s cubic-bezier(0.45, 0, 0.55, 1) 1s infinite; }
    .fin svg { position: relative; z-index: 1; width: 80px; height: 64px; fill: #0c1c26; stroke: rgba(var(--shark-rgb), 0.7); stroke-width: 1.2; animation: bob 1.6s ease-in-out infinite; }
    .wake {
      position: absolute; right: 60px; bottom: 2px; width: 220px; height: 6px; border-radius: 6px;
      background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.55)); filter: blur(1px);
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
      background: linear-gradient(100deg, var(--shark), #e8fbff 45%, var(--shark) 60%) 0 0 / 240% 100%; -webkit-background-clip: text; background-clip: text;
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
      position: relative; overflow: hidden; background: var(--shark); color: #001018; font-weight: 600;
      transition: transform 200ms var(--ease-out), box-shadow 200ms;
    }
    .bite::before, .bite::after {
      content: ''; position: absolute; left: 0; right: 0; height: 9px; background: #001018; transition: transform 220ms var(--ease-out);
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
    .ticker { overflow: hidden; border-block: 1px solid rgba(var(--shark-rgb), 0.25); background: #01070c; }
    .track { display: flex; align-items: center; gap: 28px; width: max-content; padding: 14px 0; animation: tick 30s linear infinite; }
    .track span { font: 400 20px 'Russo One', var(--font); letter-spacing: 0.08em; color: var(--ink); }
    .track b { color: var(--shark); font-size: 20px; }
    .tf { width: 26px; height: 20px; background: var(--shark); clip-path: polygon(0 100%, 60% 0, 55% 55%, 100% 100%); opacity: 0.8; }
    @keyframes tick { to { transform: translateX(-50%); } }

    /* ── блок партнёра ── */
    .partner { position: relative; overflow: hidden; padding: 120px 0; background: radial-gradient(80% 120% at 20% 50%, #062a3a, #020c14 70%); isolation: isolate; }
    .jaw { position: absolute; left: 0; right: 0; height: 22px; background: #010508; z-index: 1; mask: conic-gradient(from -45deg at bottom, #0000, #000 1deg 89deg, #0000 90deg) 50% / 34px 100%; }
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
      position: relative; padding: 24px; border: 1px solid rgba(var(--shark-rgb), 0.22); background: rgba(2, 12, 20, 0.7); backdrop-filter: blur(6px);
      clip-path: polygon(0 0, calc(100% - 26px) 0, 100% 26px, 100% 100%, 0 100%); /* срезанный угол — как плавник */
      transition: border-color 200ms, transform 200ms var(--ease-out);
    }
    .perk:hover { border-color: rgba(var(--shark-rgb), 0.6); transform: translateY(-4px); }
    .pi { width: 28px; height: 28px; fill: none; stroke: var(--shark); stroke-width: 1.6; stroke-linecap: round; stroke-linejoin: round; }
    .perk h3 { margin: 14px 0 6px; font-size: 18px; }
    .perk p { margin: 0; color: var(--ink-muted); font-size: 14px; }

    /* ── нижние секции в «подводной» подаче ── */
    .road-sec { position: relative; }
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
      .caustic, .bubble, .waves path, .fin, .fin svg, .l2 b, .teeth polyline, .ping::after, .sonar, .track, .shark { animation: none !important; }
      .teeth polyline { stroke-dashoffset: 0; }
      .fin { display: none; }
    }
  `,
})
export class SharkHome extends Home {
  /** пузыри: позиция, размер, задержка, время всплытия (детерминированно) */
  protected readonly bubbles = Array.from({ length: 18 }, (_, i) => ({ x: (i * 37 + 5) % 100, s: 4 + ((i * 7) % 10), d: (i * 0.9) % 9, t: 9 + ((i * 3) % 8) }));
  /** заглушки — заменить на согласованные с Attack Shark */
  protected readonly perks = [
    { t: 'Официальный партнёр', d: 'Attack Shark поддерживает сезон SDS: этапы, трансляции и комьюнити.', icon: 'M12 2l3 6 6 .9-4.5 4.3 1 6.3L12 16.6 6.5 19.5l1-6.3L3 8.9 9 8z' },
    { t: 'Хищная точность', d: 'Девайсы, на которых пилоты ловят угол и держат траекторию.', icon: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zm0 4v5l3 3' },
    { t: 'Для комьюнити', d: 'Следите за анонсами партнёра в Discord и на трансляциях этапов.', icon: 'M4 6h16v10H8l-4 4z' },
  ];
}
