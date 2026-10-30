import { DestroyRef, effect, inject, Injectable, signal } from '@angular/core';
import { supabase } from './auth';

export interface LiveStage {
  id: number;
  ord: number;
  title_ru: string;
  title_en: string | null;
  status: 'qualifying' | 'battles';
}

/**
 * «Сайт живёт во время этапа»: знает идущий этап и подаёт сигнал на каждое событие эфира
 * (новая оценка, решение по дуэли). Классы на <html>: .live — этап идёт, .pulse — вспышка события.
 */
@Injectable({ providedIn: 'root' })
export class Live {
  readonly stage = signal<LiveStage | null>(null);
  private timer?: ReturnType<typeof setInterval>;
  private pulseTimer?: ReturnType<typeof setTimeout>;

  constructor() {
    const root = document.documentElement;
    effect(() => root.classList.toggle('live', !!this.stage()));
    inject(DestroyRef).onDestroy(() => clearInterval(this.timer));
  }

  /**
   * Без Realtime: постоянное подключение у каждого посетителя упиралось бы в лимит Supabase (200 на Free).
   * Идёт ли этап — опрос раз в минуту и при возврате на вкладку; вспышку на оценку/решение подаёт блок эфира (live-stage).
   */
  async start() {
    await this.load();
    this.timer = setInterval(() => document.visibilityState === 'visible' && this.load(), 60_000);
    document.addEventListener('visibilitychange', () => document.visibilityState === 'visible' && this.load());
  }

  private async load() {
    const { data } = await supabase.from('stages').select('id, ord, title_ru, title_en, status').in('status', ['qualifying', 'battles']).limit(1).maybeSingle();
    this.stage.set(data as LiveStage | null);
  }

  pulse() {
    if (!this.stage()) return;
    const root = document.documentElement;
    root.classList.remove('pulse');
    void root.offsetWidth; // перезапуск анимации, если события идут подряд
    root.classList.add('pulse');
    clearTimeout(this.pulseTimer);
    this.pulseTimer = setTimeout(() => root.classList.remove('pulse'), 1600);
  }
}
