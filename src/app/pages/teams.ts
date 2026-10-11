import { Component, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { supabase } from '../auth';
import { Loader } from '../components/loader';
import { currentSeason, loadStandings } from '../data/standings';

interface TeamCard {
  id: number;
  name: string;
  logo_url: string | null;
  members: number;
  place: number | null;
  points: number | null;
}

// Команды текущего сезона: состав и место в командном зачёте
@Component({
  selector: 'app-teams',
  imports: [RouterLink, TranslocoPipe, Loader],
  template: `
    @if (!ready()) {
      <app-loader />
    } @else {
      <section class="section container page-in">
        <p class="eyebrow">{{ season() }}</p>
        <h1 class="display-lg">{{ 'nav.teams' | transloco }}</h1>
        <div class="grid">
          @for (t of teams(); track t.id) {
            <a class="card card-hover team" [routerLink]="['/teams', t.id]">
              <span class="logo" [style.background-image]="t.logo_url ? 'url(' + t.logo_url + ')' : null">@if (!t.logo_url) { {{ initials(t.name) }} }</span>
              <span class="info">
                <b>{{ t.name }}</b>
                <span class="subtle">{{ 'teams.members' | transloco: { n: t.members } }}</span>
              </span>
              @if (t.place) {
                <span class="rank"><span class="mono p">{{ t.place }}</span><span class="mono pts">{{ t.points }}</span></span>
              }
            </a>
          } @empty {
            <p class="subtle">{{ 'teams.none' | transloco }}</p>
          }
        </div>
      </section>
    }
  `,
  styles: `
    h1 { margin: 12px 0 32px; }
    .grid { display: grid; gap: 16px; grid-template-columns: repeat(auto-fill, minmax(min(100%, 320px), 1fr)); }
    .team { display: flex; gap: 16px; align-items: center; color: var(--ink); background-image: none; }
    .logo { display: grid; place-items: center; width: 64px; height: 64px; flex-shrink: 0; border-radius: var(--r-md); border: 1px solid var(--hairline-strong); background: var(--primary-soft) center / cover no-repeat; color: var(--primary); font: 600 20px var(--mono); }
    .info { display: grid; flex: 1; min-width: 0; }
    .info b { font-size: 18px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .info span { font-size: 13px; }
    .rank { display: grid; justify-items: end; }
    .p { font-size: 28px; line-height: 1; color: var(--primary); }
    .p::before { content: '#'; font-size: 14px; color: var(--ink-subtle); }
    .pts { font-size: 12px; color: var(--ink-subtle); }
  `,
})
export class Teams implements OnInit {
  protected readonly teams = signal<TeamCard[]>([]);
  protected readonly season = signal('');
  protected readonly ready = signal(false);

  async ngOnInit() {
    const season = await currentSeason();
    const [{ data: teams }, members, st] = await Promise.all([
      supabase.from('teams').select('id, name, logo_url').order('name'),
      season ? supabase.from('team_members').select('team_id').eq('season_id', season.id).eq('status', 'approved') : Promise.resolve({ data: [] }),
      season ? loadStandings(season.id, season.team_counted) : Promise.resolve({ teams: [] }),
    ]);
    const count = new Map<number, number>();
    for (const m of members.data ?? []) count.set(m.team_id, (count.get(m.team_id) ?? 0) + 1);
    const rank = new Map(st.teams.map((t) => [Number(t.id), t]));
    this.season.set(season?.title ?? '');
    this.teams.set(
      (teams ?? [])
        .map((t) => ({ ...t, members: count.get(t.id) ?? 0, place: rank.get(t.id)?.place ?? null, points: rank.get(t.id)?.points ?? null }))
        // сначала по месту в зачёте, затем заявленные на сезон
        .sort((a, b) => (a.place ?? 1e9) - (b.place ?? 1e9) || b.members - a.members),
    );
    this.ready.set(true);
  }

  protected initials(name: string) {
    return name.split(/\s+/).map((w) => w[0]).join('').slice(0, 2).toUpperCase();
  }
}
