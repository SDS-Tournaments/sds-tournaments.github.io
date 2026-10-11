import { Component, computed, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { supabase } from '../auth';
import { Loader } from '../components/loader';
import { currentSeason } from '../data/standings';

interface Pilot {
  id: string;
  steam_id: string;
  nickname: string;
  avatar_url: string | null;
  start_number: number | null;
  car: string | null;
}

// Список пилотов с поиском по нику и номеру
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
        <div class="grid">
          @for (p of shown(); track p.id) {
            <a class="card card-hover pilot" [routerLink]="['/pilots', p.steam_id]">
              <span class="num mono">{{ p.start_number ?? '—' }}</span>
              @if (p.avatar_url) { <img [src]="p.avatar_url" alt="" width="56" height="56" loading="lazy" /> } @else { <span class="ph">{{ p.nickname[0] }}</span> }
              <span class="info">
                <b>{{ p.nickname }}</b>
                <span class="subtle">{{ team()[p.id] ?? '' }}</span>
                <span class="car">{{ p.car ?? '' }}</span>
              </span>
            </a>
          } @empty {
            <p class="subtle">{{ 'pilots.none' | transloco }}</p>
          }
        </div>
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
    .pilot:hover .num { -webkit-text-stroke-color: var(--primary); }
    img, .ph { width: 56px; height: 56px; border-radius: 50%; flex-shrink: 0; box-shadow: 0 0 0 2px var(--hairline-strong); }
    .ph { display: grid; place-items: center; background: var(--surface-3); color: var(--primary); font-weight: 600; font-size: 22px; }
    .info { position: relative; display: grid; min-width: 0; }
    .info b { font-size: 17px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .info span { font-size: 13px; }
    .car { color: var(--ink-muted); }
  `,
})
export class Pilots implements OnInit {
  protected readonly pilots = signal<Pilot[]>([]);
  protected readonly team = signal<Record<string, string>>({});
  protected readonly ready = signal(false);
  protected query = '';
  protected readonly q = signal('');
  protected readonly shown = computed(() => {
    const q = this.q().trim().toLowerCase();
    return q ? this.pilots().filter((p) => p.nickname.toLowerCase().includes(q) || String(p.start_number ?? '').startsWith(q)) : this.pilots();
  });

  async ngOnInit() {
    const [{ data }, season] = await Promise.all([
      supabase.from('profiles').select('id, steam_id, nickname, avatar_url, start_number, car').order('start_number', { nullsFirst: false }),
      currentSeason(),
    ]);
    if (season) {
      const { data: m } = await supabase.from('team_members').select('profile_id, team:teams(name)').eq('season_id', season.id).eq('status', 'approved');
      this.team.set(Object.fromEntries(((m ?? []) as unknown as { profile_id: string; team: { name: string } | null }[]).map((x) => [x.profile_id, x.team?.name ?? ''])));
    }
    this.pilots.set(data ?? []);
    this.ready.set(true);
  }
}
