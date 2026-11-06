import { Component, computed, inject, input } from '@angular/core';
import { DomSanitizer } from '@angular/platform-browser';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { toSignal } from '@angular/core/rxjs-interop';
import { Auth } from '../auth';
import { Live } from '../live';
import { StageGroups } from './stage-groups';

// Аварийный сайт (Админка → Настройки → «Аварийный сайт»): зрителям — только трансляция и группы квалификации.
// Из базы — настройки и идущий этап при открытии, группы раз в ~4 мин. Штаб после входа видит полный сайт.
@Component({
  selector: 'app-emergency-page',
  imports: [TranslocoPipe, StageGroups],
  template: `
    <header class="container top">
      <span class="logo-mark">SDS</span>
      <button type="button" class="btn btn-ghost" (click)="auth.login()">{{ 'emergency.staffLogin' | transloco }}</button>
    </header>
    <main class="container body">
      @if (live.stage(); as s) {
        <h1 class="display-md">{{ lang() === 'en' && s.title_en ? s.title_en : s.title_ru }}</h1>
      }
      <p class="note">⚠ {{ 'emergency.note' | transloco }}</p>
      @if (playerUrl(); as url) {
        <div class="player"><iframe [src]="url" title="Twitch" allowfullscreen></iframe></div>
      } @else {
        <p class="subtle">{{ 'emergency.noStream' | transloco }}</p>
      }
      @if (live.stage(); as s) {
        @if (s.status === 'qualifying') {
          <app-stage-groups class="card" [stageId]="s.id" [status]="s.status" [poll]="240000" />
        }
      }
      @if (discord(); as d) {
        <a class="dc" [href]="d" target="_blank" rel="noopener">Discord →</a>
      }
    </main>
  `,
  styles: `
    :host { display: block; min-height: 100vh; }
    .top { display: flex; justify-content: space-between; align-items: center; padding-top: 16px; padding-bottom: 16px; }
    .body { display: grid; gap: 16px; padding-bottom: 48px; }
    .logo-mark { font: 600 16px var(--mono); letter-spacing: 2px; color: var(--primary); }
    h1 { margin: 0; }
    .note { margin: 0; padding: 10px 14px; border-radius: var(--r-md); font-size: 14px; color: var(--ink);
      border: 1px solid color-mix(in srgb, var(--warning) 50%, transparent); background: color-mix(in srgb, var(--warning) 10%, transparent); }
    .player { position: relative; aspect-ratio: 16 / 9; border-radius: var(--r-lg); overflow: hidden; background: #000; }
    .player iframe { position: absolute; inset: 0; width: 100%; height: 100%; border: 0; }
    .dc { justify-self: start; color: var(--primary); }
  `,
})
export class EmergencyPage {
  /** канал из настроек сайта (у этапа может быть свой) */
  readonly twitch = input<string | null>(null);
  readonly discord = input<string | null>(null);
  protected readonly auth = inject(Auth);
  protected readonly live = inject(Live);
  private readonly sanitizer = inject(DomSanitizer);
  private readonly t = inject(TranslocoService);
  protected readonly lang = toSignal(this.t.langChanges$, { initialValue: this.t.getActiveLang() });

  protected readonly playerUrl = computed(() => {
    // как в live-stage: вписать могут и имя канала, и ссылку twitch.tv/имя
    const ch = (this.live.stage()?.twitch_channel || this.twitch())?.trim().replace(/^.*twitch\.tv\//i, '').split(/[/?#]/)[0];
    if (!ch) return null;
    return this.sanitizer.bypassSecurityTrustResourceUrl(`https://player.twitch.tv/?channel=${encodeURIComponent(ch)}&parent=${location.hostname}`);
  });
}
