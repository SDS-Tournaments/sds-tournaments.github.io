import { Component, OnInit, signal } from '@angular/core';
import { STAGE_STATUS } from './labels';
import { FormsModule } from '@angular/forms';
import { supabase } from '../auth';

type Lang = 'ru' | 'en' | 'test';
type Stage = { id: number; title_ru: string; status: string };
/** что прогоняем в тестовый канал — все объявления сайта */
const RUN_ALL: { type: string; label: string }[] = [
  { type: 'registration', label: 'Открыта регистрация' },
  { type: 'stage_start', label: 'LIVE — этап начался' },
  { type: 'groups', label: 'Группа едет / готовится' },
  { type: 'battles_start', label: 'LIVE — парные заезды' },
  { type: 'results', label: 'Итоги этапа' },
  { type: 'protest', label: 'Новый протест (последний по времени)' },
];

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

      <section class="card stack test">
        <h2 class="h">🧪 Тестовый канал</h2>
        <p class="muted small">Сюда можно прогнать все объявления и посмотреть, как они выглядят, не трогая настоящие каналы. Сообщения помечены «🧪 ТЕСТ · RU/EN», оба языка идут подряд.</p>
        <label class="field">
          <span class="lbl">Вебхук тестового канала</span>
          <input class="input mono" name="hook-test" type="url" placeholder="https://discord.com/api/webhooks/…" [(ngModel)]="hooks.test" />
        </label>
        <label class="chk">
          <input type="checkbox" name="testMode" [(ngModel)]="testMode" />
          <span><b>Тестовый режим</b> — пока включено, <u>всё</u>, что сайт шлёт в Discord (старт этапа, группы, итоги, протесты), уходит только в тестовый канал. Не забудьте выключить перед настоящим этапом.</span>
        </label>
        @if (testMode) { <p class="warn small">⚠ Тестовый режим включён — в настоящие каналы ничего не уходит.</p> }
        <div class="row">
          <button class="btn btn-secondary" type="button" (click)="test('test')" [disabled]="busy() || !hooks.test.trim()">Тестовое сообщение</button>
          @if (testMsg()['test']; as m) { <span [class]="m.ok ? 'ok' : 'bad'">{{ m.text }}</span> }
        </div>
        <div class="runall">
          <label class="field">
            <span class="lbl">Прогнать все объявления по этапу</span>
            <select class="input" name="stage" [(ngModel)]="stageId">
              @for (s of stages(); track s.id) { <option [ngValue]="s.id">{{ s.title_ru }} · {{ statusLabel[s.status] ?? s.status }}</option> }
            </select>
          </label>
          <button class="btn btn-primary" type="button" (click)="runAll()" [disabled]="busy() || !stageId || !hooks.test.trim()">▶ Прогнать все сообщения</button>
        </div>
        @if (runLog().length) {
          <ul class="log">
            @for (r of runLog(); track r.label) { <li [class]="r.state"><span>{{ r.state === 'ok' ? '✓' : r.state === 'skip' ? '—' : r.state === 'bad' ? '✕' : '…' }}</span> {{ r.label }}@if (r.note) { <span class="subtle"> — {{ r.note }}</span> }</li> }
          </ul>
        }
        <p class="muted small">Сначала сохраните вебхук. «Группа едет» придёт, только если на этапе есть группы и квала не проехана; «Итоги» — с подиумом, если этап подведён.</p>
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
    .chk { display: flex; gap: 10px; align-items: flex-start; font-size: 14px; cursor: pointer; input { margin-top: 3px; accent-color: var(--warning); } }
    .warn { color: var(--warning); }
    .test { border-style: dashed; }
    .runall { display: flex; gap: 12px; align-items: end; flex-wrap: wrap; .field { flex: 1; min-width: 220px; } }
    .log { list-style: none; margin: 0; padding: 0; display: grid; gap: 4px; font-size: 14px; }
    .log li.ok span:first-child { color: var(--primary); }
    .log li.bad { color: var(--error); }
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
  protected hooks: Record<Lang, string> = { ru: '', en: '', test: '' };
  protected testMode = false;
  protected readonly stages = signal<Stage[]>([]);
  protected stageId: number | null = null;
  protected readonly statusLabel = STAGE_STATUS as Record<string, string>;
  protected readonly runLog = signal<{ label: string; state: 'wait' | 'ok' | 'skip' | 'bad'; note?: string }[]>([]);
  protected readonly busy = signal(false);
  protected readonly msg = signal<string | null>(null);
  protected readonly ok = signal(true);
  protected readonly testMsg = signal<Partial<Record<Lang, { ok: boolean; text: string }>>>({});

  async ngOnInit() {
    const [s, p, st] = await Promise.all([
      supabase.from('app_settings').select('discord_invite').single(),
      supabase.from('private_settings').select('discord_webhook_url, discord_webhook_en, discord_webhook_test, discord_test_mode').maybeSingle(),
      supabase.from('stages').select('id, title_ru, status').order('id', { ascending: false }),
    ]);
    this.invite = s.data?.discord_invite ?? '';
    this.hooks = { ru: p.data?.discord_webhook_url ?? '', en: p.data?.discord_webhook_en ?? '', test: p.data?.discord_webhook_test ?? '' };
    this.testMode = !!p.data?.discord_test_mode;
    this.stages.set(st.data ?? []);
    // по умолчанию — этап, который идёт или ближайший (не черновик)
    this.stageId = (st.data ?? []).find((x) => x.status !== 'draft' && x.status !== 'finished')?.id ?? st.data?.[0]?.id ?? null;
  }

  /** все объявления по выбранному этапу — в тестовый канал, по очереди */
  async runAll() {
    const id = this.stageId;
    if (!id) return;
    this.busy.set(true);
    this.runLog.set(RUN_ALL.map((r) => ({ label: r.label, state: 'wait' })));
    const { data: pr } = await supabase.from('protests').select('id').order('created_at', { ascending: false }).limit(1).maybeSingle();
    for (const [i, r] of RUN_ALL.entries()) {
      const set = (state: 'ok' | 'skip' | 'bad', note?: string) => this.runLog.update((log) => log.map((x, k) => (k === i ? { ...x, state, note } : x)));
      if (r.type === 'protest' && !pr) {
        set('skip', 'протестов ещё нет');
        continue;
      }
      const { data, error } = await supabase.functions.invoke('discord-notify', { body: { type: r.type, id: r.type === 'protest' ? pr!.id : id, test: true } });
      const fail = error ? ((await error.context?.json?.().catch(() => null))?.error ?? error.message) : data?.error;
      if (fail) set('bad', fail);
      else if (data?.skipped) set('skip', data.skipped);
      else set('ok');
    }
    this.busy.set(false);
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
      supabase
        .from('private_settings')
        .update({ discord_webhook_url: nul(this.hooks.ru), discord_webhook_en: nul(this.hooks.en), discord_webhook_test: nul(this.hooks.test), discord_test_mode: this.testMode })
        .eq('id', 1)
        .select('id'),
    ]);
    this.busy.set(false);
    // RLS не даёт ошибку, а просто не обновляет строку — проверяем, что строка правда записалась
    const err = a.error?.message ?? b.error?.message ?? (!a.data?.length || !b.data?.length ? 'База не приняла изменения: сохранять может только организатор (роль «Организатор»).' : null);
    this.msg.set(err ?? 'Сохранено');
    this.ok.set(!err);
  }
}
