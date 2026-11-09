import { Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { Auth, supabase } from '../auth';
import { SLOW_POLL_MS } from '../lite';

interface Stage {
  id: number;
  title_ru: string;
  title_en: string | null;
  starts_at: string | null;
  checkin_closed: boolean;
}
const HOUR = 3_600_000;

// Плашка записавшемуся пилоту за час до квалификации: «Я буду». Зрителям и незаписанным — ни одного лишнего запроса после первого.
@Component({
  selector: 'app-checkin-banner',
  imports: [TranslocoPipe],
  template: `
    @if (stage(); as s) {
      <div class="box" [class.ok]="done()" role="status">
        @if (done()) {
          <p class="t">✓ {{ 'checkin.done' | transloco: { stage: name() } }}</p>
          <button type="button" class="btn btn-ghost" (click)="set(false)" [disabled]="busy()">{{ 'checkin.cancel' | transloco }}</button>
        } @else {
          <div>
            <p class="t">{{ 'checkin.title' | transloco: { stage: name() } }}</p>
            <p class="d">{{ 'checkin.text' | transloco }}</p>
          </div>
          <button type="button" class="btn btn-primary" (click)="set(true)" [disabled]="busy()">{{ 'checkin.yes' | transloco }}</button>
        }
        @if (failed()) { <p class="bad">{{ 'checkin.error' | transloco }}</p> }
      </div>
    }
  `,
  styles: `
    /* внизу экрана: шапка фиксированная и закрыла бы плашку наверху, а так она видна на любой странице при любой прокрутке */
    .box { position: fixed; z-index: 90; left: 16px; right: 16px; bottom: 16px; max-width: 680px; margin-inline: auto; display: flex; flex-wrap: wrap; gap: 12px 20px; align-items: center; justify-content: space-between; padding: 14px 18px; border-radius: var(--r-md);
      border: 1px solid var(--warning); background: color-mix(in srgb, var(--warning) 14%, var(--surface-1)); box-shadow: 0 12px 40px rgba(0, 0, 0, 0.6); }
    .box.ok { border-color: var(--primary); background: var(--primary-soft); }
    .box > div { flex: 1 1 280px; }
    .t { margin: 0; font-weight: 600; color: var(--ink); }
    .d { margin: 2px 0 0; font-size: 14px; color: var(--ink-muted); }
    .bad { flex-basis: 100%; margin: 0; font-size: 14px; color: var(--error); }
  `,
})
export class CheckinBanner {
  private readonly auth = inject(Auth);
  private readonly t = inject(TranslocoService);
  private readonly lang = toSignal(this.t.langChanges$, { initialValue: this.t.getActiveLang() });
  private readonly uid = computed(() => this.auth.profile()?.id ?? null);
  /** этап, у которого подтверждение открыто прямо сейчас */
  protected readonly stage = signal<Stage | null>(null);
  protected readonly name = computed(() => {
    const s = this.stage();
    return (this.lang() === 'en' && s?.title_en) || s?.title_ru || '';
  });
  protected readonly done = signal(false);
  protected readonly busy = signal(false);
  protected readonly failed = signal(false);
  private timer?: ReturnType<typeof setTimeout>;

  constructor() {
    effect((onCleanup) => {
      const id = this.uid();
      untracked(() => {
        this.stage.set(null);
        if (id) this.load(id);
      });
      onCleanup(() => clearTimeout(this.timer));
    });
  }

  private later(id: string, ms: number) {
    clearTimeout(this.timer);
    this.timer = setTimeout(() => this.load(id), ms);
  }

  private async load(id: string) {
    const poll = SLOW_POLL_MS * (0.8 + Math.random() * 0.4);
    if (document.visibilityState === 'hidden') return this.later(id, poll);
    const { data } = await supabase
      .from('registrations')
      .select('stage:stages!inner(id, title_ru, title_en, starts_at, status, checkin_closed)')
      .eq('profile_id', id)
      .eq('status', 'registered')
      .eq('stage.status', 'registration');
    if (!data) return this.later(id, poll);
    const s = (data as unknown as { stage: Stage }[])
      .map((r) => r.stage)
      .filter((x) => x.starts_at && !x.checkin_closed)
      .sort((a, b) => a.starts_at!.localeCompare(b.starts_at!))[0];
    if (!s) return this.stage.set(null);
    const wait = Date.parse(s.starts_at!) - HOUR - Date.now();
    if (wait > 0) {
      this.stage.set(null);
      // разброс до минуты: открытые вкладки не приходят в базу в одну секунду
      return this.later(id, Math.min(wait + Math.random() * 60_000, 6 * HOUR));
    }
    const { data: mine } = await supabase.from('stage_checkins').select('stage_id').eq('stage_id', s.id).eq('profile_id', id).maybeSingle();
    this.done.set(!!mine);
    this.stage.set(s);
    this.later(id, poll);
  }

  protected async set(yes: boolean) {
    const s = this.stage();
    const profile_id = this.uid();
    if (!s || !profile_id) return;
    this.busy.set(true);
    this.failed.set(false);
    const row = { stage_id: s.id, profile_id };
    const { error } = yes ? await supabase.from('stage_checkins').insert(row) : await supabase.from('stage_checkins').delete().match(row);
    this.busy.set(false);
    if (error) return this.failed.set(true);
    this.done.set(yes);
  }
}
