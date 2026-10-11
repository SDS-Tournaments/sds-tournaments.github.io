import { DatePipe } from '@angular/common';
import { Component, inject, input, OnInit, signal } from '@angular/core';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { supabase } from '../auth';
import { Loader } from './loader';

interface OpenStage {
  id: number;
  title_ru: string;
  title_en: string | null;
  track: string | null;
  starts_at: string | null;
  registrations: { profile_id: string; status: string }[];
}

// Регистрация пилота на этапы с открытой регистрацией
@Component({
  selector: 'app-stage-signup',
  imports: [TranslocoPipe, DatePipe, Loader],
  template: `
    <h2 class="h">{{ 'signup.title' | transloco }}</h2>
    @for (s of stages(); track s.id) {
      @let mine = isMine(s);
      <article class="stage" [class.in]="mine">
        <div class="info">
          <h3>{{ lang() === 'en' && s.title_en ? s.title_en : s.title_ru }}</h3>
          <p class="subtle meta">
            @if (s.track) { {{ s.track }} · }
            @if (s.starts_at) { <span class="mono">{{ s.starts_at | date: 'dd.MM.yyyy HH:mm' }}</span> · }
            {{ 'signup.count' | transloco: { n: count(s) } }}
          </p>
        </div>
        @if (mine) {
          <span class="badge">✓ {{ 'signup.in' | transloco }}</span>
          <button class="btn btn-ghost" (click)="set(s, 'withdrawn')" [disabled]="busy()">{{ 'signup.leave' | transloco }}</button>
        } @else {
          <button class="btn btn-primary" (click)="set(s, 'registered')" [disabled]="busy() || !hasNumber()">{{ 'signup.join' | transloco }}</button>
        }
      </article>
    } @empty {
      @if (loading()) { <app-loader [inline]="true" /> } @else { <p class="subtle">{{ 'signup.none' | transloco }}</p> }
    }
    @if (!hasNumber() && stages().length) { <p class="hint">{{ 'signup.needNumber' | transloco }}</p> }
    @if (error()) { <p class="bad">{{ error() }}</p> }
  `,
  styles: `
    :host { display: grid; gap: 12px; }
    .h { font-size: 20px; }
    .stage {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 12px;
      padding: 16px;
      border: 1px solid var(--hairline-strong);
      border-radius: var(--r-md);
      transition: border-color var(--base), box-shadow var(--base);
      &.in { border-color: var(--primary); box-shadow: 0 0 24px -12px var(--primary-glow); }
    }
    .info { flex: 1; min-width: 200px; }
    h3 { font-size: 16px; margin: 0 0 4px; }
    .meta { margin: 0; font-size: 13px; }
    .hint { color: var(--warning); font-size: 13px; margin: 0; }
    .bad { color: var(--error); font-size: 13px; margin: 0; }
  `,
})
export class StageSignup implements OnInit {
  readonly profileId = input.required<string>();
  readonly hasNumber = input(false);
  protected readonly stages = signal<OpenStage[]>([]);
  protected readonly busy = signal(false);
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  private readonly transloco = inject(TranslocoService);
  protected readonly lang = signal(this.transloco.getActiveLang());

  constructor() {
    this.transloco.langChanges$.subscribe((l) => this.lang.set(l));
  }

  ngOnInit() {
    this.load();
  }

  private async load() {
    const { data, error } = await supabase
      .from('stages')
      .select('id, title_ru, title_en, track, starts_at, registrations(profile_id, status)')
      .eq('status', 'registration')
      .order('starts_at');
    this.loading.set(false);
    if (error) return this.error.set(error.message);
    this.stages.set(data);
  }

  protected isMine(s: OpenStage) {
    return s.registrations.some((r) => r.profile_id === this.profileId() && r.status === 'registered');
  }

  protected count(s: OpenStage) {
    return s.registrations.filter((r) => r.status === 'registered').length;
  }

  async set(s: OpenStage, status: 'registered' | 'withdrawn') {
    this.busy.set(true);
    this.error.set(null);
    const row = { stage_id: s.id, profile_id: this.profileId() };
    // Снятие — update (место в группе освобождается); регистрация/повторная — upsert
    const { error } =
      status === 'withdrawn'
        ? await supabase.from('registrations').update({ status, group_no: null, queue_order: null }).match(row)
        : await supabase.from('registrations').upsert({ ...row, status });
    this.busy.set(false);
    if (error) return this.error.set(error.message);
    await this.load();
  }
}
