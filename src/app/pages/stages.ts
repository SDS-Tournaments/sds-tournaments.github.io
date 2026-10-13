import { DatePipe } from '@angular/common';
import { Component, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { supabase } from '../auth';
import { Loader } from '../components/loader';
import { publicSeasons, Season } from '../data/standings';

interface StageRow {
  id: number;
  ord: number;
  title_ru: string;
  title_en: string | null;
  track: string | null;
  starts_at: string | null;
  battles_at: string | null;
  status: string;
}

// Этапы сезона: карточки со статусом и победителем
@Component({
  selector: 'app-stages',
  imports: [FormsModule, RouterLink, TranslocoPipe, DatePipe, Loader],
  template: `
    @if (!ready()) {
      <app-loader />
    } @else {
    <section class="section container page-in">
      <header class="top">
        <div>
          <p class="eyebrow">{{ season()?.title }}</p>
          <h1 class="display-lg">{{ 'nav.stages' | transloco }}</h1>
        </div>
        @if (seasons().length > 1) {
          <select class="input season" [ngModel]="season()?.id" (ngModelChange)="pick($event)">
            @for (s of seasons(); track s.id) { <option [ngValue]="s.id">{{ s.title }}</option> }
          </select>
        }
      </header>

      @if (loading()) {
        <app-loader [inline]="true" />
      } @else {
      <div class="grid page-in">
        @for (s of stages(); track s.id) {
          <a class="card card-hover stage" [class]="s.status" [routerLink]="['/stages', s.id]">
            <span class="num mono">{{ s.ord < 10 ? '0' + s.ord : s.ord }}</span>
            <span class="badge" [class]="'st-' + s.status">
              @if (s.status === 'qualifying' || s.status === 'battles' || s.status === 'registration') { <i class="pip"></i> }
              @if (s.status === 'finished') { ✓ }
              {{ 'stage.status.' + s.status | transloco }}
            </span>
            <h2>{{ title(s) }}</h2>
            <p class="subtle">{{ s.track ?? '' }}</p>
            @if (s.starts_at) {
              <p class="mono date">{{ 'stage.qualShort' | transloco }} {{ s.starts_at | date: 'dd.MM · HH:mm' }}@if (s.battles_at) { <br />{{ 'stage.battlesShort' | transloco }} {{ s.battles_at | date: 'dd.MM · HH:mm' }} }</p>
            } @else {
              <p class="mono date">{{ 'road.soon' | transloco }}</p>
            }
            @if (winners()[s.id]; as w) { <p class="winner">🏆 {{ w }}</p> }
            @if (s.status === 'registration') { <p class="cta">{{ 'stages.regOpen' | transloco }} →</p> }
            @if (s.status === 'qualifying' || s.status === 'battles') { <p class="cta">{{ 'home.next.watch' | transloco }} →</p> }
          </a>
        } @empty {
          <p class="subtle">{{ 'stages.empty' | transloco }}</p>
        }
      </div>
      }
    </section>
    }
  `,
  styles: `
    .top { display: flex; flex-wrap: wrap; gap: 16px; align-items: end; justify-content: space-between; margin-bottom: 32px; }
    h1 { margin-top: 12px; }
    .season { width: auto; min-width: 200px; }
    .grid { display: grid; gap: 20px; grid-template-columns: repeat(auto-fill, minmax(min(100%, 260px), 1fr)); }
    .stage { position: relative; display: grid; gap: 6px; color: var(--ink); background-image: none; overflow: hidden; }
    .stage h2 { font-size: 22px; margin-top: 8px; }
    .stage p { margin: 0; }
    .num { position: absolute; right: 20px; top: 12px; font-size: 56px; line-height: 1; color: transparent; -webkit-text-stroke: 1px var(--hairline-strong); }
    .badge { justify-self: start; }
    .badge { display: inline-flex; align-items: center; gap: 6px; }
    .st-draft, .st-finished { background: var(--surface-3); color: var(--ink-muted); }
    .st-registration { background: rgba(var(--accent-rgb), 0.15); color: var(--primary); }
    .st-qualifying, .st-battles { background: rgba(255, 92, 92, 0.15); color: var(--error); }
    .pip { width: 7px; height: 7px; border-radius: 50%; background: currentColor; }
    .pip { position: relative; }
.pip::after { content: ''; position: absolute; inset: 0; border-radius: 50%; background: currentColor; animation: ring-out 1.4s ease-out infinite; }
    @keyframes ring-out { from { transform: scale(1); opacity: 0.6; } to { transform: scale(2.7); opacity: 0; } }
    .cta { margin-top: 10px !important; font-size: 14px; font-weight: 500; }


    /* регистрация: бирюзовая рамка и свечение */
    .stage.registration { border-color: rgba(var(--accent-rgb), 0.55); box-shadow: 0 0 32px -8px var(--primary-glow), inset 0 0 40px -20px rgba(var(--accent-rgb), 0.35); }
    .stage.registration .num { -webkit-text-stroke-color: rgba(var(--accent-rgb), 0.55); }
    .stage.registration .cta { color: var(--primary); }

    /* идёт сейчас: красная рамка, пульсирующее свечение */
    .stage.qualifying, .stage.battles { border-color: var(--error); animation: live-glow 2.4s ease-in-out infinite; }
    .stage.qualifying .num, .stage.battles .num { -webkit-text-stroke-color: rgba(255, 92, 92, 0.6); }
    .stage.qualifying .cta, .stage.battles .cta { color: var(--error); }
    @keyframes live-glow { 50% { box-shadow: 0 0 36px -6px rgba(255, 92, 92, 0.55); } }

    /* завершён: приглушён, номер залит бирюзой */
    .stage.finished { opacity: 0.75; }
    .stage.finished:hover { opacity: 1; }
    .stage.finished .num { -webkit-text-stroke-color: rgba(var(--accent-rgb), 0.35); }

    @media (prefers-reduced-motion: reduce) {
      .pip, .stage.qualifying, .stage.battles { animation: none !important; }
    }
    .date { font-size: 13px; color: var(--ink-muted); }
    .winner { font-weight: 600; margin-top: 6px !important; }
    .finished h2 { color: var(--ink-muted); }
  `,
})
export class Stages implements OnInit {
  protected readonly seasons = signal<Season[]>([]);
  protected readonly season = signal<Season | null>(null);
  protected readonly stages = signal<StageRow[]>([]);
  protected readonly winners = signal<Record<number, string>>({});
  protected readonly loading = signal(true);
  /** первая загрузка — страница целиком скрыта до готовности данных */
  protected readonly ready = signal(false);
  private readonly lang = signal(inject(TranslocoService).getActiveLang());
  protected readonly title = (s: StageRow) => (this.lang() === 'en' && s.title_en ? s.title_en : s.title_ru);

  constructor() {
    inject(TranslocoService).langChanges$.subscribe((l) => this.lang.set(l));
  }

  async ngOnInit() {
    const list = await publicSeasons();
    this.seasons.set(list);
    const cur = list.find((s) => s.status === 'active') ?? list[0];
    if (cur) await this.pick(cur.id);
    this.loading.set(false);
    this.ready.set(true);
  }

  async pick(id: number) {
    this.loading.set(true);
    this.season.set(this.seasons().find((s) => s.id === id) ?? null);
    const { data } = await supabase.from('stages').select('id, ord, title_ru, title_en, track, starts_at, battles_at, status').eq('season_id', id).order('ord');
    const ids = (data ?? []).map((s) => s.id);
    const { data: w } = ids.length
      ? await supabase.from('stage_results').select('stage_id, pilot:profiles(nickname)').in('stage_id', ids).eq('stage_place', 1)
      : { data: [] };
    // показываем всё разом — без промежуточной «пустоты»
    this.stages.set(data ?? []);
    this.winners.set(Object.fromEntries(((w ?? []) as unknown as { stage_id: number; pilot: { nickname: string } | null }[]).map((r) => [r.stage_id, r.pilot?.nickname ?? ''])));
    this.loading.set(false);
  }
}
