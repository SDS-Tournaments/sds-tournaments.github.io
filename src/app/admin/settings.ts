import { Component, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { supabase } from '../auth';

// Настройки сайта (только организатор): Twitch, регламент RU/EN, вебхук Discord
@Component({
  selector: 'app-admin-settings',
  imports: [FormsModule, RouterLink],
  template: `
    <h1 class="display-md">Настройки</h1>
    <form class="stack" (ngSubmit)="save()">
      <section class="card stack">
        <h2 class="h">Трансляция</h2>
        <label class="field">
          <span class="lbl">Twitch-канал по умолчанию (если у этапа свой не указан)</span>
          <input class="input" name="tw" placeholder="sad_drift_series" [(ngModel)]="twitch" />
        </label>
      </section>

      <section class="card stack">
        <h2 class="h">Регламент</h2>
        <p class="muted small">
          Формат Markdown: <code>## Раздел</code> — заголовок раздела (попадает в оглавление), <code>### Подраздел</code>,
          <code>**жирный**</code>, списки через <code>- </code>, таблицы через <code>|</code>. Результат — на странице <a routerLink="/rules" target="_blank">Регламент</a>.
        </p>
        <label class="field narrow">
          <span class="lbl">Версия</span>
          <input class="input mono" name="ver" [(ngModel)]="version" />
        </label>
        <label class="field">
          <span class="lbl">Регламент (RU)</span>
          <textarea class="input mono doc" name="ru" rows="18" [(ngModel)]="ru"></textarea>
        </label>
        <label class="field">
          <span class="lbl">Регламент (EN, необязательно — иначе показывается RU)</span>
          <textarea class="input mono doc" name="en" rows="12" [(ngModel)]="en"></textarea>
        </label>
      </section>

      <section class="card stack">
        <h2 class="h">Discord</h2>
        <label class="field">
          <span class="lbl">Вебхук канала для оповещений (виден только организатору)</span>
          <input class="input mono" name="dc" type="url" placeholder="https://discord.com/api/webhooks/…" [(ngModel)]="discord" />
        </label>
        <div class="row">
          <button class="btn btn-secondary" type="button" (click)="testDiscord()" [disabled]="busy() || !discord.trim()">Отправить тестовое сообщение</button>
          @if (hookMsg()) { <span [class]="hookOk() ? 'ok' : 'bad'">{{ hookMsg() }}</span> }
        </div>
        <p class="muted small">Сначала сохраните вебхук. Сообщения приходят сами: открытие регистрации, старт этапа (квалификация), итоги этапа, новый протест.</p>
      </section>

      <div class="row">
        <button class="btn btn-primary" type="submit" [disabled]="busy()">Сохранить</button>
        @if (msg()) { <span [class]="ok() ? 'ok' : 'bad'">{{ msg() }}</span> }
      </div>
    </form>
  `,
  styles: `
    h1 { margin-bottom: 24px; }
    .stack { display: grid; gap: 16px; }
    form.stack { gap: 24px; }
    .h { font-size: 18px; }
    .field { display: grid; gap: 6px; }
    .narrow { max-width: 200px; }
    .lbl { font-size: 13px; color: var(--ink-muted); }
    .small { font-size: 13px; margin: 0; }
    code { font-family: var(--mono); color: var(--primary); }
    .doc { font-size: 13px; line-height: 1.6; resize: vertical; }
    .row { display: flex; gap: 12px; align-items: center; }
    .ok { color: var(--primary); }
    .bad { color: var(--error); }
  `,
})
export class AdminSettings implements OnInit {
  protected twitch = '';
  protected version = '';
  protected ru = '';
  protected en = '';
  protected discord = '';
  protected readonly busy = signal(false);
  protected readonly msg = signal<string | null>(null);
  protected readonly ok = signal(true);

  async ngOnInit() {
    const [s, p] = await Promise.all([
      supabase.from('app_settings').select('twitch_channel, regulation_ru, regulation_en, regulation_version').single(),
      supabase.from('private_settings').select('discord_webhook_url').maybeSingle(),
    ]);
    this.twitch = s.data?.twitch_channel ?? '';
    this.version = s.data?.regulation_version ?? '';
    this.ru = s.data?.regulation_ru ?? '';
    this.en = s.data?.regulation_en ?? '';
    this.discord = p.data?.discord_webhook_url ?? '';
  }

  protected readonly hookMsg = signal<string | null>(null);
  protected readonly hookOk = signal(true);

  /** проверка вебхука: функция отправляет в канал тестовое сообщение и говорит, что ответил Discord */
  async testDiscord() {
    this.busy.set(true);
    this.hookMsg.set(null);
    const { data, error } = await supabase.functions.invoke('discord-notify', { body: { type: 'test', id: 0 } });
    this.busy.set(false);
    const fail = error ? ((await error.context?.json?.().catch(() => null))?.error ?? error.message) : (data?.error ?? (data?.skipped ? 'Вебхук не сохранён — нажмите «Сохранить»' : null));
    this.hookOk.set(!fail);
    this.hookMsg.set(fail ?? 'Отправлено — проверьте канал в Discord');
  }

  async save() {
    this.busy.set(true);
    const nul = (v: string) => v.trim() || null;
    const [a, b] = await Promise.all([
      supabase.from('app_settings').update({ twitch_channel: nul(this.twitch), regulation_version: nul(this.version), regulation_ru: nul(this.ru), regulation_en: nul(this.en) }).eq('id', 1).select('id'),
      supabase.from('private_settings').update({ discord_webhook_url: nul(this.discord) }).eq('id', 1).select('id'),
    ]);
    this.busy.set(false);
    // RLS не даёт ошибку, а просто не обновляет строку — проверяем, что строка правда записалась
    const err = a.error?.message ?? b.error?.message ?? (!a.data?.length || !b.data?.length ? 'База не приняла изменения: сохранять настройки может только организатор (роль «Организатор»).' : null);
    this.msg.set(err ?? 'Сохранено');
    this.ok.set(!err);
  }
}
