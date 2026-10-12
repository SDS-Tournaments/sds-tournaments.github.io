import { Component, computed, inject, input, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { supabase } from '../auth';
import { Loader } from '../components/loader';
import { CAR_PROTOTYPES } from '../catalog';
import { pageTitle } from '../title';
import { loadSkillRuns, PilotShowcase } from '../components/pilot-showcase';
import { AchievementShelf } from '../components/achievement-shelf';
import { currentSeason } from '../data/standings';
import { Legacy, SkillRun } from '../scoring/scoring';

interface Profile {
  id: string;
  nickname: string;
  avatar_url: string | null;
  start_number: number | null;
  livery_url: string | null;
  car: string | null;
  engine: string | null;
  gearbox: string | null;
  power_hp: number | null;
  bio_ru: string | null;
  bio_en: string | null;
  legacy?: Legacy | null;
}
interface Result {
  stage_id: number;
  stage_place: number;
  qual_place: number;
  total: number;
  stage: { ord: number; title_ru: string; title_en: string | null; season: { title: string } | null } | null;
}


// Публичный профиль пилота: обложка-ливрея, машина, статистика, «паутинка», FIFA-карточка, достижения, история
@Component({
  selector: 'app-pilot',
  imports: [RouterLink, TranslocoPipe, Loader, PilotShowcase, AchievementShelf],
  template: `
    @if (!ready()) {
      <app-loader />
    } @else if (p(); as p) {
      <div class="page-in">
        <header class="hero">
          <div class="cover" [style.background-image]="p.livery_url ? 'url(' + p.livery_url + ')' : null"></div>
          <div class="container who">
            <a routerLink="/pilots" class="back">← {{ 'nav.pilots' | transloco }}</a>
            <div class="id">
              @if (p.avatar_url) { <img [src]="p.avatar_url" alt="" width="112" height="112" /> }
              <div>
                <p class="eyebrow">{{ team() ?? 'Sad Drift Series' }}</p>
                <h1 class="display-lg"><span class="num mono">#{{ p.start_number ?? '—' }}</span> {{ p.nickname }}</h1>
                <dl class="spec mono">
                  @for (s of spec(); track s.k) { <div><dt>{{ s.k | transloco }}</dt><dd>{{ s.v }}@if (s.sub) { <small class="proto">{{ s.sub }}</small> }</dd></div> }
                </dl>
              </div>
            </div>
          </div>
        </header>

        <section class="container body">
          @if (bio(); as b) { <p class="bio muted">{{ b }}</p> }

          <div class="stats">
            @for (s of stats(); track s.k) {
              <div class="stat card"><span class="v mono">{{ s.v }}</span><span class="k">{{ s.k | transloco }}</span></div>
            }
          </div>

          <app-pilot-showcase [pilot]="p" [runs]="runs()" [team]="team()" [wins]="wins()" [legacy]="p.legacy" />
          <app-achievement-shelf [profileId]="p.id" />

          <h2 class="h sec">{{ 'pilot.history' | transloco }}</h2>
          <div class="table-wrap card flush">
            <table class="table">
              <thead><tr><th>{{ 'pilot.stage' | transloco }}</th><th class="num">{{ 'pilot.qual' | transloco }}</th><th class="num">{{ 'pilot.place' | transloco }}</th><th class="num">{{ 'home.points' | transloco }}</th></tr></thead>
              <tbody>
                @for (r of results(); track r.stage_id) {
                  <tr>
                    <td><a [routerLink]="['/stages', r.stage_id]">{{ r.stage?.season?.title }} · {{ stageTitle(r) }}</a></td>
                    <td class="num muted">{{ r.qual_place }}</td>
                    <td class="num" [class.top]="r.stage_place <= 3">{{ r.stage_place }}</td>
                    <td class="num total">{{ r.total }}</td>
                  </tr>
                } @empty {
                  <tr><td colspan="4" class="subtle">{{ 'pilot.noHistory' | transloco }}</td></tr>
                }
              </tbody>
            </table>
          </div>
        </section>
      </div>
    } @else {
      <section class="section container"><p class="subtle">{{ 'pilot.notFound' | transloco }}</p></section>
    }
  `,
  styles: `
    .hero { position: relative; padding: 48px 0 32px; overflow: hidden; isolation: isolate; }
    .cover {
      position: absolute; inset: 0; z-index: -1;
      background: radial-gradient(60% 100% at 80% 0%, rgba(var(--accent-rgb), 0.25), transparent 70%) center / cover no-repeat;
      mask-image: linear-gradient(to bottom, rgba(0, 0, 0, 0.7), transparent 95%);
    }
    .back { display: inline-block; margin-bottom: 32px; font-size: 14px; }
    .id { display: flex; flex-wrap: wrap; gap: 24px; align-items: center; }
    .id img { border-radius: 50%; box-shadow: 0 0 0 3px var(--canvas), 0 0 0 5px var(--primary), 0 0 40px var(--primary-glow); }
    h1 { margin: 6px 0 12px; }
    .num { color: var(--primary); font-style: italic; }
    .spec { display: flex; flex-wrap: wrap; gap: 6px 28px; margin: 0; }
    .spec div { display: grid; }
    .spec dt { font-size: 10px; letter-spacing: 1px; text-transform: uppercase; color: var(--ink-subtle); }
    .spec dd { margin: 0; font-size: 15px; }
    .proto { display: block; font-family: var(--font); font-size: 11px; color: var(--ink-subtle); }

    .body { padding-bottom: 96px; }
    .bio { max-width: 720px; white-space: pre-line; margin: 0 0 32px; }
    .stats { display: grid; gap: 12px; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); margin-bottom: 24px; }
    .stat { display: grid; gap: 4px; padding: 18px 20px; }
    .stat .v { font-size: 30px; color: var(--primary); line-height: 1; }
    .stat .k { font-size: 11px; letter-spacing: 1px; text-transform: uppercase; color: var(--ink-subtle); }
    .h { font-size: 18px; margin-bottom: 16px; }
    .sec { margin: 48px 0 16px; }
    .flush { padding: 0; }
    .top { color: var(--primary); font-weight: 600; }
    .total { color: var(--primary); }
  `,
})
export class PilotPage implements OnInit {
  readonly steamId = input.required<string>();
  protected readonly p = signal<Profile | null>(null);
  protected readonly ready = signal(false);
  protected readonly team = signal<string | null>(null);
  protected readonly results = signal<Result[]>([]);
  protected readonly runs = signal<SkillRun[]>([]);
  private readonly t = inject(TranslocoService);
  private readonly lang = signal(this.t.getActiveLang());

  protected readonly wins = computed(() => this.results().filter((x) => x.stage_place === 1).length);
  protected readonly bio = computed(() => {
    const p = this.p();
    return (this.lang() === 'en' && p?.bio_en) || p?.bio_ru || null;
  });
  protected readonly spec = computed(() => {
    const p = this.p();
    if (!p) return [];
    return [
      { k: 'me.carModel', v: p.car, sub: p.car ? CAR_PROTOTYPES[p.car] : undefined },
      { k: 'me.engine', v: p.engine },
      { k: 'me.gearbox', v: p.gearbox },
      { k: 'me.powerShort', v: p.power_hp },
    ].filter((x) => x.v);
  });
  protected readonly stats = computed(() => {
    const r = this.results();
    return [
      { k: 'pilot.stages', v: r.length },
      { k: 'pilot.wins', v: this.wins() + (this.p()?.legacy?.wins ?? 0) }, // + победы до сайта
      { k: 'pilot.podiums', v: r.filter((x) => x.stage_place <= 3).length },
      { k: 'pilot.best', v: r.length ? Math.min(...r.map((x) => x.stage_place)) : '—' },
      { k: 'pilot.points', v: r.reduce((s, x) => s + x.total, 0) },
    ];
  });
  constructor() {
    this.t.langChanges$.subscribe((l) => this.lang.set(l));
  }

  async ngOnInit() {
    const { data: p } = await supabase
      .from('profiles')
      .select('*')
      .eq('steam_id', this.steamId())
      .maybeSingle();
    if (p) {
      const season = await currentSeason();
      const [results, runs, member] = await Promise.all([
        supabase.from('stage_results').select('stage_id, stage_place, qual_place, total, stage:stages(ord, title_ru, title_en, season:seasons(title))').eq('profile_id', p.id).order('stage_id', { ascending: false }),
        loadSkillRuns(p.id),
        season ? supabase.from('team_members').select('team:teams(name)').eq('season_id', season.id).eq('profile_id', p.id).eq('status', 'approved').maybeSingle() : Promise.resolve({ data: null }),
      ]);
      this.results.set((results.data ?? []) as unknown as Result[]);
      this.runs.set(runs);
      this.team.set(((member.data as { team: { name: string } | null } | null)?.team?.name) ?? null);
      this.p.set(p);
      pageTitle(`${p.nickname} — пилот`);
    }
    this.ready.set(true);
  }

  protected stageTitle(r: Result) {
    return (this.lang() === 'en' && r.stage?.title_en) || r.stage?.title_ru || '';
  }
}
