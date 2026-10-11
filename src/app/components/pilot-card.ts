import { Component, ElementRef, input, signal, viewChild } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { toPng } from 'html-to-image';

export interface CardData {
  nickname: string;
  start_number: number | null;
  avatar_url: string | null;
  livery_url: string | null;
  team: string | null;
  car: string | null;
  overall: number | null;
  angle: number | null;
  style: number | null;
  line: number | null;
  wins: number;
}

// FIFA-карточка пилота + скачивание PNG
@Component({
  selector: 'app-pilot-card',
  imports: [TranslocoPipe],
  template: `
    <div #card class="fut" [class.gold]="(d().overall ?? 0) >= 85">
      <div class="bg" [style.background-image]="d().livery_url ? 'url(' + d().livery_url + ')' : null"></div>
      <div class="shade"></div>
      <div class="top">
        <div class="ovr">
          <span class="big mono">{{ d().overall ?? '—' }}</span>
          <span class="tag">OVR</span>
          <span class="num mono">#{{ d().start_number ?? '—' }}</span>
        </div>
        <span class="brand mono">SDS</span>
      </div>
      <div class="face">
        @if (d().avatar_url) { <img [src]="d().avatar_url" alt="" crossorigin="anonymous" /> } @else { <span class="noface">{{ d().nickname[0] }}</span> }
      </div>
      <p class="nick">{{ d().nickname }}</p>
      <p class="team">{{ d().team ?? 'Sad Drift Series' }}</p>
      <div class="stats mono">
        <span><b>{{ d().angle ?? '—' }}</b>ANG</span>
        <span><b>{{ d().style ?? '—' }}</b>STY</span>
        <span><b>{{ d().line ?? '—' }}</b>LIN</span>
        <span><b>{{ d().wins }}</b>WIN</span>
      </div>
      <p class="car">{{ d().car ?? '' }}</p>
    </div>
    <button class="btn btn-secondary dl" (click)="download()" [disabled]="busy()">⬇ {{ 'pilot.download' | transloco }}</button>
    @if (error()) { <p class="bad">{{ error() }}</p> }
  `,
  styles: `
    :host { display: grid; gap: 12px; justify-items: center; }
    .fut {
      position: relative; width: 300px; height: 440px; overflow: hidden; display: grid; justify-items: center; align-content: start;
      padding: 22px 22px 18px; color: #fff; text-align: center;
      border-radius: 22px 22px 60px 60px / 22px 22px 40px 40px;
      background: #060606;
      box-shadow: 0 0 0 1px rgba(10, 186, 181, 0.6), 0 0 0 4px #000, 0 0 0 5px rgba(10, 186, 181, 0.35), 0 24px 60px -20px var(--primary-glow);
    }
    .bg { position: absolute; inset: 0; background: radial-gradient(80% 60% at 50% 0%, rgba(10, 186, 181, 0.35), transparent 70%) center / cover no-repeat; filter: saturate(1.1); }
    .shade { position: absolute; inset: 0; background: linear-gradient(180deg, rgba(0, 0, 0, 0.35) 0%, rgba(0, 0, 0, 0.55) 45%, #000 85%); }
    .fut > :not(.bg):not(.shade) { position: relative; }
    .top { width: 100%; display: flex; justify-content: space-between; align-items: start; }
    .ovr { display: grid; justify-items: center; line-height: 1; }
    .big { font-size: 48px; font-weight: 600; color: var(--primary); text-shadow: 0 0 18px var(--primary-glow); }
    .tag { font-size: 11px; letter-spacing: 2px; color: #cfcfcf; margin-top: 2px; }
    .num { margin-top: 10px; font-size: 18px; font-style: italic; }
    .brand { font-size: 12px; padding: 3px 7px; border: 1px solid var(--primary); border-radius: 6px; color: var(--primary); letter-spacing: 1px; }
    .face { width: 128px; height: 128px; margin-top: -18px; border-radius: 50%; overflow: hidden; box-shadow: 0 0 0 3px #000, 0 0 0 5px var(--primary), 0 0 32px var(--primary-glow); }
    .face img { width: 100%; height: 100%; object-fit: cover; }
    .noface { display: grid; place-items: center; width: 100%; height: 100%; background: var(--surface-2); font: 600 48px var(--font); color: var(--primary); }
    .nick { margin: 16px 0 0; font-size: 24px; font-weight: 600; letter-spacing: -0.02em; max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .team { margin: 2px 0 0; font-size: 12px; letter-spacing: 1.5px; text-transform: uppercase; color: var(--primary); }
    .stats { width: 100%; display: grid; grid-template-columns: repeat(4, 1fr); margin-top: 18px; padding-top: 14px; border-top: 1px solid rgba(255, 255, 255, 0.15); }
    .stats span { display: grid; font-size: 10px; letter-spacing: 1px; color: #aaa; }
    .stats b { font-size: 22px; color: #fff; font-weight: 500; }
    .car { margin: 14px 0 0; font-size: 12px; color: #9a9a9a; }
    .gold { box-shadow: 0 0 0 1px #f5d77a, 0 0 0 4px #000, 0 0 0 5px rgba(245, 215, 122, 0.5), 0 24px 60px -20px rgba(245, 215, 122, 0.45); }
    .gold .big { color: #f5d77a; text-shadow: 0 0 18px rgba(245, 215, 122, 0.5); }
    .bad { color: var(--error); font-size: 13px; margin: 0; }
  `,
})
export class PilotCard {
  readonly d = input.required<CardData>();
  private readonly card = viewChild.required<ElementRef<HTMLElement>>('card');
  protected readonly busy = signal(false);
  protected readonly error = signal<string | null>(null);

  async download() {
    this.busy.set(true);
    this.error.set(null);
    try {
      const url = await toPng(this.card().nativeElement, { pixelRatio: 2, cacheBust: true });
      const a = document.createElement('a');
      a.href = url;
      a.download = `SDS-${this.d().start_number ?? ''}-${this.d().nickname}.png`;
      a.click();
    } catch (e) {
      this.error.set(String((e as Error)?.message ?? e));
    } finally {
      this.busy.set(false);
    }
  }
}
