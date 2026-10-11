import { Component, computed, inject, input, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { supabase } from '../auth';
import { fromLocalInput, STAGE_FLOW, STAGE_STATUS, toLocalInput } from './labels';
import { notify } from '../notify';
import { AdminParticipants } from './participants';
import { AdminStageResults } from './stage-results';

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
  status: (typeof STAGE_FLOW)[number];
  weights: Record<Crit, number>;
  judges: Record<Crit, string>;
  bracket_size: string;
  twitch_channel: string | null;
}

const CRITS: { key: Crit; label: string }[] = [
  { key: 'angle', label: 'Угол' },
  { key: 'style', label: 'Стиль' },
  { key: 'line', label: 'Траектория' },
];

@Component({
  selector: 'app-admin-stage',
  imports: [FormsModule, RouterLink, AdminParticipants, AdminStageResults],
  template: `
    @if (st(); as st) {
      <a [routerLink]="['/admin/seasons', st.season_id]" class="back">← К сезону</a>
      <header class="top">
        <h1 class="display-md">{{ st.title_ru }}</h1>
        @if (st.status !== 'draft') {
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
            <label class="field"><span class="lbl">Старт</span><input class="input mono" type="datetime-local" name="start" [(ngModel)]="startLocal" /></label>
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
    .narrow { max-width: 280px; }
    .lbl { font-size: 13px; color: var(--ink-muted); }
    .small { font-size: 14px; margin: -8px 0 0; }
    .crit { display: grid; gap: 10px; padding: 16px; border: 1px solid var(--hairline); border-radius: var(--r-md); }
    .sum { margin: 0; color: var(--primary); }
    .row { display: flex; gap: 12px; align-items: center; flex-wrap: wrap; }
    .danger { margin-left: auto; color: var(--error); }
    .participants { display: block; margin-top: 24px; }
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
  protected readonly flowIndex = computed(() => STAGE_FLOW.indexOf(this.st()?.status ?? 'draft'));
  private readonly router = inject(Router);

  async ngOnInit() {
    const { data, error } = await supabase
      .from('stages')
      .select('id, season_id, ord, title_ru, title_en, description_ru, description_en, track, starts_at, status, weights, judges, bracket_size, twitch_channel')
      .eq('id', this.id())
      .single();
    if (error) return this.note(error.message, false);
    this.st.set(data);
    this.startLocal = toLocalInput(data.starts_at);
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
        weights: { angle: +st.weights.angle, style: +st.weights.style, line: +st.weights.line },
        judges: st.judges,
        bracket_size: st.bracket_size,
        twitch_channel: nul(st.twitch_channel),
      })
      .eq('id', st.id);
    this.busy.set(false);
    if (error) return this.note(error.code === '23505' ? 'Этап с таким номером в сезоне уже есть.' : error.message, false);
    this.st.set({ ...st });
    this.note('Сохранено', true);
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
    if (status === 'qualifying') notify('stage_start', st.id);
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
