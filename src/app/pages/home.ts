import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';

// Пока только герой; живой этап, лидеры и спонсоры — шаг 5.1
@Component({
  selector: 'app-home',
  imports: [RouterLink, TranslocoPipe],
  template: `
    <section class="hero">
      <div class="streaks" aria-hidden="true"><i></i><i></i><i></i></div>
      <span class="kanji" aria-hidden="true">ドリフト</span>
      <div class="container inner">
        <p class="eyebrow rise">{{ 'home.eyebrow' | transloco }}</p>
        <h1 class="display-xl rise" style="--i: 1">Sad Drift<br /><span class="accent">Series</span></h1>
        <p class="lead muted rise" style="--i: 2">{{ 'home.lead' | transloco }}</p>
        <div class="cta rise" style="--i: 3">
          <a routerLink="/stages" class="btn btn-primary">{{ 'home.toStages' | transloco }}</a>
          <a routerLink="/standings" class="btn btn-secondary">{{ 'home.toStandings' | transloco }}</a>
        </div>
      </div>
    </section>
  `,
  styles: `
    .hero {
      position: relative;
      overflow: hidden;
      min-height: calc(100vh - 64px);
      display: flex;
      align-items: center;
      background:
        radial-gradient(60% 50% at 75% 60%, rgba(10, 186, 181, 0.10), transparent 70%),
        radial-gradient(40% 40% at 10% 100%, rgba(255, 255, 255, 0.04), transparent 70%),
        var(--canvas);
    }
    .inner {
      position: relative;
      width: 100%;
    }
    h1 {
      margin: 16px 0 24px;
    }
    .accent {
      color: var(--primary);
      text-shadow: 0 0 40px var(--primary-glow);
    }
    .lead {
      max-width: 520px;
      font-size: 18px;
      margin: 0 0 32px;
    }
    .cta {
      display: flex;
      flex-wrap: wrap;
      gap: 12px;
    }
    .kanji {
      position: absolute;
      right: -2vw;
      bottom: -4vw;
      font-size: clamp(120px, 22vw, 320px);
      font-weight: 600;
      line-height: 1;
      color: transparent;
      -webkit-text-stroke: 1px rgba(10, 186, 181, 0.18);
      user-select: none;
      pointer-events: none;
    }
    /* Следы фар на длинной выдержке */
    .streaks i {
      position: absolute;
      left: -40%;
      height: 1px;
      width: 60%;
      background: linear-gradient(90deg, transparent, var(--primary), transparent);
      opacity: 0.5;
      transform: translateX(260%);
      animation: streak 2.4s var(--ease-in-out) both;
    }
    .streaks i:nth-child(1) { top: 30%; animation-delay: 0.2s; }
    .streaks i:nth-child(2) { top: 55%; animation-delay: 0.6s; opacity: 0.3; }
    .streaks i:nth-child(3) { top: 78%; animation-delay: 1s; opacity: 0.2; }
    @keyframes streak {
      from { transform: translateX(0); }
      to { transform: translateX(260%); }
    }
  `,
})
export class Home {}
