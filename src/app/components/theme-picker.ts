import { Component, ElementRef, inject, input, signal } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { Auth } from '../auth';
import { SiteTheme, Theme, THEMES } from '../theme';

// Выбор стиля сайта: текущий стиль надписью (как RU/EN), по нажатию — список; закрытые — с замком и условием
@Component({
  selector: 'app-theme-picker',
  imports: [TranslocoPipe],
  host: { '(document:click)': 'outside($event)', '(document:keydown.escape)': 'open.set(false)' },
  template: `
    <button type="button" class="trigger" [attr.aria-expanded]="open()" aria-haspopup="menu" [title]="'theme.title' | transloco" (click)="open.set(!open())">
      {{ theme.current().toUpperCase() }}
    </button>
    @if (open()) {
      <div class="pop" [class.inline]="inline()" role="menu">
        <p class="hd">{{ 'theme.title' | transloco }}</p>
        @for (t of themes; track t.id) {
          @let ok = theme.allowed(t);
          <button type="button" role="menuitemradio" class="opt" [class.cur]="t.id === theme.current()" [attr.aria-checked]="t.id === theme.current()" [disabled]="!ok" (click)="pick(t)">
            <i class="sw" [style.background]="t.swatch"></i>
            <span class="nm">{{ t.id.toUpperCase() }}</span>
            @if (!ok) {
              <span class="need">🔒 {{ 'theme.need' | transloco: { tier: t.tier!.toUpperCase() } }}</span>
            } @else if (t.id === theme.current()) {
              <span class="check">✓</span>
            }
          </button>
        }
        <p class="note">{{ (auth.profile() ? 'theme.note' : 'theme.guest') | transloco }}</p>
      </div>
    }
  `,
  styles: `
    :host { position: relative; display: block; }
    .trigger {
      height: 30px; padding: 0 10px; border: 0; border-radius: var(--r-pill); background: none;
      color: var(--ink-subtle); font: 500 12px var(--mono); letter-spacing: 0.08em; cursor: pointer;
      transition: color var(--fast), background-color var(--fast);
      &:hover, &[aria-expanded='true'] { color: var(--primary); }
    }
    .pop {
      position: absolute; top: calc(100% + 12px); right: 0; z-index: 60; width: 270px;
      display: grid; gap: 2px; padding: 8px;
      border: 1px solid var(--hairline-strong); border-radius: var(--r-lg);
      background: var(--glass-strong); backdrop-filter: blur(14px);
      box-shadow: 0 16px 48px rgba(0, 0, 0, 0.35);
      animation: rise 200ms var(--ease-out) both;
    }
    .pop.inline { position: static; width: auto; box-shadow: none; margin-top: 4px; }
    .hd { margin: 4px 8px 6px; font-size: 11px; letter-spacing: 1.5px; text-transform: uppercase; color: var(--ink-subtle); }
    .opt {
      display: flex; align-items: center; gap: 10px; padding: 9px 10px; border: 0; border-radius: var(--r-md);
      background: none; color: var(--ink); text-align: left; cursor: pointer;
      transition: background-color var(--fast);
      &:hover:not(:disabled) { background: var(--surface-2); }
      &.cur { background: var(--primary-soft); }
      &:disabled { cursor: not-allowed; }
      &:disabled .sw, &:disabled .nm { opacity: 0.4; }
    }
    .sw { width: 18px; height: 18px; flex-shrink: 0; border-radius: 50%; box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.2); }
    .nm { font: 500 12px var(--mono); letter-spacing: 0.08em; }
    .need { margin-left: auto; font-size: 11px; color: var(--ink-subtle); white-space: nowrap; }
    .check { margin-left: auto; color: var(--primary); }
    .note { margin: 6px 8px 2px; font-size: 12px; line-height: 1.4; color: var(--ink-subtle); }
  `,
})
export class ThemePicker {
  protected readonly theme = inject(Theme);
  protected readonly auth = inject(Auth);
  private readonly el = inject(ElementRef<HTMLElement>);
  /** в мобильном меню — список прямо под кнопкой, без всплывашки */
  readonly inline = input(false);
  protected readonly open = signal(false);
  protected readonly themes = THEMES;

  protected pick(t: SiteTheme) {
    if (!this.theme.allowed(t)) return;
    this.theme.set(t.id);
    this.open.set(false);
  }

  protected outside(e: Event) {
    if (this.open() && !this.el.nativeElement.contains(e.target as Node)) this.open.set(false);
  }
}
