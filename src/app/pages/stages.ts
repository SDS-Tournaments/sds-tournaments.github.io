import { DatePipe } from '@angular/common';
import { Component, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { supabase } from '../auth';
import { Skeleton } from '../components/skeleton';
import { publicSeasons, Season } from '../data/standings';

interface StageRow {
  id: number;
  ord: number;
  title_ru: string;
  title_en: string | null;
  track: string | null;
  starts_at: string | null;
  status: string;
}

// Этапы сезона: карточки со статусом и победителем
@Component({
  selector: 'app-stages',
  imports: [FormsModule, RouterLink, TranslocoPipe, DatePipe, Skeleton],
  template: `
    <section class="section container">
      <header class="top">
        <div>
          <p class="eyebrow rise">{{ season()?.title }}</p>
          <h1 class="display-lg rise" style="--i: 1">{{ 'nav.stages' | transloco }}</h1>
        </div>
        @if (seasons().length > 1) {
          <select class="input season" [ngModel]="season()?.id" (ngModelChange)="pick($event)">
            @for (s of seasons(); track s.id) { <option [ngValue]="s.id">{{ s.title }}</option> }
          </select>
        }
      </header>

      @if (loading()) {
        <app-skeleton variant="cards" [count]="4" />
      } @else {
      <div class="grid">
        @for (s of stages(); track s.id; let i = $index) {
          <a class="card card-hover stage rise" [class]="s.status" [routerLink]="['/stages', s.id]" [style.--i]="i">
            <span class="num mono">{{ s.ord < 10 ? '0' + s.ord : s.ord }}</span>
            <span class="badge" [class]="'st-' + s.status">
              @if (s.status === 'qualifying' || s.status === 'battles') { ● }
              {{ 'stage.status.' + s.status | transloco }}
            </span>
            <h2>{{ title(s) }}</h2>
            <p class="subtle">{{ s.track ?? '' }}</p>
            <p class="mono date">{{ s.starts_at ? (s.starts_at | date: 'dd.MM.yyyy · HH:mm') : ('road.soon' | transloco) }}</p>
            @if (winners()[s.id]; as w) { <p class="winner">🏆 {{ w }}</p> }
          </a>
        } @empty {
          <p class="subtle">{{ 'stages.empty' | transloco }}</p>
        }
      </div>
      }
    </section>
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
    .st-draft, .st-finished { background: var(--surface-3); color: var(--ink-muted); }
    .st-qualifying, .st-battles { background: rgba(255, 92, 92, 0.15); color: var(--error); }
    .date { font-size: 13px; color: var(--ink-muted); }
    .winner { font-weight: 600; margin-top: 6px !important; }
    .finished h2 { color: var(--ink-muted); }
    .qualifying, .battles { border-color: var(--error); }
  `,
})
export class Stages implements OnInit {
  protected readonly seasons = signal<Season[]>([]);
  protected readonly season = signal<Season | null>(null);
  protected readonly stages = signal<StageRow[]>([]);
  protected readonly winners = signal<Record<number, string>>({});
  protected readonly loading = signal(true);
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
    else this.loading.set(false);
  }

  async pick(id: number) {
    this.loading.set(true);
    this.season.set(this.seasons().find((s) => s.id === id) ?? null);
    const { data } = await supabase.from('stages').select('id, ord, title_ru, title_en, track, starts_at, status').eq('season_id', id).order('ord');
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
