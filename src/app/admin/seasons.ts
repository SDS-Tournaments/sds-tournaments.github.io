import { Component, inject, OnInit, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { supabase } from '../auth';
import { SEASON_STATUS } from './labels';

interface SeasonRow {
  id: number;
  number: number;
  title: string;
  status: string;
  stages: { count: number }[];
}

@Component({
  selector: 'app-admin-seasons',
  imports: [RouterLink],
  template: `
    <header class="top">
      <h1 class="display-md">Сезоны</h1>
      <button class="btn btn-primary" (click)="create()" [disabled]="busy()">+ Новый сезон</button>
    </header>
    @if (error()) { <p class="bad">{{ error() }}</p> }

    <div class="table-wrap card flush">
      <table class="table">
        <thead><tr><th>№</th><th>Название</th><th>Этапов</th><th>Статус</th></tr></thead>
        <tbody>
          @for (s of seasons(); track s.id) {
            <tr class="link" [routerLink]="['/admin/seasons', s.id]">
              <td class="mono">{{ s.number }}</td>
              <td>{{ s.title }}</td>
              <td class="mono">{{ s.stages[0]?.count ?? 0 }}</td>
              <td><span class="badge" [class.off]="s.status !== 'active'">{{ status[s.status] }}</span></td>
            </tr>
          } @empty {
            <tr><td colspan="4" class="subtle">Сезонов пока нет — создайте первый.</td></tr>
          }
        </tbody>
      </table>
    </div>
  `,
  styles: `
    .top { display: flex; flex-wrap: wrap; gap: 16px; align-items: center; justify-content: space-between; margin-bottom: 24px; }
    .flush { padding: 0; overflow: hidden; }
    .link { cursor: pointer; }
    .badge.off { background: var(--surface-3); color: var(--ink-muted); }
    .bad { color: var(--error); }
  `,
})
export class AdminSeasons implements OnInit {
  protected readonly seasons = signal<SeasonRow[]>([]);
  protected readonly busy = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly status = SEASON_STATUS;
  private readonly router = inject(Router);

  async ngOnInit() {
    const { data, error } = await supabase.from('seasons').select('id, number, title, status, stages(count)').order('number', { ascending: false });
    if (error) return this.error.set(error.message);
    this.seasons.set(data as SeasonRow[]);
  }

  async create() {
    this.busy.set(true);
    const next = (this.seasons()[0]?.number ?? 0) + 1;
    const { data, error } = await supabase.from('seasons').insert({ number: next, title: `Сезон ${next}` }).select('id').single();
    this.busy.set(false);
    if (error) return this.error.set(error.message);
    this.router.navigate(['/admin/seasons', data.id]);
  }
}
