import { Component, input, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { supabase } from '../auth';
import { Loader } from '../components/loader';
import { currentSeason, loadStandings } from '../data/standings';
import { teamStage } from '../scoring/scoring';
import { pageTitle } from '../title';

interface Member {
  profile_id: string;
  pilot: { nickname: string; steam_id: string; avatar_url: string | null; start_number: number | null; car: string | null } | null;
}

// Страница команды: состав сезона, место в зачёте, очки по этапам
@Component({
  selector: 'app-team',
  imports: [RouterLink, TranslocoPipe, Loader],
  template: `
    @if (!ready()) {
      <app-loader />
    } @else if (team(); as t) {
      <section class="section container page-in">
        <a routerLink="/teams" class="back">← {{ 'nav.teams' | transloco }}</a>
        <header class="head">
          <span class="logo" [style.background-image]="t.logo_url ? 'url(' + t.logo_url + ')' : null">@if (!t.logo_url) { {{ initials(t.name) }} }</span>
          <div>
            <p class="eyebrow">{{ season() }}</p>
            <h1 class="display-lg">{{ t.name }}</h1>
          </div>
          @if (place()) {
            <div class="rank"><span class="mono p">#{{ place() }}</span><span class="mono pts">{{ points() }} {{ 'home.points' | transloco }}</span></div>
          }
        </header>

        <h2 class="h">{{ 'teams.roster' | transloco }}</h2>
        <div class="roster">
          @for (m of members(); track m.profile_id) {
            <a class="card card-hover pilot" [routerLink]="['/pilots', m.pilot?.steam_id]">
              @if (m.pilot?.avatar_url) { <img [src]="m.pilot!.avatar_url" alt="" width="48" height="48" loading="lazy" decoding="async" /> } @else { <span class="ph">{{ m.pilot?.nickname?.[0] }}</span> }
              <span class="info">
                <b><span class="mono n">#{{ m.pilot?.start_number ?? '—' }}</span> {{ m.pilot?.nickname }}</b>
                <span class="subtle">{{ m.pilot?.car ?? '' }}</span>
              </span>
              @if (m.profile_id === t.captain_id) { <span class="cap mono">C</span> }
            </a>
          } @empty {
            <p class="subtle">{{ 'teams.noRoster' | transloco }}</p>
          }
        </div>

        @if (byStage().length) {
          <h2 class="h">{{ 'teams.byStage' | transloco }}</h2>
          <div class="table-wrap card flush">
            <table class="table">
              <thead><tr><th>{{ 'pilot.stage' | transloco }}</th><th class="num">{{ 'pilot.place' | transloco }}</th><th class="num">{{ 'home.points' | transloco }}</th></tr></thead>
              <tbody>
                @for (r of byStage(); track r.stageId) {
                  <tr>
                    <td><a [routerLink]="['/stages', r.stageId]">{{ 'road.stage' | transloco: { n: r.ord } }}</a></td>
                    <td class="num">{{ r.place }}</td>
                    <td class="num total">{{ r.points }}</td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        }
      </section>
    } @else {
      <section class="section container"><p class="subtle">{{ 'teams.notFound' | transloco }}</p></section>
    }
  `,
  styles: `
    .back { display: inline-block; margin-bottom: 24px; font-size: 14px; }
    .head { display: flex; flex-wrap: wrap; gap: 24px; align-items: center; margin-bottom: 40px; }
    .head > div:nth-child(2) { flex: 1; }
    h1 { margin-top: 6px; }
    .logo { display: grid; place-items: center; width: 96px; height: 96px; border-radius: var(--r-lg); border: 1px solid var(--primary); background: var(--primary-soft) center / cover no-repeat; color: var(--primary); font: 600 32px var(--mono); box-shadow: 0 0 32px -8px var(--primary-glow); }
    .rank { display: grid; justify-items: end; }
    .p { font-size: 48px; line-height: 1; color: var(--primary); }
    .pts { font-size: 13px; color: var(--ink-subtle); }
    .h { font-size: 18px; margin: 32px 0 16px; }
    .roster { display: grid; gap: 12px; grid-template-columns: repeat(auto-fill, minmax(min(100%, 260px), 1fr)); }
    .pilot { display: flex; gap: 14px; align-items: center; padding: 14px 18px; color: var(--ink); background-image: none; }
    .pilot img, .ph { width: 48px; height: 48px; border-radius: 50%; flex-shrink: 0; }
    .ph { display: grid; place-items: center; background: var(--surface-3); color: var(--primary); font-weight: 600; }
    .info { display: grid; flex: 1; min-width: 0; }
    .info b { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .info span { font-size: 13px; }
    .n { color: var(--primary); }
    .cap { font-size: 11px; font-weight: 600; padding: 2px 7px; border-radius: var(--r-sm); background: var(--primary); color: var(--on-primary); }
    .flush { padding: 0; }
    .total { color: var(--primary); }
  `,
})
export class TeamPage implements OnInit {
  readonly id = input.required<string>();
  protected readonly team = signal<{ id: number; name: string; logo_url: string | null; captain_id: string | null } | null>(null);
  protected readonly members = signal<Member[]>([]);
  protected readonly season = signal('');
  protected readonly place = signal<number | null>(null);
  protected readonly points = signal<number | null>(null);
  protected readonly byStage = signal<{ stageId: number; ord: number; place: number; points: number }[]>([]);
  protected readonly ready = signal(false);

  async ngOnInit() {
    const id = Number(this.id());
    const [{ data: team }, season] = await Promise.all([
      supabase.from('teams').select('id, name, logo_url, captain_id').eq('id', id).maybeSingle(),
      currentSeason(),
    ]);
    if (team && season) {
      const [members, st, stages] = await Promise.all([
        supabase.from('team_members').select('profile_id, pilot:profiles(nickname, steam_id, avatar_url, start_number, car)').eq('season_id', season.id).eq('team_id', id).eq('status', 'approved'),
        loadStandings(season.id, season.team_counted),
        supabase.from('stages').select('id, ord').eq('season_id', season.id).eq('status', 'finished').order('ord'),
      ]);
      this.members.set((members.data ?? []) as unknown as Member[]);
      const mine = st.teams.find((t) => Number(t.id) === id);
      this.place.set(mine?.place ?? null);
      this.points.set(mine?.points ?? null);
      // очки команды на каждом этапе: сумма лучших пилотов, место среди команд
      const ids = (stages.data ?? []).map((s) => s.id);
      if (ids.length) {
        const { data: res } = await supabase.from('stage_results').select('stage_id, team_id, total, stage_place').in('stage_id', ids);
        this.byStage.set(
          (stages.data ?? []).flatMap((s) => {
            const rows = teamStage(
              (res ?? []).filter((r) => r.stage_id === s.id).map((r) => ({ teamId: r.team_id ? String(r.team_id) : null, total: r.total, stagePlace: r.stage_place })),
              season.team_counted,
            );
            const t = rows.find((r) => r.teamId === String(id));
            return t ? [{ stageId: s.id, ord: s.ord, place: t.place, points: t.points }] : [];
          }),
        );
      }
    }
    this.season.set(season?.title ?? '');
    this.team.set(team);
    if (team) pageTitle(`${team.name} — команда`);
    this.ready.set(true);
  }

  protected initials(name: string) {
    return name.split(/\s+/).map((w) => w[0]).join('').slice(0, 2).toUpperCase();
  }
}
