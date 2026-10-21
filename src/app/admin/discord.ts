import { Component, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { supabase } from '../auth';

type Lang = 'ru' | 'en';

// Discord (только организатор): приглашение на сервер для подвала и вебхуки объявлений — русский и английский каналы
@Component({
  selector: 'app-admin-discord',
  imports: [FormsModule],
  template: `
    <h1 class="display-md">Discord</h1>
    <form class="stack" (ngSubmit)="save()">
      <section class="card stack">
        <h2 class="h">Сервер</h2>
        <label class="field">
          <span class="lbl">Приглашение на сервер — ссылка «Discord» в подвале сайта (пусто — ссылки нет)</span>
          <input class="input mono" name="inv" type="url" placeholder="https://discord.gg/…" [(ngModel)]="invite" />
        </label>
      </section>

      <section class="card stack">
        <h2 class="h">Объявления</h2>
        <p class="muted small">
          Сайт сам публикует: открытие регистрации, старт квалификации, старт парных заездов, итоги этапа. Каждое объявление уходит в оба канала —
          на своём языке. Новые протесты — только в русский канал (для штаба). Пустой вебхук — в этот канал не пишем.
        </p>
        @for (l of langs; track l.k) {
          <div class="hook">
            <label class="field">
              <span class="lbl">{{ l.label }}</span>
              <input class="input mono" [name]="'hook-' + l.k" type="url" placeholder="https://discord.com/api/webhooks/…" [(ngModel)]="hooks[l.k]" />
            </label>
            <div class="row">
              <button class="btn btn-secondary" type="button" (click)="test(l.k)" [disabled]="busy() || !hooks[l.k].trim()">Тестовое сообщение</button>
              @if (testMsg()[l.k]; as m) { <span [class]="m.ok ? 'ok' : 'bad'">{{ m.text }}</span> }
            </div>
          </div>
        }
        <p class="muted small">
          Вебхук: в Discord откройте канал → ⚙ Настройки канала → Интеграции → Вебхуки → Новый вебхук → «Копировать URL вебхука». Видят его только организаторы.
          Сначала сохраните, потом проверяйте.
        </p>
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
    .lbl { font-size: 13px; color: var(--ink-muted); }
    .small { font-size: 13px; margin: 0; }
    .hook { display: grid; gap: 10px; }
    .row { display: flex; gap: 12px; align-items: center; flex-wrap: wrap; }
    .ok { color: var(--primary); }
    .bad { color: var(--error); }
  `,
})
export class AdminDiscord implements OnInit {
  protected readonly langs: { k: Lang; label: string }[] = [
    { k: 'ru', label: 'Вебхук русского канала объявлений' },
    { k: 'en', label: 'Вебхук английского канала (для зарубежных пилотов)' },
  ];
  protected invite = '';
  protected hooks: Record<Lang, string> = { ru: '', en: '' };
  protected readonly busy = signal(false);
  protected readonly msg = signal<string | null>(null);
  protected readonly ok = signal(true);
  protected readonly testMsg = signal<Partial<Record<Lang, { ok: boolean; text: string }>>>({});

  async ngOnInit() {
    const [s, p] = await Promise.all([
      supabase.from('app_settings').select('discord_invite').single(),
      supabase.from('private_settings').select('discord_webhook_url, discord_webhook_en').maybeSingle(),
    ]);
    this.invite = s.data?.discord_invite ?? '';
    this.hooks = { ru: p.data?.discord_webhook_url ?? '', en: p.data?.discord_webhook_en ?? '' };
  }

  /** функция отправляет в канал тестовое сообщение и говорит, что ответил Discord */
  async test(lang: Lang) {
    this.busy.set(true);
    this.testMsg.update((m) => ({ ...m, [lang]: undefined }));
    const { data, error } = await supabase.functions.invoke('discord-notify', { body: { type: 'test', id: 0, lang } });
    this.busy.set(false);
    const fail = error ? ((await error.context?.json?.().catch(() => null))?.error ?? error.message) : (data?.error ?? (data?.skipped ? 'Вебхук не сохранён — нажмите «Сохранить»' : null));
    this.testMsg.update((m) => ({ ...m, [lang]: { ok: !fail, text: fail ?? 'Отправлено — проверьте канал в Discord' } }));
  }

  async save() {
    this.busy.set(true);
    const nul = (v: string) => v.trim() || null;
    const [a, b] = await Promise.all([
      supabase.from('app_settings').update({ discord_invite: nul(this.invite) }).eq('id', 1).select('id'),
      supabase.from('private_settings').update({ discord_webhook_url: nul(this.hooks.ru), discord_webhook_en: nul(this.hooks.en) }).eq('id', 1).select('id'),
    ]);
    this.busy.set(false);
    // RLS не даёт ошибку, а просто не обновляет строку — проверяем, что строка правда записалась
    const err = a.error?.message ?? b.error?.message ?? (!a.data?.length || !b.data?.length ? 'База не приняла изменения: сохранять может только организатор (роль «Организатор»).' : null);
    this.msg.set(err ?? 'Сохранено');
    this.ok.set(!err);
  }
}
