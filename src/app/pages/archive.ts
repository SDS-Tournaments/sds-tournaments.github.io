import { Component, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { supabase } from '../auth';
import { Loader } from '../components/loader';

interface Archived {
  id: number;
  number: number;
  title: string;
  pilot: { nickname: string; steam_id: string; avatar_url: string | null; start_number: number | null } | null;
  team: { id: number; name: string; logo_url: string | null } | null;
  stages: { count: number }[];
}

// Архив: завершённые сезоны и их чемпионы
@Component({
  selector: 'app-archive',
  imports: [RouterLink, TranslocoPipe, Loader],
  template: `
    @if (!ready()) {
      <app-loader />
    } @else {
      <section class="section container page-in">
        <h1 class="display-lg">{{ 'nav.archive' | transloco }}</h1>
        <div class="list">
          @for (s of seasons(); track s.id) {
            <article class="card season">
              <span class="no mono">S{{ s.number }}</span>
              <div class="head">
                <h2>{{ s.title }}</h2>
                <p class="subtle">{{ 'archive.stages' | transloco: { n: s.stages[0]?.count ?? 0 } }}</p>
              </div>
              <div class="champs">
                @if (s.pilot; as p) {
                  <a class="champ" [routerLink]="['/pilots', p.steam_id]">
                    @if (p.avatar_url) { <img [src]="p.avatar_url" alt="" width="48" height="48" loading="lazy" decoding="async" /> } @else { <span class="ph">{{ p.nickname[0] }}</span> }
                    <span><span class="eyebrow">🏆 {{ 'archive.champion' | transloco }}</span><b>{{ p.nickname }}</b></span>
                  </a>
                }
                @if (s.team; as t) {
                  <a class="champ" [routerLink]="['/teams', t.id]">
                    <span class="tl" [style.background-image]="t.logo_url ? 'url(' + t.logo_url + ')' : null"></span>
                    <span><span class="eyebrow">{{ 'archive.teamChampion' | transloco }}</span><b>{{ t.name }}</b></span>
                  </a>
                }
              </div>
              <a class="more" routerLink="/standings" [queryParams]="{ season: s.id }">{{ 'home.fullStandings' | transloco }} →</a>
            </article>
          } @empty {
            <p class="subtle">{{ 'archive.empty' | transloco }}</p>
          }
        </div>
      </section>
    }
  `,
  styles: `
    h1 { margin-bottom: 32px; }
    .list { display: grid; gap: 20px; }
    .season { position: relative; display: grid; gap: 20px; grid-template-columns: 1fr auto; align-items: center; overflow: hidden; }
    @media (max-width: 760px) { .season { grid-template-columns: 1fr; } }
    .no { position: absolute; right: 20px; top: -8px; font-size: 96px; line-height: 1; color: transparent; -webkit-text-stroke: 1px var(--hairline-strong); pointer-events: none; }
    .head h2 { font-size: 26px; }
    .head p { margin: 4px 0 0; }
    .champs { display: flex; flex-wrap: wrap; gap: 16px; grid-column: 1 / -1; }
    .champ {
      position: relative; display: flex; gap: 12px; align-items: center; padding: 12px 18px 12px 12px; border: 1px solid var(--hairline-strong);
      border-radius: var(--r-pill); background: var(--surface-2); color: var(--ink); background-image: none;
      &:hover { border-color: var(--primary); color: var(--ink); }
      > span:last-child { display: grid; }
      .eyebrow { font-size: 10px; }
    }
    .champ img, .ph, .tl { width: 48px; height: 48px; border-radius: 50%; flex-shrink: 0; background: var(--surface-3) center / cover no-repeat; }
    .ph { display: grid; place-items: center; color: var(--primary); font-weight: 600; font-size: 20px; }
    .tl { border-radius: var(--r-md); }
    .more { position: relative; grid-column: 1 / -1; justify-self: start; }
  `,
})
export class Archive implements OnInit {
  protected readonly seasons = signal<Archived[]>([]);
  protected readonly ready = signal(false);

  async ngOnInit() {
    const { data } = await supabase
      .from('seasons')
      .select('id, number, title, pilot:profiles!seasons_champion_pilot_id_fkey(nickname, steam_id, avatar_url, start_number), team:teams!seasons_champion_team_id_fkey(id, name, logo_url), stages(count)')
      .eq('status', 'finished')
      .order('number', { ascending: false });
    this.seasons.set((data ?? []) as unknown as Archived[]);
    this.ready.set(true);
  }
}
