import { Component, computed, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DomSanitizer } from '@angular/platform-browser';
import { inject } from '@angular/core';
import { supabase } from '../auth';
import { DEFAULT_STATE, OverlayState, Widget, WIDGET_LABEL, WIDGETS } from './state';

// Пульт управляющего трансляцией: этап, какие плашки показаны, язык, превью и ссылка для OBS. Только RU.
@Component({
  selector: 'app-broadcast',
  imports: [FormsModule],
  template: `
    <header class="bar">
      <h1>Пульт трансляции</h1>
      <span class="live"><i></i>плашки обновляются у зрителей сразу</span>
    </header>

    <div class="layout">
      <aside class="card controls">
        <button class="toggle mock" [class.on]="!!state().mock" (click)="patch({ mock: !state().mock })" [attr.aria-pressed]="!!state().mock">
          <span class="sw"><span></span></span>
          Тестовые данные
        </button>
        @if (state().mock) {
          <p class="warn">⚠ Вместо этапа показан вымышленный — <b>и в OBS тоже</b>. Выключите перед эфиром.</p>
        }

        <label class="field">
          <span class="lbl">Этап</span>
          <select class="input" [ngModel]="state().stageId" (ngModelChange)="patch({ stageId: $event })" [disabled]="!!state().mock">
            <option [ngValue]="null">— не выбран —</option>
            @for (s of stages(); track s.id) { <option [ngValue]="s.id">{{ s.title_ru }} · {{ s.status }}</option> }
          </select>
        </label>

        <div class="lang">
          <span class="lbl">Язык плашек</span>
          <div class="seg">
            <button [class.on]="state().lang === 'ru'" (click)="patch({ lang: 'ru' })">RU</button>
            <button [class.on]="state().lang === 'en'" (click)="patch({ lang: 'en' })">EN</button>
            <button [class.on]="state().lang === 'auto'" (click)="patch({ lang: 'auto' })" title="Плашки сами меняют язык каждые 8 секунд">RU⇄EN</button>
          </div>
        </div>

        <div class="list">
          @for (w of widgets; track w) {
            <button class="toggle" [class.on]="state().visible[w]" (click)="toggle(w)" [attr.aria-pressed]="!!state().visible[w]">
              <span class="sw"><span></span></span>
              {{ label[w] }}
            </button>
          }
        </div>

        <label class="check">
          <input type="checkbox" [ngModel]="state().autoScore" (ngModelChange)="patch({ autoScore: $event })" />
          Оценка появляется сама на 10 с после каждой новой оценки
        </label>

        <button class="btn btn-ghost" (click)="hideAll()">Скрыть все плашки</button>

        <div class="obs">
          <span class="lbl">Ссылка для OBS (Источник → Браузер, 1920×1080)</span>
          <div class="copy">
            <input class="input mono" readonly [value]="obsUrl" />
            <button class="btn btn-primary" (click)="copy()">{{ copied() ? '✓' : 'Копировать' }}</button>
          </div>
          <p class="hint">Отдельный виджет: добавьте <code>?only=duel</code> (или onTrack, score, qualTable…) — удобно раскладывать по разным источникам.</p>
        </div>
        @if (error()) { <p class="bad">{{ error() }}</p> }
      </aside>

      <section class="preview">
        <span class="lbl">Превью (то, что видят зрители)</span>
        <div class="frame">
          <iframe [src]="previewUrl" title="Превью плашек"></iframe>
        </div>
      </section>
    </div>
  `,
  styles: `
    :host { display: block; max-width: 1680px; margin: 0 auto; padding: 24px var(--gutter) 64px; }
    .bar { display: flex; flex-wrap: wrap; gap: 16px; align-items: center; margin-bottom: 20px; }
    h1 { font-size: 24px; flex: 1; }
    .live { display: flex; align-items: center; gap: 8px; font-size: 13px; color: var(--primary); }
    .live i { width: 8px; height: 8px; border-radius: 50%; background: var(--primary); animation: p 2s ease-out infinite; }
    @keyframes p { from { box-shadow: 0 0 0 0 var(--primary-glow); } to { box-shadow: 0 0 0 8px transparent; } }
    .layout { display: grid; gap: 20px; grid-template-columns: 380px 1fr; align-items: start; }
    @media (max-width: 1100px) { .layout { grid-template-columns: 1fr; } }
    .controls { display: grid; gap: 18px; padding: 20px; }
    .field { display: grid; gap: 6px; }
    .lbl { font-size: 13px; color: var(--ink-muted); }
    .lang { display: flex; justify-content: space-between; align-items: center; }
    .seg { display: flex; padding: 3px; border: 1px solid var(--hairline-strong); border-radius: var(--r-pill); }
    .seg button { min-width: 44px; padding: 6px 12px; border: 0; border-radius: var(--r-pill); background: none; color: var(--ink-muted); font: 500 13px var(--mono); cursor: pointer; }
    .seg button.on { background: var(--primary); color: var(--on-primary); }
    .list { display: grid; gap: 6px; }
    .toggle {
      display: flex; align-items: center; gap: 12px; padding: 12px 14px; border: 1px solid var(--hairline-strong); border-radius: var(--r-md);
      background: var(--surface-1); color: var(--ink-muted); font: 500 15px var(--font); text-align: left; cursor: pointer;
      transition: border-color var(--fast), color var(--fast), background-color var(--fast);
      &:hover { border-color: var(--primary); color: var(--ink); }
      &.on { border-color: var(--primary); color: var(--ink); background: var(--primary-soft); }
    }
    .sw { position: relative; width: 40px; height: 22px; flex-shrink: 0; border-radius: 11px; background: var(--surface-3); transition: background-color var(--base); }
    .sw span { position: absolute; top: 3px; left: 3px; width: 16px; height: 16px; border-radius: 50%; background: var(--ink-subtle); transition: transform var(--base) var(--ease-out), background-color var(--base); }
    .on .sw { background: var(--primary); }
    .on .sw span { transform: translateX(18px); background: #000; }
    .check { display: flex; gap: 10px; align-items: start; font-size: 14px; color: var(--ink-muted); input { margin-top: 3px; accent-color: var(--primary); } }
    .obs { display: grid; gap: 8px; padding-top: 12px; border-top: 1px solid var(--hairline); }
    .copy { display: flex; gap: 8px; .input { font-size: 12px; } }
    .hint { margin: 0; font-size: 12px; color: var(--ink-subtle); }
    code { color: var(--primary); font-family: var(--mono); }
    .preview { display: grid; gap: 8px; }
    /* 1920×1080 в масштабе по ширине колонки */
    .frame { position: relative; width: 100%; aspect-ratio: 16 / 9; overflow: hidden; border-radius: var(--r-lg); border: 1px solid var(--hairline-strong); container-type: inline-size; }
    iframe { position: absolute; top: 0; left: 0; width: 1920px; height: 1080px; border: 0; transform-origin: 0 0; transform: scale(calc(100cqw / 1920px)); }
    .bad { color: var(--error); margin: 0; }
    .toggle.mock.on { border-color: var(--warning); background: rgba(245, 185, 66, 0.1); }
    .toggle.mock.on .sw { background: var(--warning); }
    .warn { margin: -8px 0 0; padding: 10px 12px; border-radius: var(--r-md); font-size: 13px; line-height: 1.45; color: var(--warning); background: rgba(245, 185, 66, 0.08); border: 1px solid rgba(245, 185, 66, 0.3); }
  `,
})
export class Broadcast implements OnInit {
  protected readonly state = signal<OverlayState>(DEFAULT_STATE);
  protected readonly stages = signal<{ id: number; title_ru: string; status: string }[]>([]);
  protected readonly error = signal<string | null>(null);
  protected readonly copied = signal(false);
  protected readonly widgets = WIDGETS;
  protected readonly label = WIDGET_LABEL;
  protected readonly obsUrl = `${location.origin}/overlay`;
  protected readonly previewUrl = inject(DomSanitizer).bypassSecurityTrustResourceUrl('/overlay?preview=1');

  async ngOnInit() {
    const [{ data: st }, { data: stages }] = await Promise.all([
      supabase.from('overlay_state').select('state').eq('id', 1).single(),
      supabase.from('stages').select('id, title_ru, status').neq('status', 'draft').order('starts_at', { ascending: false }),
    ]);
    const s = { ...DEFAULT_STATE, ...(st?.state ?? {}) };
    // по умолчанию — идущий этап
    if (!s.stageId) s.stageId = (stages ?? []).find((x) => x.status === 'qualifying' || x.status === 'battles')?.id ?? null;
    this.state.set(s);
    this.stages.set(stages ?? []);
  }

  protected toggle(w: Widget) {
    this.patch({ visible: { ...this.state().visible, [w]: !this.state().visible[w] } });
  }

  protected hideAll() {
    this.patch({ visible: {} });
  }

  async patch(p: Partial<OverlayState>) {
    const next = { ...this.state(), ...p };
    this.state.set(next);
    const { error } = await supabase.from('overlay_state').update({ state: next, updated_at: new Date().toISOString() }).eq('id', 1);
    this.error.set(error?.message ?? null);
  }

  async copy() {
    await navigator.clipboard.writeText(this.obsUrl);
    this.copied.set(true);
    setTimeout(() => this.copied.set(false), 1500);
  }
}
