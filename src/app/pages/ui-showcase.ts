import { Component, computed, inject, signal } from '@angular/core';
import { DomSanitizer } from '@angular/platform-browser';
import { NextStage } from '../components/next-stage';
import { NumberPicker } from '../components/number-picker';
import { RoadStage, SeasonRoad } from '../components/season-road';
import { CardData, PilotCard, tierOf } from '../components/pilot-card';
import { Pilot, Pilots, Rank } from './pilots';

// Витрина базовых стилей для проверки дизайна (/dev/ui), не в меню
@Component({
  selector: 'app-ui-showcase',
  imports: [NumberPicker, SeasonRoad, PilotCard, Pilots, NextStage],
  template: `
    <section class="section container stack">
      <h1 class="display-lg">UI kit</h1>

      <div class="card"><app-number-picker [(value)]="num" [taken]="taken" nickname="Sadlerk" /></div>
      <app-season-road [stages]="road" />

      <!-- плашка стрима «Прогноз зрителей» в парных: разные расклады голосов, все 4 стиля -->
      <div class="card stack-sm">
        <div class="row">
          <h2 class="h-sm">Прогноз зрителей — плашка стрима</h2>
          <button class="btn btn-secondary" (click)="replay.update((n) => n + 1)">↻ Повторить анимацию</button>
          @for (sk of skins; track sk.k) {
            <button class="btn" [class.btn-primary]="pollSkin() === sk.k" [class.btn-ghost]="pollSkin() !== sk.k" (click)="pollSkin.set(sk.k)">{{ sk.label }}</button>
          }
        </div>
        <div class="polls">
          @for (p of pollFrames(); track p.label) {
            <figure class="pf">
              <div class="pf-view"><iframe [src]="p.url" title="Прогноз зрителей" loading="lazy"></iframe></div>
              <figcaption class="mono">{{ p.label }}</figcaption>
            </figure>
          }
        </div>
      </div>
      <!-- «хайп» карточки ближайшего этапа на разном числе записавшихся -->
      <div class="hype-demo">
        @for (n of hypeCounts; track n) { <app-next-stage [stage]="'Этап 1 · ' + n + ' пил.'" [startsAt]="soon" [registered]="n" status="registration" /> }
      </div>
      <div class="tiers">
        @for (c of cards; track c.overall) { <app-pilot-card [d]="c" [downloadable]="false" /> }
      </div>
      <!-- страница «Пилоты» на вымышленных пилотах: все уровни + без рейтинга -->
      <app-pilots class="demo" [demo]="pilots" />

      <div class="row">
        <button class="btn btn-primary">Зарегистрироваться</button>
        <button class="btn btn-secondary">Профиль</button>
        <button class="btn btn-ghost">Отмена</button>
        <button class="btn btn-primary" disabled>Недоступно</button>
        <span class="badge">LIVE</span>
      </div>

      <div class="grid">
        <div class="card card-hover">
          <p class="eyebrow">Этап 3</p>
          <h3>Ebisu Minami</h3>
          <p class="muted">Квалификация · 24 пилота</p>
        </div>
        <div class="card card-featured">
          <p class="eyebrow">Лидер сезона</p>
          <h3>#77 Sadlerk</h3>
          <p class="mono">512 pts</p>
        </div>
        <div class="card">
          <input class="input" placeholder="Ник пилота" />
          <select class="input" style="margin-top: 12px"><option>— выберите —</option><option>Kami S15</option></select>
        </div>
      </div>

      <div class="table-wrap">
        <table class="table">
          <thead>
            <tr><th>#</th><th>Пилот</th><th>Команда</th><th class="num">Очки</th></tr>
          </thead>
          <tbody>
            <tr><td class="mono">1</td><td>Sadlerk</td><td class="muted">Night Owls</td><td class="num">512</td></tr>
            <tr><td class="mono">2</td><td>Kaido</td><td class="muted">—</td><td class="num">467</td></tr>
            <tr><td class="mono">3</td><td>Touge_Ghost</td><td class="muted">Smoke Unit</td><td class="num">390</td></tr>
          </tbody>
        </table>
      </div>
    </section>
  `,
  styles: `
    .stack { display: grid; gap: 40px; }
    .stack-sm { display: grid; gap: 16px; }
    .h-sm { font-size: 18px; margin: 0 12px 0 0; }
    .polls { display: grid; gap: 16px; grid-template-columns: repeat(auto-fill, minmax(min(100%, 504px), 1fr)); }
    .pf { margin: 0; display: grid; gap: 6px; }
    .pf figcaption { font-size: 13px; color: var(--ink-muted); }
    /* из кадра 1920×1080 — только область дуэли и прогноза (x 400–1520, нижние 340 px), масштаб 0.45 */
    .pf-view { position: relative; width: 504px; height: 153px; overflow: hidden; border-radius: var(--r-md); }
    .pf-view iframe { position: absolute; left: -180px; bottom: 0; width: 1920px; height: 1080px; border: 0; transform: scale(0.45); transform-origin: 0 100%; pointer-events: none; }
    .tiers { display: flex; flex-wrap: wrap; gap: 24px; justify-content: center; }
    .demo { display: block; }
    .hype-demo { display: flex; flex-wrap: wrap; gap: 32px; justify-content: center; text-align: left; }
    .row { display: flex; flex-wrap: wrap; gap: 12px; align-items: center; }
    .grid { display: grid; gap: 24px; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); }
    h3 { margin: 8px 0; font-size: 20px; }
  `,
})
export class UiShowcase {
  private readonly sanitizer = inject(DomSanitizer);
  protected readonly skins = [
    { k: 'classic', label: 'Классика' },
    { k: 'arena', label: 'Арена' },
    { k: 'race', label: 'Гонка' },
    { k: 'hud', label: 'HUD' },
  ];
  protected readonly pollSkin = signal('hud');
  protected readonly replay = signal(0);
  /** ?poll=N — N% за лидера, none — без голосов, pollDone — показ итога (overlay, тестовые данные) */
  protected readonly pollFrames = computed(() =>
    [
      { label: '50 / 50', q: 'poll=50' },
      { label: '60 / 40', q: 'poll=60' },
      { label: '75 / 25', q: 'poll=75' },
      { label: '90 / 10', q: 'poll=90' },
      { label: '100 / 0', q: 'poll=100' },
      { label: 'нет голосов', q: 'poll=none' },
      { label: 'итог: угадали 75% (победил лидер)', q: 'poll=75&pollDone=leader' },
      { label: 'итог: угадали 25% (победил чейзер)', q: 'poll=75&pollDone=chaser' },
    ].map((p) => ({
      label: p.label,
      url: this.sanitizer.bypassSecurityTrustResourceUrl(`/overlay?preview=1&mock=1&show=poll,duel&skin=${this.pollSkin()}&${p.q}&r=${this.replay()}`),
    })),
  );
  protected readonly num = signal<number | null>(77);
  // по одной карточке каждого уровня
  protected readonly cards: CardData[] = [68, 79, 86, 92, 97].map((overall, i) => ({
    nickname: ['Kaido', 'NightOwl', 'Hachiroku', 'Touge_Ghost', 'Sadlerk'][i],
    start_number: [101, 103, 105, 102, 21][i],
    avatar_url: null,
    team: i > 2 ? '21 Project' : null,
    car: 'Kami S15',
    overall,
    angle: overall + 2,
    style: overall - 3,
    line: overall,
    wins: i,
  }));
  protected readonly road: RoadStage[] = ['Ebisu Minami', 'Irohazaka', 'Haruna', 'Tsukuba', 'Meihan', 'Ebisu Kita', 'Final · Akina'].map((track, i) => ({
    id: i + 1,
    ord: i + 1,
    title: `Этап ${i + 1}`,
    track,
    // этап 3 был 5 дней назад, этап 4 — через 10 дней: огонёк на трети пути
    starts_at: i > 3 ? null : new Date(Date.now() + (i === 3 ? 10 : -5 - (2 - i) * 14) * 86_400_000).toISOString(),
    status: i < 3 ? 'finished' : i === 3 ? 'registration' : 'draft',
    winner: ['Hachiroku', 'Kaido', 'Hachiroku'][i] ?? null,
  }));
  protected readonly pilots: (Pilot & { ovr: number | null; rank: Rank })[] = (
    [
      ['Sadlerk', 21, 97], ['Kaido', 7, 95], ['Touge_Ghost', 12, 93], ['NightOwl', 33, 90], ['Hachiroku', 86, 88],
      ['RedSuns', 44, 84], ['Usui_Line', 9, 80], ['Akina_Down', 15, 76], ['Manji', 88, 72], ['Feint', 110, 61],
      ['Wangan', 3, null], ['Haruna', 64, null],
    ] as [string, number, number | null][]
  ).map(([nickname, n, ovr], i) => ({
    id: 'demo-' + i,
    steam_id: 'demo-' + i,
    nickname,
    avatar_url: null,
    start_number: n,
    car: ['Kami S15', 'Spectre R34', 'Ronin 86', 'Vortex FC'][i % 4],
    ovr,
    rank: ovr === null ? 'unrated' : tierOf(ovr),
  }));
  /** по одному числу на каждый уровень хайпа 0…10 */
  protected readonly hypeCounts = [3, 7, 12, 17, 25, 35, 45, 58, 72, 90, 120];
  protected readonly soon = new Date(Date.now() + 19 * 86_400_000);
  protected readonly taken = new Map([7, 13, 21, 69, 88, 99, 101].map((n) => [n, `Pilot ${n}`] as [number, string]));
}
