import { DestroyRef, effect, inject, Injectable, signal } from '@angular/core';
import { RealtimeChannel } from '@supabase/supabase-js';
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
  private channel?: RealtimeChannel;
  private pulseTimer?: ReturnType<typeof setTimeout>;

  constructor() {
    const root = document.documentElement;
    effect(() => root.classList.toggle('live', !!this.stage()));
    inject(DestroyRef).onDestroy(() => this.channel && supabase.removeChannel(this.channel));
  }

  async start() {
    await this.load();
    this.channel = supabase
      .channel('site-live')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'stages' }, () => this.load())
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'qual_runs' }, () => this.pulse())
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'battles' }, (e) => {
        // вспышка только на решение судей, не на рассадку пар
        if ((e.new as { status?: string }).status === 'done') this.pulse();
      })
      .subscribe();
  }

  private async load() {
    const { data } = await supabase.from('stages').select('id, ord, title_ru, title_en, status').in('status', ['qualifying', 'battles']).limit(1).maybeSingle();
    this.stage.set(data as LiveStage | null);
  }

  private pulse() {
    if (!this.stage()) return;
    const root = document.documentElement;
    root.classList.remove('pulse');
    void root.offsetWidth; // перезапуск анимации, если события идут подряд
    root.classList.add('pulse');
    clearTimeout(this.pulseTimer);
    this.pulseTimer = setTimeout(() => root.classList.remove('pulse'), 1600);
  }
}
