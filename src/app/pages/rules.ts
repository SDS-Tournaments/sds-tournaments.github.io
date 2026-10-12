import { Component, computed, ElementRef, inject, OnInit, signal, viewChild } from '@angular/core';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { marked } from 'marked';
import { supabase } from '../auth';
import { Loader } from '../components/loader';

// Регламент: Markdown из настроек сайта (RU/EN), оглавление по разделам
@Component({
  selector: 'app-rules',
  imports: [TranslocoPipe, Loader],
  template: `
    @if (!ready()) {
      <app-loader />
    } @else {
      <section class="section container page-in">
        <p class="eyebrow">Sad Drift Series @if (version()) { · {{ 'rules.version' | transloco: { v: version() } }} }</p>
        <h1 class="display-lg">{{ 'nav.rules' | transloco }}</h1>
        @if (html()) {
          <div class="layout">
            <nav class="toc" [attr.aria-label]="'rules.toc' | transloco">
              @for (h of toc(); track $index) {
                <button type="button" (click)="go($index)">{{ h }}</button>
              }
            </nav>
            <article #doc class="doc" [innerHTML]="html()"></article>
          </div>
        } @else {
          <p class="subtle">{{ 'rules.empty' | transloco }}</p>
        }
      </section>
    }
  `,
  styles: `
    h1 { margin: 12px 0 40px; }
    .layout { display: grid; gap: 48px; grid-template-columns: 240px minmax(0, 760px); align-items: start; }
    /* под шапкой-островами (с LIVE-плашкой ~120px) */
    .toc { position: sticky; top: 132px; display: grid; gap: 2px; max-height: calc(100vh - 160px); overflow-y: auto; }
    /* телефон: оглавление обычным блоком над текстом, без прилипания — иначе ложится поверх регламента */
    @media (max-width: 900px) { .layout { grid-template-columns: 1fr; gap: 32px; } .toc { position: static; max-height: none; } }
    .toc button {
      padding: 6px 10px; border: 0; border-left: 2px solid var(--hairline); background: none; color: var(--ink-subtle);
      font: 13px var(--font); text-align: left; cursor: pointer; transition: color var(--fast), border-color var(--fast);
      &:hover { color: var(--ink); border-left-color: var(--primary); }
    }
    .doc { line-height: 1.7; color: var(--ink-muted); }
    .doc ::ng-deep h2 { font-size: 22px; color: var(--ink); margin: 48px 0 16px; padding-top: 16px; border-top: 1px solid var(--hairline); scroll-margin-top: 132px; }
    .doc ::ng-deep h2:first-child { margin-top: 0; border-top: 0; padding-top: 0; }
    .doc ::ng-deep h3 { font-size: 16px; color: var(--primary); margin: 28px 0 8px; }
    .doc ::ng-deep strong { color: var(--ink); }
    .doc ::ng-deep ul { padding-left: 20px; }
    .doc ::ng-deep li::marker { color: var(--primary); }
    .doc ::ng-deep table { width: 100%; border-collapse: collapse; margin: 12px 0; font-size: 14px; }
    .doc ::ng-deep th, .doc ::ng-deep td { padding: 10px 12px; border-bottom: 1px solid var(--hairline); text-align: left; }
    .doc ::ng-deep th { color: var(--ink-subtle); font-weight: 500; font-size: 12px; text-transform: uppercase; letter-spacing: 1px; }
    .doc ::ng-deep blockquote { margin: 16px 0; padding: 12px 16px; border-left: 3px solid var(--warning); background: rgba(245, 185, 66, 0.06); color: var(--ink); }
  `,
})
export class Rules implements OnInit {
  private readonly ru = signal('');
  private readonly en = signal('');
  protected readonly version = signal<string | null>(null);
  protected readonly ready = signal(false);
  private readonly t = inject(TranslocoService);
  private readonly lang = signal(this.t.getActiveLang());
  private readonly doc = viewChild<ElementRef<HTMLElement>>('doc');

  private readonly md = computed(() => (this.lang() === 'en' && this.en()) || this.ru());
  protected readonly html = computed(() => (this.md() ? (marked.parse(this.md(), { async: false }) as string) : ''));
  protected readonly toc = computed(() => [...this.md().matchAll(/^## (.+)$/gm)].map((m) => m[1].replace(/[*_`]/g, '')));

  constructor() {
    this.t.langChanges$.subscribe((l) => this.lang.set(l));
  }

  async ngOnInit() {
    const { data } = await supabase.from('app_settings').select('regulation_ru, regulation_en, regulation_version').single();
    this.ru.set(data?.regulation_ru ?? '');
    this.en.set(data?.regulation_en ?? '');
    this.version.set(data?.regulation_version ?? null);
    this.ready.set(true);
  }

  protected go(i: number) {
    this.doc()?.nativeElement.querySelectorAll('h2')[i]?.scrollIntoView({ behavior: 'smooth' });
  }
}
