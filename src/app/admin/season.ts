import { Component, inject, input, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { supabase } from '../auth';
import { PointsTable } from '../scoring/scoring';
import { SEASON_STATUS, STAGE_STATUS } from './labels';

interface Season {
  id: number;
  number: number;
  title: string;
  status: string;
  team_counted: number;
  qual_points: PointsTable['qual'];
  battle_points: Record<string, number>;
}
interface StageRow {
  id: number;
  ord: number;
  title_ru: string;
  track: string | null;
  starts_at: string | null;
  status: string;
}

const BATTLE_KEYS = [
  { key: '1', label: '1 место' },
  { key: '2', label: '2 место' },
  { key: '3', label: '3 место' },
  { key: '4', label: '4 место' },
  { key: '8', label: '5–8 места' },
  { key: '16', label: '9–16 места' },
];

@Component({
  selector: 'app-admin-season',
  imports: [FormsModule, RouterLink],
  template: `
    <a routerLink="/admin/seasons" class="back">← Все сезоны</a>
    @if (s(); as s) {
      <header class="top">
        <h1 class="display-md">{{ s.title }}</h1>
        <span class="badge" [class.off]="s.status !== 'active'">{{ seasonStatus[s.status] }}</span>
      </header>

      <form class="card stack" (ngSubmit)="save()">
        <div class="cols">
          <label class="field"><span class="lbl">Название</span><input class="input" name="title" [(ngModel)]="s.title" required /></label>
          <label class="field">
            <span class="lbl">Статус</span>
            <select class="input" name="status" [(ngModel)]="s.status">
              @for (k of statusKeys; track k) { <option [value]="k">{{ seasonStatus[k] }}</option> }
            </select>
          </label>
          <label class="field">
            <span class="lbl">Пилотов команды в зачёт</span>
            <input class="input mono" type="number" min="1" max="8" name="tc" [(ngModel)]="s.team_counted" />
          </label>
        </div>

        <details class="points">
          <summary>Таблицы очков <span class="subtle">(по умолчанию RDS GP 2024)</span></summary>
          <h3>Квалификация</h3>
          <div class="pgrid">
            @for (p of s.qual_points.places; track $index) {
              <label class="field"><span class="lbl">{{ $index + 1 }} место</span>
                <input class="input mono" type="number" min="0" [name]="'q' + $index" [(ngModel)]="s.qual_points.places[$index]" /></label>
            }
            <label class="field"><span class="lbl">17–32</span><input class="input mono" type="number" min="0" name="to32" [(ngModel)]="s.qual_points.to32" /></label>
            <label class="field"><span class="lbl">33 и ниже</span><input class="input mono" type="number" min="0" name="rest" [(ngModel)]="s.qual_points.rest" /></label>
          </div>
          <h3>Парные заезды</h3>
          <div class="pgrid">
            @for (b of battleKeys; track b.key) {
              <label class="field"><span class="lbl">{{ b.label }}</span>
                <input class="input mono" type="number" min="0" [name]="'b' + b.key" [(ngModel)]="s.battle_points[b.key]" /></label>
            }
          </div>
        </details>

        <div class="row">
          <button class="btn btn-primary" type="submit" [disabled]="busy()">Сохранить</button>
          @if (msg()) { <span [class]="msgOk() ? 'ok' : 'bad'">{{ msg() }}</span> }
        </div>
      </form>

      <header class="top stages-top">
        <h2 class="display-md">Этапы</h2>
        <button class="btn btn-primary" (click)="addStage()" [disabled]="busy()">+ Добавить этап</button>
      </header>
      <div class="table-wrap card flush">
        <table class="table">
          <thead><tr><th>№</th><th>Название</th><th>Трасса</th><th>Дата</th><th>Статус</th></tr></thead>
          <tbody>
            @for (st of stages(); track st.id) {
              <tr class="link" [routerLink]="['/admin/stages', st.id]">
                <td class="mono">{{ st.ord }}</td>
                <td>{{ st.title_ru }}</td>
                <td class="muted">{{ st.track ?? '—' }}</td>
                <td class="mono muted">{{ st.starts_at ? fmt(st.starts_at) : '—' }}</td>
                <td><span class="badge" [class.off]="st.status === 'draft' || st.status === 'finished'">{{ stageStatus[st.status] }}</span></td>
              </tr>
            } @empty {
              <tr><td colspan="5" class="subtle">Этапов пока нет.</td></tr>
            }
          </tbody>
        </table>
      </div>
    } @else if (msg()) {
      <p class="bad">{{ msg() }}</p>
    }
  `,
  styles: `
    .back { display: inline-block; margin-bottom: 16px; font-size: 14px; }
    .top { display: flex; flex-wrap: wrap; gap: 16px; align-items: center; justify-content: space-between; margin-bottom: 24px; }
    .stages-top { margin-top: 48px; }
    .stack { display: grid; gap: 20px; }
    .cols { display: grid; gap: 16px; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); }
    .field { display: grid; gap: 6px; }
    .lbl { font-size: 13px; color: var(--ink-muted); }
    .points summary { cursor: pointer; font-weight: 500; }
    .points h3 { font-size: 14px; margin: 20px 0 10px; color: var(--ink-muted); font-weight: 500; }
    .pgrid { display: grid; gap: 10px; grid-template-columns: repeat(auto-fill, minmax(96px, 1fr)); }
    .row { display: flex; gap: 12px; align-items: center; flex-wrap: wrap; }
    .flush { padding: 0; overflow: hidden; }
    .link { cursor: pointer; }
    .badge.off { background: var(--surface-3); color: var(--ink-muted); }
    .ok { color: var(--primary); }
    .bad { color: var(--error); }
  `,
})
export class AdminSeason implements OnInit {
  readonly id = input.required<string>();
  protected readonly s = signal<Season | null>(null);
  protected readonly stages = signal<StageRow[]>([]);
  protected readonly busy = signal(false);
  protected readonly msg = signal<string | null>(null);
  protected readonly msgOk = signal(false);
  protected readonly seasonStatus = SEASON_STATUS;
  protected readonly stageStatus = STAGE_STATUS;
  protected readonly statusKeys = Object.keys(SEASON_STATUS);
  protected readonly battleKeys = BATTLE_KEYS;
  private readonly router = inject(Router);

  async ngOnInit() {
    const [season, stages] = await Promise.all([
      supabase.from('seasons').select('id, number, title, status, team_counted, qual_points, battle_points').eq('id', this.id()).single(),
      supabase.from('stages').select('id, ord, title_ru, track, starts_at, status').eq('season_id', this.id()).order('ord'),
    ]);
    if (season.error) return this.note(season.error.message, false);
    this.s.set(season.data);
    this.stages.set(stages.data ?? []);
  }

  async save() {
    const s = this.s();
    if (!s) return;
    this.busy.set(true);
    const { error } = await supabase
      .from('seasons')
      .update({ title: s.title, status: s.status, team_counted: s.team_counted, qual_points: s.qual_points, battle_points: s.battle_points })
      .eq('id', s.id);
    this.busy.set(false);
    // 23505 на one_active_season — уже есть другой активный сезон
    if (error) return this.note(error.code === '23505' ? 'Уже есть активный сезон — сначала завершите его.' : error.message, false);
    this.s.set({ ...s });
    this.note('Сохранено', true);
  }

  async addStage() {
    const s = this.s();
    if (!s) return;
    this.busy.set(true);
    const ord = (this.stages().at(-1)?.ord ?? 0) + 1;
    const { data, error } = await supabase.from('stages').insert({ season_id: s.id, ord, title_ru: `Этап ${ord}`, title_en: `Round ${ord}` }).select('id').single();
    this.busy.set(false);
    if (error) return this.note(error.message, false);
    this.router.navigate(['/admin/stages', data.id]);
  }

  protected fmt(iso: string) {
    return new Date(iso).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  }

  private note(text: string, ok: boolean) {
    this.msg.set(text);
    this.msgOk.set(ok);
  }
}
