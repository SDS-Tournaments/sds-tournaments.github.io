import { Component, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from '../auth';

// Колокольчик протестов для организатора/судей: счётчик + всплывающее уведомление о новом протесте
@Component({
  selector: 'app-protest-bell',
  imports: [RouterLink],
  template: `
    <a routerLink="/admin/protests" class="bell" [class.hot]="count() > 0" [attr.aria-label]="'Протесты на рассмотрении: ' + count()">
      <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="M12 3a6 6 0 0 0-6 6v4l-2 3h16l-2-3V9a6 6 0 0 0-6-6zm0 18a2.5 2.5 0 0 0 2.4-2h-4.8A2.5 2.5 0 0 0 12 21z" fill="currentColor" /></svg>
      @if (count()) { <span class="n mono">{{ count() }}</span> }
    </a>
    @if (toast(); as t) {
      <a routerLink="/admin/protests" class="toast" role="alert" (click)="toast.set(null)">
        <b>⚠ Новый протест</b>
        <span>{{ t }}</span>
        <span class="go">Рассмотреть →</span>
      </a>
    }
  `,
  styles: `
    :host { position: relative; display: flex; }
    .bell { position: relative; display: grid; place-items: center; width: 40px; height: 40px; border-radius: 50%; color: var(--ink-muted); background: none; }
    .bell:hover { color: var(--ink); background: var(--surface-1); }
    .bell.hot { color: var(--warning); }
    .n { position: absolute; top: 2px; right: 0; min-width: 18px; height: 18px; padding: 0 4px; border-radius: 9px; background: var(--warning); color: #000; font-size: 11px; line-height: 18px; text-align: center; }
    .toast {
      position: fixed; right: 24px; bottom: 24px; z-index: 100; display: grid; gap: 4px; width: min(360px, calc(100vw - 32px));
      padding: 16px 20px; border: 1px solid var(--warning); border-radius: var(--r-lg); background: rgba(10, 10, 10, 0.95);
      color: var(--ink); box-shadow: 0 16px 48px rgba(0, 0, 0, 0.6), 0 0 32px -12px var(--warning); backdrop-filter: blur(10px);
      animation: in 400ms var(--ease-out);
    }
    .toast b { color: var(--warning); }
    .go { color: var(--primary); font-size: 14px; }
    @keyframes in { from { opacity: 0; transform: translateY(16px); } }
  `,
})
export class ProtestBell implements OnInit {
  protected readonly count = signal(0);
  protected readonly toast = signal<string | null>(null);
  private channel?: RealtimeChannel;
  private toastTimer?: ReturnType<typeof setTimeout>;

  constructor() {
    inject(DestroyRef).onDestroy(() => {
      clearTimeout(this.toastTimer);
      if (this.channel) supabase.removeChannel(this.channel);
    });
  }

  async ngOnInit() {
    await this.refresh();
    this.channel = supabase
      .channel('protest-bell')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'protests' }, (e) => this.onNew(e.new as { profile_id: string }))
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'protests' }, () => this.refresh())
      .subscribe();
  }

  private async refresh() {
    const { count } = await supabase.from('protests').select('id', { count: 'exact', head: true }).eq('status', 'pending');
    this.count.set(count ?? 0);
  }

  private async onNew(p: { profile_id: string }) {
    await this.refresh();
    const { data } = await supabase.from('profiles').select('nickname').eq('id', p.profile_id).single();
    this.toast.set(`${data?.nickname ?? 'Пилот'} оспаривает решение судей`);
    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => this.toast.set(null), 15_000);
  }
}
