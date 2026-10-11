import { Component, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslocoPipe } from '@jsverse/transloco';
import { Loader } from '../components/loader';
import { loadStandings, PilotStanding, publicSeasons, Season, StageCol, TeamStanding } from '../data/standings';

// Зачёт сезона: личный (с очками по этапам) и командный
@Component({
  selector: 'app-standings',
  imports: [FormsModule, TranslocoPipe, Loader],
  template: `
    @if (!ready()) {
      <app-loader />
    } @else {
    <section class="section container page-in">
      <header class="top">
        <div>
          <p class="eyebrow">{{ season()?.title }}</p>
          <h1 class="display-lg">{{ 'nav.standings' | transloco }}</h1>
        </div>
        @if (seasons().length > 1) {
          <select class="input season" [ngModel]="season()?.id" (ngModelChange)="pick($event)">
            @for (s of seasons(); track s.id) { <option [ngValue]="s.id">{{ s.title }}</option> }
          </select>
        }
      </header>

      <div class="tabs" role="tablist">
        <button role="tab" [class.on]="tab() === 'pilots'" [attr.aria-selected]="tab() === 'pilots'" (click)="tab.set('pilots')">{{ 'home.pilots' | transloco }}</button>
        <button role="tab" [class.on]="tab() === 'teams'" [attr.aria-selected]="tab() === 'teams'" (click)="tab.set('teams')">{{ 'home.teams' | transloco }}</button>
      </div>

      @if (loading()) {
        <app-loader [inline]="true" />
      } @else if (!pilots().length) {
        <p class="subtle empty">{{ 'standings.empty' | transloco }}</p>
      } @else if (tab() === 'pilots') {
        <div class="table-wrap card flush page-in">
          <table class="table">
            <thead>
              <tr>
                <th>#</th>
                <th>{{ 'standings.pilot' | transloco }}</th>
                @for (s of stages(); track s.id) { <th class="num">{{ 'standings.stageShort' | transloco: { n: s.ord } }}</th> }
                <th class="num">{{ 'home.points' | transloco }}</th>
              </tr>
            </thead>
            <tbody>
              @for (p of pilots(); track p.id) {
                <tr [class.podium]="p.place <= 3">
                  <td class="mono place">{{ p.place }}</td>
                  <td>
                    <span class="who">
                      @if (p.avatar_url) { <img [src]="p.avatar_url" alt="" width="28" height="28" /> } @else { <span class="ph"></span> }
                      <span class="mono n">{{ p.start_number ?? '' }}</span>
                      <span class="nick">{{ p.nickname }}</span>
                      @if (p.team) { <span class="team subtle">{{ p.team }}</span> }
                    </span>
                  </td>
                  @for (v of p.perStage; track $index) { <td class="num muted">{{ v ?? '—' }}</td> }
                  <td class="num total">{{ p.points }}</td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      } @else {
        <div class="table-wrap card flush page-in">
          <table class="table">
            <thead><tr><th>#</th><th>{{ 'standings.team' | transloco }}</th><th class="num">{{ 'home.points' | transloco }}</th></tr></thead>
            <tbody>
              @for (t of teams(); track t.id) {
                <tr [class.podium]="t.place <= 3">
                  <td class="mono place">{{ t.place }}</td>
                  <td>
                    <span class="who">
                      <span class="tlogo" [style.background-image]="t.logo_url ? 'url(' + t.logo_url + ')' : null">@if (!t.logo_url) { {{ initials(t.name) }} }</span>
                      <span class="nick">{{ t.name }}</span>
                    </span>
                  </td>
                  <td class="num total">{{ t.points }}</td>
                </tr>
              } @empty {
                <tr><td colspan="3" class="subtle">{{ 'standings.noTeams' | transloco }}</td></tr>
              }
            </tbody>
          </table>
        </div>
      }
      <p class="note subtle">{{ 'standings.note' | transloco }}</p>
    </section>
    }
  `,
  styles: `
    .top { display: flex; flex-wrap: wrap; gap: 16px; align-items: end; justify-content: space-between; margin-bottom: 32px; }
    h1 { margin-top: 12px; }
    .season { width: auto; min-width: 200px; }
    .tabs { display: inline-flex; padding: 3px; margin-bottom: 20px; border: 1px solid var(--hairline-strong); border-radius: var(--r-pill); background: var(--surface-1); }
    .tabs button {
      padding: 8px 18px; border: 0; border-radius: var(--r-pill); background: none; color: var(--ink-muted); font: 500 14px var(--font); cursor: pointer;
      transition: background-color var(--base), color var(--fast);
      &.on { background: var(--primary); color: var(--on-primary); }
    }
    .flush { padding: 0; }
    .place { color: var(--ink-subtle); width: 40px; }
    .podium .place { color: var(--primary); }
    .podium { background: rgba(10, 186, 181, 0.06); }
    .podium td:first-child { box-shadow: inset 3px 0 0 var(--primary); }
    .who { display: flex; align-items: center; gap: 10px; white-space: nowrap; }
    .who img, .ph, .tlogo { width: 28px; height: 28px; border-radius: 50%; background: var(--surface-3) center / cover no-repeat; flex-shrink: 0; }
    .tlogo { border-radius: var(--r-sm); display: grid; place-items: center; font: 600 11px var(--mono); color: var(--primary); background-color: var(--primary-soft); }
    .n { color: var(--primary); min-width: 28px; }
    .nick { font-weight: 500; }
    .team { font-size: 12px; }
    .total { color: var(--primary); font-weight: 600; font-size: 16px; }
    .empty { padding: 48px 0; }
    .note { font-size: 13px; margin-top: 16px; }
  `,
})
export class Standings implements OnInit {
  protected readonly seasons = signal<Season[]>([]);
  protected readonly season = signal<Season | null>(null);
  protected readonly tab = signal<'pilots' | 'teams'>('pilots');
  protected readonly pilots = signal<PilotStanding[]>([]);
  protected readonly teams = signal<TeamStanding[]>([]);
  protected readonly stages = signal<StageCol[]>([]);
  protected readonly loading = signal(true);
  /** первая загрузка — страница целиком скрыта до готовности данных */
  protected readonly ready = signal(false);

  async ngOnInit() {
    const list = await publicSeasons();
    this.seasons.set(list);
    const cur = list.find((s) => s.status === 'active') ?? list[0];
    if (cur) await this.pick(cur.id);
    this.loading.set(false);
    this.ready.set(true);
  }

  async pick(id: number) {
    const s = this.seasons().find((x) => x.id === id) ?? null;
    this.season.set(s);
    if (!s) return;
    this.loading.set(true);
    const st = await loadStandings(s.id, s.team_counted);
    this.pilots.set(st.pilots);
    this.teams.set(st.teams);
    this.stages.set(st.stages);
    this.loading.set(false);
  }

  protected initials(name: string) {
    return name.split(/\s+/).map((w) => w[0]).join('').slice(0, 2).toUpperCase();
  }
}
