import { Component, computed, inject, input, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { supabase } from '../auth';
import { fromLocalInput, plusDay, STAGE_FLOW, STAGE_STATUS, toLocalInput } from './labels';
import { notify } from '../notify';
import { compressImage } from '../image';
import { AdminParticipants } from './participants';
import { AdminStageResults } from './stage-results';
import { AdminStageRuns } from './stage-runs';

type Crit = 'angle' | 'style' | 'line';
interface Stage {
  id: number;
  season_id: number;
  ord: number;
  title_ru: string;
  title_en: string | null;
  description_ru: string | null;
  description_en: string | null;
  track: string | null;
  starts_at: string | null;
  battles_at: string | null;
  status: (typeof STAGE_FLOW)[number];
  weights: Record<Crit, number>;
  judges: Record<Crit, string>;
  bracket_size: string;
  /** прогревочный заезд перед зачётными попытками */
  warmup: boolean;
  twitch_channel: string | null;
  /** карта трассы от дизайнера (Storage: tracks/<id>/map.webp) */
  track_map_url: string | null;
  /** зоны трассы по порядку прохождения: сколько баллов каждого критерия в зоне (сумма = вес) */
  zones: Zone[];
}
interface Zone {
  name: string;
  line: number;
  angle: number;
  style: number;
}

const CRITS: { key: Crit; label: string }[] = [
  // порядок как у судей: траектория, угол, стиль
  { key: 'line', label: 'Траектория' },
  { key: 'angle', label: 'Угол' },
  { key: 'style', label: 'Стиль' },
];

@Component({
  selector: 'app-admin-stage',
  imports: [FormsModule, RouterLink, AdminParticipants, AdminStageResults, AdminStageRuns],
  template: `
    @if (st(); as st) {
      <a [routerLink]="['/admin/seasons', st.season_id]" class="back">← К сезону</a>
      <header class="top">
        <h1 class="display-md">{{ st.title_ru }}</h1>
        @if (st.status !== 'draft') {
          <a class="btn btn-secondary" [routerLink]="['/commentator', st.id]">Пульт комментатора →</a>
          <a class="btn btn-primary" [routerLink]="['/judge', st.id]">Пульт судьи →</a>
        }
      </header>

      <!-- Статус этапа: шаги по порядку -->
      <ol class="flow">
        @for (k of flow; track k; let i = $index) {
          <li [class.done]="i < flowIndex()" [class.now]="i === flowIndex()">
            <button type="button" (click)="setStatus(k)" [disabled]="busy() || i === flowIndex()">
              <span class="dot mono">{{ i + 1 }}</span>{{ stageStatus[k] }}
            </button>
          </li>
        }
      </ol>

      <form class="stack" (ngSubmit)="save()">
        <section class="card stack">
          <h2 class="h">Основное</h2>
          <div class="cols">
            <label class="field"><span class="lbl">Название (RU)</span><input class="input" name="tru" [(ngModel)]="st.title_ru" required /></label>
            <label class="field"><span class="lbl">Название (EN)</span><input class="input" name="ten" [(ngModel)]="st.title_en" /></label>
            <label class="field"><span class="lbl">Трасса</span><input class="input" name="track" [(ngModel)]="st.track" /></label>
            <label class="field"><span class="lbl">День 1 · Квалификация</span><input class="input mono" type="datetime-local" name="start" [(ngModel)]="startLocal" (ngModelChange)="startChanged($event)" /></label>
            <label class="field"><span class="lbl">День 2 · Парные заезды (Top 32)</span><input class="input mono" type="datetime-local" name="battles" [(ngModel)]="battlesLocal" /></label>
            <p class="hint subtle">Обычно парные — на следующий день, подставляется само. Можно перенести на любые выходные.</p>
            <label class="field"><span class="lbl">Порядковый номер</span><input class="input mono" type="number" min="1" name="ord" [(ngModel)]="st.ord" /></label>
            <label class="field"><span class="lbl">Twitch-канал</span><input class="input" name="tw" placeholder="sad_drift_series" [(ngModel)]="st.twitch_channel" /></label>
          </div>
          <label class="field"><span class="lbl">Описание (RU)</span><textarea class="input" rows="3" name="dru" [(ngModel)]="st.description_ru"></textarea></label>
          <label class="field"><span class="lbl">Описание (EN)</span><textarea class="input" rows="3" name="den" [(ngModel)]="st.description_en"></textarea></label>
        </section>

        <section class="card stack">
          <h2 class="h">Судейство</h2>
          <p class="muted small">Веса критериев в сумме — 100. Судья не сможет поставить балл больше веса.</p>
          <div class="cols">
            @for (c of crits; track c.key) {
              <div class="crit">
                <label class="field"><span class="lbl">{{ c.label }} — вес</span>
                  <input class="input mono" type="number" min="0" max="100" [name]="'w' + c.key" [(ngModel)]="st.weights[c.key]" (ngModelChange)="tick()" /></label>
                <label class="field"><span class="lbl">Судья</span>
                  <input class="input" [name]="'j' + c.key" placeholder="Ник судьи" [(ngModel)]="st.judges[c.key]" /></label>
              </div>
            }
          </div>
          <p class="sum mono" [class.bad]="weightSum() !== 100">Сумма: {{ weightSum() }} / 100</p>
          <label class="field narrow">
            <span class="lbl">Размер сетки</span>
            <select class="input" name="bs" [(ngModel)]="st.bracket_size">
              <option value="auto">Авто (по числу пилотов)</option>
              <option value="32">Top 32</option>
              <option value="16">Top 16</option>
              <option value="8">Top 8</option>
            </select>
          </label>
          <label class="chk">
            <input type="checkbox" name="warmup" [(ngModel)]="st.warmup" />
            <span>Прогревочный заезд в квалификации <span class="muted small">— выключите, чтобы сэкономить время: у пилота сразу 2 зачётные попытки</span></span>
          </label>
        </section>

        <section class="card stack">
          <h2 class="h">Трасса и зоны</h2>
          <p class="muted small">Картинка трассы от дизайнера и баллы по зонам — показываются на странице этапа. Зоны — по порядку прохождения; сумма по критерию должна совпасть с его весом.</p>
          <div class="map">
            @if (st.track_map_url) {
              <a [href]="st.track_map_url" target="_blank" rel="noopener"><img [src]="st.track_map_url" alt="Карта трассы" /></a>
            } @else {
              <div class="map-empty subtle">Картинки пока нет</div>
            }
            <div class="row">
              <label class="btn btn-secondary file">
                {{ uploading() ? 'Загружаю…' : st.track_map_url ? 'Заменить картинку' : 'Загрузить картинку' }}
                <input type="file" accept="image/png,image/jpeg,image/webp" (change)="uploadMap($event)" [disabled]="uploading()" />
              </label>
              @if (st.track_map_url) { <button type="button" class="btn btn-ghost danger" (click)="removeMap()" [disabled]="uploading()">Убрать картинку</button> }
            </div>
          </div>

          <div class="zones-wrap">
            <table class="zones">
              <thead>
                <tr><th>Зона</th>@for (c of crits; track c.key) { <th class="num">{{ c.label }}</th> }<th></th></tr>
              </thead>
              <tbody>
                @for (z of st.zones; track $index; let i = $index) {
                  <tr>
                    <td><input class="input mono" [name]="'zn' + i" placeholder="TGZ1" maxlength="12" [(ngModel)]="z.name" /></td>
                    @for (c of crits; track c.key) {
                      <td><input class="input mono" type="number" min="0" max="100" step="0.5" [name]="'z' + c.key + i" [(ngModel)]="z[c.key]" (ngModelChange)="tick()" /></td>
                    }
                    <td><button type="button" class="x" title="Удалить зону" (click)="removeZone(i)">✕</button></td>
                  </tr>
                }
              </tbody>
              @if (st.zones.length) {
                <tfoot>
                  <tr>
                    <td>Итого</td>
                    @for (c of crits; track c.key) {
                      <td class="num mono" [class.bad]="zoneSum()[c.key] !== +st.weights[c.key]">{{ zoneSum()[c.key] }} / {{ st.weights[c.key] }}</td>
                    }
                    <td></td>
                  </tr>
                </tfoot>
              }
            </table>
          </div>
          <div class="row">
            <button type="button" class="btn btn-secondary" (click)="addZone()">+ Зона</button>
            @if (zonesOff()) { <span class="bad small-note">Сумма по зонам не совпадает с весом — проверьте перед сохранением.</span> }
          </div>
        </section>

        <div class="row">
          <button class="btn btn-primary" type="submit" [disabled]="busy() || weightSum() !== 100">Сохранить</button>
          @if (msg()) { <span [class]="msgOk() ? 'ok' : 'bad'">{{ msg() }}</span> }
          @if (st.status === 'draft') {
            <button type="button" class="btn btn-ghost danger" (click)="remove()" [disabled]="busy()">Удалить этап</button>
          }
        </div>
      </form>

      @if (st.status === 'battles' || st.status === 'finished') {
        <app-admin-stage-results class="participants" [stageId]="st.id" />
      }
      @if (flowIndex() >= 2) {
        <app-admin-stage-runs class="participants" [stageId]="st.id" />
      }
      @if (st.status !== 'draft') {
        <app-admin-participants class="participants" [stageId]="st.id" />
      }
    } @else if (msg()) {
      <p class="bad">{{ msg() }}</p>
    }
  `,
  styles: `
    .back { display: inline-block; margin-bottom: 16px; font-size: 14px; }
    .top { display: flex; flex-wrap: wrap; gap: 16px; align-items: center; justify-content: space-between; margin-bottom: 24px; }
    .stack { display: grid; gap: 20px; }
    .h { font-size: 20px; }
    .cols { display: grid; gap: 16px; grid-template-columns: repeat(auto-fit, minmax(min(100%, 220px), 1fr)); }
    .field { display: grid; gap: 6px; }
    .chk { display: flex; gap: 10px; align-items: flex-start; cursor: pointer; input { margin-top: 3px; accent-color: var(--primary); } }
    .narrow { max-width: 280px; }
    .lbl { font-size: 13px; color: var(--ink-muted); }
    .small { font-size: 14px; margin: -8px 0 0; }
    .crit { display: grid; gap: 10px; padding: 16px; border: 1px solid var(--hairline); border-radius: var(--r-md); }
    .sum { margin: 0; color: var(--primary); }
    .row { display: flex; gap: 12px; align-items: center; flex-wrap: wrap; }
    .danger { margin-left: auto; color: var(--error); }
    .participants { display: block; margin-top: 24px; }
    /* трасса и зоны */
    .map { display: grid; gap: 12px; }
    .map img { display: block; width: 100%; max-height: 420px; object-fit: contain; border-radius: var(--r-md); background: var(--surface-2); }
    .map-empty { display: grid; place-items: center; height: 140px; border: 1px dashed var(--hairline-strong); border-radius: var(--r-md); }
    .file { position: relative; input { position: absolute; inset: 0; opacity: 0; cursor: pointer; } }
    .zones-wrap { overflow-x: auto; }
    .zones { border-collapse: collapse; min-width: 480px; }
    .zones th { font: 500 13px var(--font); color: var(--ink-muted); text-align: left; padding: 0 8px 8px 0; }
    .zones td { padding: 0 8px 8px 0; }
    .zones tfoot td { white-space: nowrap; }
    .zones td .input { width: 110px; }
    .zones td:first-child .input { width: 120px; }
    .zones tfoot td { padding-top: 8px; border-top: 1px solid var(--hairline); color: var(--primary); }
    .zones tfoot td.bad { color: var(--error); }
    .x { border: 0; background: none; color: var(--ink-subtle); cursor: pointer; font-size: 14px; padding: 6px; &:hover { color: var(--error); } }
    .small-note { font-size: 13px; }
    .ok { color: var(--primary); }
    .bad { color: var(--error); }

    .flow {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      list-style: none;
      padding: 0;
      margin: 0 0 24px;
      button {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 8px 14px 8px 8px;
        border: 1px solid var(--hairline-strong);
        border-radius: var(--r-pill);
        background: var(--surface-1);
        color: var(--ink-muted);
        font: 500 13px var(--font);
        cursor: pointer;
        transition: border-color var(--fast), color var(--fast);
        &:hover:not(:disabled) { border-color: var(--primary); color: var(--ink); }
        &:disabled { cursor: default; }
      }
      .dot { display: grid; place-items: center; width: 22px; height: 22px; border-radius: 50%; background: var(--surface-3); font-size: 11px; }
      .done button { color: var(--ink); }
      .done .dot { background: var(--primary-soft); color: var(--primary); }
      .now button { border-color: var(--primary); color: var(--ink); box-shadow: 0 0 16px -4px var(--primary-glow); }
      .now .dot { background: var(--primary); color: var(--on-primary); }
    }
  `,
})
export class AdminStage implements OnInit {
  readonly id = input.required<string>();
  protected readonly st = signal<Stage | null>(null);
  protected startLocal = '';
  protected battlesLocal = '';
  /** дата парных подстраивается под квалификацию, пока её не меняли вручную (была ровно «+1 день») */
  protected startChanged(v: string) {
    if (!this.battlesLocal || this.battlesLocal === plusDay(this.lastStart)) this.battlesLocal = plusDay(v);
    this.lastStart = v;
  }
  private lastStart = '';
  protected readonly busy = signal(false);
  protected readonly msg = signal<string | null>(null);
  protected readonly msgOk = signal(false);
  protected readonly crits = CRITS;
  protected readonly flow = STAGE_FLOW;
  protected readonly stageStatus = STAGE_STATUS;
  private readonly version = signal(0); // дёргаем при правке весов, чтобы пересчитать сумму
  protected readonly weightSum = computed(() => {
    this.version();
    const w = this.st()?.weights;
    return w ? CRITS.reduce((s, c) => s + (Number(w[c.key]) || 0), 0) : 0;
  });
  /** суммы баллов зон по критериям — сверяем с весами */
  protected readonly zoneSum = computed(() => {
    this.version();
    const zs = this.st()?.zones ?? [];
    return Object.fromEntries(CRITS.map((c) => [c.key, zs.reduce((s, z) => s + (Number(z[c.key]) || 0), 0)])) as Record<Crit, number>;
  });
  protected readonly zonesOff = computed(() => {
    const st = this.st();
    return !!st?.zones.length && CRITS.some((c) => this.zoneSum()[c.key] !== Number(st.weights[c.key]));
  });
  protected readonly uploading = signal(false);
  protected readonly flowIndex = computed(() => STAGE_FLOW.indexOf(this.st()?.status ?? 'draft'));
  private readonly router = inject(Router);

  async ngOnInit() {
    const { data, error } = await supabase
      .from('stages')
      .select('id, season_id, ord, title_ru, title_en, description_ru, description_en, track, starts_at, battles_at, status, weights, judges, bracket_size, warmup, twitch_channel, track_map_url, zones')
      .eq('id', this.id())
      .single();
    if (error) return this.note(error.message, false);
    this.st.set({ ...data, zones: data.zones ?? [] });
    this.startLocal = toLocalInput(data.starts_at);
    this.lastStart = this.startLocal;
    this.battlesLocal = toLocalInput(data.battles_at) || plusDay(this.startLocal);
  }

  protected tick() {
    this.version.update((v) => v + 1);
  }

  async save() {
    const st = this.st();
    if (!st) return;
    this.busy.set(true);
    const nul = (v: string | null) => v?.trim() || null;
    const { error } = await supabase
      .from('stages')
      .update({
        ord: st.ord,
        title_ru: st.title_ru.trim(),
        title_en: nul(st.title_en),
        description_ru: nul(st.description_ru),
        description_en: nul(st.description_en),
        track: nul(st.track),
        starts_at: fromLocalInput(this.startLocal),
        battles_at: fromLocalInput(this.battlesLocal),
        weights: { angle: +st.weights.angle, style: +st.weights.style, line: +st.weights.line },
        judges: st.judges,
        bracket_size: st.bracket_size,
        warmup: st.warmup,
        twitch_channel: nul(st.twitch_channel),
        zones: st.zones
          .filter((z) => z.name?.trim())
          .map((z) => ({ name: z.name.trim(), line: +z.line || 0, angle: +z.angle || 0, style: +z.style || 0 })),
      })
      .eq('id', st.id);
    this.busy.set(false);
    if (error) return this.note(error.code === '23505' ? 'Этап с таким номером в сезоне уже есть.' : error.message, false);
    this.st.set({ ...st });
    this.note('Сохранено', true);
  }

  protected addZone() {
    this.st.update((st) => st && { ...st, zones: [...st.zones, { name: '', line: 0, angle: 0, style: 0 }] });
  }

  protected removeZone(i: number) {
    this.st.update((st) => st && { ...st, zones: st.zones.filter((_, j) => j !== i) });
  }

  /** картинка трассы сохраняется сразу (без кнопки «Сохранить») — как логотипы спонсоров */
  async uploadMap(e: Event) {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    const st = this.st();
    if (!file || !st) return;
    this.uploading.set(true);
    try {
      const blob = await compressImage(file, 2400, 900_000);
      const path = `${st.id}/map.webp`;
      const up = await supabase.storage.from('tracks').upload(path, blob, { upsert: true, contentType: 'image/webp' });
      if (up.error) throw up.error;
      const url = `${supabase.storage.from('tracks').getPublicUrl(path).data.publicUrl}?v=${Date.now()}`;
      await this.setMap(url);
    } catch (err) {
      this.note((err as Error).message, false);
    } finally {
      this.uploading.set(false);
    }
  }

  async removeMap() {
    if (!confirm('Убрать картинку трассы со страницы этапа?')) return;
    await this.setMap(null);
  }

  private async setMap(url: string | null) {
    const st = this.st();
    if (!st) return;
    const { error } = await supabase.from('stages').update({ track_map_url: url }).eq('id', st.id);
    if (error) return this.note(error.message, false);
    this.st.set({ ...st, track_map_url: url });
    this.note(url ? 'Картинка трассы загружена' : 'Картинка убрана', true);
  }

  async setStatus(status: Stage['status']) {
    const st = this.st();
    if (!st) return;
    // Возврат назад — осознанное действие
    if (STAGE_FLOW.indexOf(status) < this.flowIndex() && !confirm(`Вернуть этап в статус «${STAGE_STATUS[status]}»?`)) return;
    this.busy.set(true);
    const { error } = await supabase.from('stages').update({ status }).eq('id', st.id);
    this.busy.set(false);
    if (error) return this.note(error.message, false);
    this.st.set({ ...st, status });
    this.note(`Статус: ${STAGE_STATUS[status]}`, true);
    if (status === 'registration') notify('registration', st.id);
    // старт квалы, следом — какая группа едет и какая готовится
    if (status === 'qualifying') notify('stage_start', st.id).then(() => notify('groups', st.id));
    if (status === 'battles') notify('battles_start', st.id);
  }

  async remove() {
    const st = this.st();
    if (!st || !confirm(`Удалить «${st.title_ru}»? Это нельзя отменить.`)) return;
    this.busy.set(true);
    const { error } = await supabase.from('stages').delete().eq('id', st.id);
    this.busy.set(false);
    if (error) return this.note(error.message, false);
    this.router.navigate(['/admin/seasons', st.season_id]);
  }

  private note(text: string, ok: boolean) {
    this.msg.set(text);
    this.msgOk.set(ok);
  }
}
