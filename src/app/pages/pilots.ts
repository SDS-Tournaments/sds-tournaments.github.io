import { Component, computed, input, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { supabase } from '../auth';
import { Loader } from '../components/loader';
import { Tier, tierOf } from '../components/pilot-card';
import { currentSeason } from '../data/standings';
import { Legacy, mergeSkills, SkillRun, skills } from '../scoring/scoring';

export interface Pilot {
  id: string;
  steam_id: string;
  nickname: string;
  avatar_url: string | null;
  start_number: number | null;
  car: string | null;
  legacy?: Legacy | null;
}
export type Rank = Tier | 'unrated';
const ORDER: Rank[] = ['legend', 'elite', 'gold', 'silver', 'bronze', 'unrated'];

// Пилоты по уровню FIFA-карточки (Legend → Bronze, затем без рейтинга), поиск по нику и номеру
@Component({
  selector: 'app-pilots',
  imports: [FormsModule, RouterLink, TranslocoPipe, Loader],
  template: `
    @if (!ready()) {
      <app-loader />
    } @else {
      <section class="section container page-in">
        <header class="top">
          <h1 class="display-lg">{{ 'nav.pilots' | transloco }} <span class="count mono">{{ pilots().length }}</span></h1>
          <input class="input search" type="search" [placeholder]="'pilots.search' | transloco" [(ngModel)]="query" (ngModelChange)="q.set($event)" />
        </header>
        @for (g of groups(); track g.rank) {
          <section class="tier" [class]="g.rank">
            <h2 class="thead">
              <span class="tname">{{ g.rank === 'unrated' ? ('pilots.unrated' | transloco) : g.rank }}</span>
              <span class="tline" aria-hidden="true"></span>
              <span class="tcount mono">{{ g.pilots.length }}</span>
            </h2>
            <div class="grid">
              @for (p of g.pilots; track p.id) {
                <a class="card card-hover pilot" [routerLink]="['/pilots', p.steam_id]">
                  <span class="num mono">{{ p.start_number ?? '—' }}</span>
                  @if (p.avatar_url) { <img [src]="p.avatar_url" alt="" width="56" height="56" loading="lazy" /> } @else { <span class="ph">{{ p.nickname[0] }}</span> }
                  <span class="info">
                    <b>{{ p.nickname }}</b>
                    <span class="subtle">{{ team()[p.id] ?? '' }}</span>
                    <span class="car">{{ p.car ?? '' }}</span>
                  </span>
                  @if (p.ovr !== null) { <span class="ovr">{{ p.ovr }}</span> }
                </a>
              }
            </div>
          </section>
        } @empty {
          <p class="subtle">{{ 'pilots.none' | transloco }}</p>
        }
      </section>
    }
  `,
  styles: `
    .top { display: flex; flex-wrap: wrap; gap: 16px; align-items: end; justify-content: space-between; margin-bottom: 32px; }
    .count { font-size: 0.4em; color: var(--primary); vertical-align: super; }
    .search { width: min(100%, 320px); }
    .grid { display: grid; gap: 16px; grid-template-columns: repeat(auto-fill, minmax(min(100%, 280px), 1fr)); }
    .pilot { position: relative; display: flex; gap: 16px; align-items: center; padding: 18px 20px; color: var(--ink); background-image: none; overflow: hidden; }
    .num {
      position: absolute; right: 12px; bottom: -10px; font-size: 64px; font-weight: 600; font-style: italic; line-height: 1;
      color: transparent; -webkit-text-stroke: 1px var(--hairline-strong); transition: -webkit-text-stroke-color var(--base);
    }
    .pilot:hover .num { -webkit-text-stroke-color: var(--t); }
    img, .ph { width: 56px; height: 56px; border-radius: 50%; flex-shrink: 0; box-shadow: 0 0 0 2px var(--t-ring); }
    .ph { display: grid; place-items: center; background: var(--surface-3); color: var(--primary); font-weight: 600; font-size: 22px; }
    .info { position: relative; display: grid; min-width: 0; flex: 1; }
    .info b { font-size: 17px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .info span { font-size: 13px; }
    .car { color: var(--ink-muted); }
    .ovr {
      position: absolute; top: 10px; right: 12px; padding: 2px 8px; border-radius: var(--r-pill);
      font: 400 13px/1.4 'Russo One', var(--font); color: var(--t-ink, #000); background: var(--t-fill);
    }

    /* Ряд уровня: заголовок в духе карточки + окраска мини-карточек */
    .tier { --t: var(--primary); --t-ring: var(--hairline-strong); --t-fill: var(--surface-3); margin-bottom: 40px; }
    .thead { display: flex; align-items: center; gap: 16px; margin: 0 0 16px; }
    .tname { font: 400 22px/1 'Russo One', var(--font); letter-spacing: 0.12em; text-transform: uppercase; color: var(--t); }
    .tline { flex: 1; height: 1px; background: linear-gradient(90deg, var(--t), transparent); opacity: 0.6; }
    .tcount { font-size: 13px; color: var(--ink-subtle); }
    .tier .pilot { border-color: color-mix(in srgb, var(--t), transparent 72%); }
    .tier .pilot:hover { border-color: var(--t); box-shadow: 0 0 24px -8px var(--t); }

    .bronze { --t: #cd8a4f; --t-ring: #8a5a30; --t-fill: linear-gradient(135deg, #7a4a22, #e0a46a, #8a5a30); }
    .silver { --t: #dfe5e8; --t-ring: #9aa3a9; --t-fill: linear-gradient(135deg, #7d868c, #f4f7f8, #9aa3a9); }
    .gold { --t: #f5d77a; --t-ring: #b8902c; --t-fill: linear-gradient(135deg, #7a5a14, #f8e08e, #b8902c); }
    .gold .tname { background: linear-gradient(135deg, #b8902c, #fff2b8 45%, #e8c763); -webkit-background-clip: text; background-clip: text; color: transparent; filter: drop-shadow(0 0 10px rgba(245, 215, 122, 0.45)); }
    .elite { --t: #c79bff; --t-ring: #c79bff; --t-fill: linear-gradient(135deg, #6a2cff, #c79bff, #ff4fd8); --t-ink: #fff; }
    .elite .tname { background: linear-gradient(90deg, #fff, #c79bff); -webkit-background-clip: text; background-clip: text; color: transparent; filter: drop-shadow(0 0 12px rgba(199, 155, 255, 0.7)); }
    .elite .tline { background: linear-gradient(90deg, #6a2cff, #ff4fd8, transparent); }
    .elite img { box-shadow: 0 0 0 2px #c79bff, 0 0 16px rgba(199, 155, 255, 0.55); }
    .legend { --t: #f4f2ee; --t-ring: #ffd36e; --t-fill: linear-gradient(120deg, #fff, #f4f2ee 40%, #ffd36e); }
    .legend .tname {
      background: linear-gradient(90deg, #ff6ec7, #ffd36e, #7dffb0, #6ee7ff, #b28dff, #ff6ec7) 0 0 / 200% 100%;
      -webkit-background-clip: text; background-clip: text; color: transparent; animation: holo 6s linear infinite;
    }
    .legend .tname::before { content: '✦ '; }
    .legend .tline { background: linear-gradient(90deg, #ff6ec7, #ffd36e, #6ee7ff, transparent); }
    .legend .pilot { background: linear-gradient(135deg, rgba(244, 242, 238, 0.07), transparent 60%), var(--surface-1); }
    .legend img { box-shadow: 0 0 0 2px #fff, 0 0 20px rgba(255, 211, 110, 0.6); }
    @keyframes holo { to { background-position: -200% 0; } }
    .unrated { --t: var(--ink-subtle); }
    :host-context([data-theme='light']) .silver { --t: #6f7a80; }
    :host-context([data-theme='light']) .gold .tname { background-image: linear-gradient(135deg, #8a6a1c, #c9a227 45%, #8a6a1c); filter: none; }
    :host-context([data-theme='light']) .elite .tname { background-image: linear-gradient(90deg, #6a2cff, #b04fd8); filter: none; }
    :host-context([data-theme='light']) .legend { --t: #8a6a1c; }
    :host-context([data-theme='light']) .legend .tname { background-image: linear-gradient(90deg, #c2187a, #b87400, #0f8f5c, #0a7fa8, #6a3fd0, #c2187a); }
    :host-context([data-theme='light']) .num { -webkit-text-stroke-color: rgba(11, 13, 16, 0.12); }
    :host-context([data-theme='light']) .ovr { box-shadow: inset 0 0 0 1px rgba(11, 13, 16, 0.15); }
    .unrated .tname { font-family: var(--font); font-weight: 500; font-size: 15px; letter-spacing: 0.1em; }
    .unrated .tline { opacity: 0.3; }
    @media (prefers-reduced-motion: reduce) { .legend .tname { animation: none; } }
  `,
})
export class Pilots implements OnInit {
  /** готовый список для витрины /dev/ui — без запросов к базе */
  readonly demo = input<(Pilot & { ovr: number | null; rank: Rank })[] | null>(null);
  protected readonly pilots = signal<(Pilot & { ovr: number | null; rank: Rank })[]>([]);
  protected readonly team = signal<Record<string, string>>({});
  protected readonly ready = signal(false);
  protected query = '';
  protected readonly q = signal('');
  protected readonly groups = computed(() => {
    const q = this.q().trim().toLowerCase();
    const list = q ? this.pilots().filter((p) => p.nickname.toLowerCase().includes(q) || String(p.start_number ?? '').startsWith(q)) : this.pilots();
    return ORDER.map((rank) => ({ rank, pilots: list.filter((p) => p.rank === rank) })).filter((g) => g.pilots.length);
  });

  async ngOnInit() {
    const demo = this.demo();
    if (Array.isArray(demo)) {
      this.pilots.set(demo);
      return this.ready.set(true);
    }
    const [{ data }, runs, season] = await Promise.all([
      supabase.from('profiles').select('*'),
      // shortcut: все оценки всех пилотов одним запросом — ок на сотни пилотов; при тысячах считать OVR в базе
      supabase.from('qual_runs').select('profile_id, attempt, angle, style, line, spin, stage:stages(weights)'),
      currentSeason(),
    ]);
    if (season) {
      const { data: m } = await supabase.from('team_members').select('profile_id, team:teams(name)').eq('season_id', season.id).eq('status', 'approved');
      this.team.set(Object.fromEntries(((m ?? []) as unknown as { profile_id: string; team: { name: string } | null }[]).map((x) => [x.profile_id, x.team?.name ?? ''])));
    }
    const byPilot = new Map<string, SkillRun[]>();
    for (const r of (runs.data ?? []) as unknown as (Omit<SkillRun, 'weights'> & { profile_id: string; stage: { weights: SkillRun['weights'] } | null })[])
      byPilot.set(r.profile_id, [...(byPilot.get(r.profile_id) ?? []), { ...r, weights: r.stage?.weights ?? { angle: 40, style: 30, line: 30 } }]);
    const rated = ((data ?? []) as Pilot[]).map((p) => {
      const ovr = mergeSkills(skills(byPilot.get(p.id) ?? []), p.legacy)?.overall ?? null;
      return { ...p, ovr, rank: (ovr === null ? 'unrated' : tierOf(ovr)) as Rank };
    });
    // внутри уровня — по рейтингу, затем по номеру
    rated.sort((a, b) => (b.ovr ?? -1) - (a.ovr ?? -1) || (a.start_number ?? 1e9) - (b.start_number ?? 1e9));
    this.pilots.set(rated);
    this.ready.set(true);
  }
}
