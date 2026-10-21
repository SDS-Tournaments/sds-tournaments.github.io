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
          <!-- билет этапа: сверху статус, название и дни; по линии отрыва — корешок с номером этапа -->
          <a class="tk-wrap" [class]="s.status" [routerLink]="['/stages', s.id]">
            <div class="tk">
              <div class="main">
                <span class="badge" [class]="'st-' + s.status">
                  @if (s.status === 'qualifying' || s.status === 'battles' || s.status === 'registration') { <i class="pip"></i> }
                  @if (s.status === 'finished') { ✓ }
                  {{ 'stage.status.' + s.status | transloco }}
                </span>
                <h2>{{ title(s) }}</h2>
                <p class="subtle track">{{ s.track ?? '' }}</p>
                @if (s.starts_at) {
                  <div class="days mono">
                    <span><small>{{ 'stage.qualShort' | transloco }}</small>{{ s.starts_at | date: 'dd.MM · HH:mm' }}</span>
                    @if (s.battles_at) { <span><small>{{ 'stage.battlesShort' | transloco }}</small>{{ s.battles_at | date: 'dd.MM · HH:mm' }}</span> }
                  </div>
                } @else {
                  <p class="mono date">{{ 'road.soon' | transloco }}</p>
                }
                @if (winners()[s.id]; as w) { <p class="winner">🏆 {{ w }}</p> }
              </div>
              <div class="stub">
                <span class="no"><small>{{ 'stages.round' | transloco }}</small><b class="mono">{{ s.ord < 10 ? '0' + s.ord : s.ord }}</b></span>
                @if (s.status === 'registration') {
                  <span class="cta">{{ 'stages.regOpen' | transloco }} →</span>
                } @else if (s.status === 'qualifying' || s.status === 'battles') {
                  <span class="cta">{{ 'home.next.watch' | transloco }} →</span>
                } @else {
                  <i class="code" aria-hidden="true"></i>
                }
              </div>
            </div>
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
    /* ── билет этапа ── */
    /* обёртка даёт свечение по форме билета (drop-shadow повторяет вырезы), сам билет обрезан маской */
    .tk-wrap { display: grid; color: var(--ink); text-decoration: none; transition: translate var(--base), filter var(--base); }
    /* общий стиль ссылок (бирюзовый текст и линия-подчёркивание снизу) билету не нужен */
    .tk-wrap, .tk-wrap:hover { color: var(--ink); background: none; }
    .tk-wrap:hover { translate: 0 -3px; }
    .tk {
      --stub: 68px;
      display: grid; grid-template-rows: 1fr var(--stub);
      border: 1px solid var(--hairline); border-radius: var(--r-lg);
      background: linear-gradient(160deg, rgba(var(--accent-rgb), 0.04), transparent 50%), var(--surface-1);
      -webkit-mask: radial-gradient(circle 12px at 0 calc(100% - var(--stub)), #0000 98%, #000) left / 51% 100% no-repeat,
        radial-gradient(circle 12px at 100% calc(100% - var(--stub)), #0000 98%, #000) right / 51% 100% no-repeat;
      mask: radial-gradient(circle 12px at 0 calc(100% - var(--stub)), #0000 98%, #000) left / 51% 100% no-repeat,
        radial-gradient(circle 12px at 100% calc(100% - var(--stub)), #0000 98%, #000) right / 51% 100% no-repeat;
    }
    .tk-wrap:hover .tk { border-color: var(--hairline-strong); }
    .main { display: grid; gap: 6px; align-content: start; padding: 22px 22px 18px; }
    .main p { margin: 0; }
    .main h2 { font-size: 22px; margin: 8px 0 0; }
    .track { font-size: 14px; }
    .days { display: grid; gap: 4px; margin-top: 8px; font-size: 13px; }
    .days small { display: inline-block; min-width: 52px; margin-right: 6px; font-family: var(--font); font-size: 10px; letter-spacing: 1px; text-transform: uppercase; color: var(--ink-subtle); }
    .date { font-size: 13px; color: var(--ink-muted); margin-top: 8px !important; }
    .winner { font-weight: 600; margin-top: 8px !important; }
    /* корешок: пунктир отрыва между вырезами, номер этапа и штрихкод */
    .stub { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin: 0 16px; padding: 0 6px; border-top: 2px dashed var(--hairline-strong); }
    .no { display: grid; line-height: 1; }
    .no small { font-size: 10px; letter-spacing: 2px; text-transform: uppercase; color: var(--ink-subtle); }
    .no b { margin-top: 4px; font-size: 26px; font-weight: 500; color: var(--ink-muted); }
    .code {
      width: 78px; height: 24px; opacity: 0.35;
      background: repeating-linear-gradient(90deg, var(--ink) 0 2px, transparent 2px 4px, var(--ink) 4px 5px, transparent 5px 8px, var(--ink) 8px 11px, transparent 11px 12px);
    }
    .cta { font-size: 13px; font-weight: 500; text-align: right; }

    .badge { justify-self: start; display: inline-flex; align-items: center; gap: 6px; }
    .st-draft, .st-finished { background: var(--surface-3); color: var(--ink-muted); }
    .st-registration { background: rgba(var(--accent-rgb), 0.15); color: var(--primary); }
    .st-qualifying, .st-battles { background: rgba(255, 92, 92, 0.15); color: var(--error); }
    .pip { position: relative; width: 7px; height: 7px; border-radius: 50%; background: currentColor; }
    .pip::after { content: ''; position: absolute; inset: 0; border-radius: 50%; background: currentColor; animation: ring-out 1.4s ease-out infinite; }
    @keyframes ring-out { from { transform: scale(1); opacity: 0.6; } to { transform: scale(2.7); opacity: 0; } }

    /* регистрация: бирюзовая рамка, подсветка и свечение по контуру билета */
    .registration { filter: drop-shadow(0 0 16px rgba(var(--accent-rgb), 0.3)); }
    .registration .tk { border-color: rgba(var(--accent-rgb), 0.55); background: linear-gradient(160deg, rgba(var(--accent-rgb), 0.14), transparent 60%), var(--surface-1); }
    .registration .no b, .registration .cta { color: var(--primary); }

    /* идёт сейчас: красная рамка, пульсирующее свечение */
    .qualifying .tk, .battles .tk { border-color: var(--error); }
    .qualifying, .battles { animation: live-glow 2.4s ease-in-out infinite; }
    .qualifying .no b, .battles .no b, .qualifying .cta, .battles .cta { color: var(--error); }
    @keyframes live-glow { 0%, 100% { filter: drop-shadow(0 0 6px rgba(255, 92, 92, 0.2)); } 50% { filter: drop-shadow(0 0 20px rgba(255, 92, 92, 0.55)); } }

    /* завершён: приглушён, номер бирюзовый */
    .finished { opacity: 0.75; }
    .finished:hover { opacity: 1; }
    .finished h2 { color: var(--ink-muted); }
    .finished .no b { color: rgba(var(--accent-rgb), 0.7); }

    @media (prefers-reduced-motion: reduce) {
      .pip::after, .qualifying, .battles { animation: none !important; }
      .tk-wrap:hover { translate: none; }
    }
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
