import { Component, input } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { Ticket } from '../data/tickets';

// Тикеты трасс: один билет на трассу, уровень 1–4 (квала → сетка → финал → победа). locked — трассы, где пилот ещё не ездил.
@Component({
  selector: 'app-track-tickets',
  imports: [TranslocoPipe],
  template: `
    @if (!hideTitle()) {
      <h2 class="h sec">{{ 'ticket.title' | transloco }} @if (locked().length) { <span class="subtle mono">{{ tickets().length }}/{{ tickets().length + locked().length }}</span> }</h2>
    }
    <div class="list" [class.small]="small()">
      @for (t of tickets(); track t.track) {
        <div class="tk" [class]="'l' + t.level" [title]="('ticket.got' | transloco) + ': ' + t.title">
          <div class="main">
            <span class="eb">{{ 'ticket.kind' | transloco }}</span>
            <b class="track">{{ t.track }}</b>
            <span class="lv">{{ 'ticket.l' + t.level | transloco }}</span>
          </div>
          <div class="stub"><span class="mono n">{{ t.level }}</span><span class="of mono">/4</span></div>
        </div>
      }
      @for (tr of locked(); track tr) {
        <div class="tk locked">
          <div class="main">
            <span class="eb">{{ 'ticket.kind' | transloco }}</span>
            <b class="track">{{ tr }}</b>
            <span class="lv">{{ 'ticket.locked' | transloco }}</span>
          </div>
          <div class="stub"><span class="mono n">?</span></div>
        </div>
      }
      @if (!tickets().length && !locked().length) { <p class="subtle">{{ 'ticket.none' | transloco }}</p> }
    </div>
    @if (!hideTitle()) { <p class="subtle legend">{{ 'ticket.legend' | transloco }}</p> }
  `,
  styles: `
    :host { display: block; }
    .list { display: grid; grid-template-columns: repeat(auto-fill, minmax(230px, 1fr)); gap: 12px; }
    .list.small { grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 8px; }
    .tk {
      --tk: var(--ink-subtle);
      --tk-bg: var(--surface-2);
      display: grid; grid-template-columns: 1fr 64px; min-height: 92px; color: var(--ink);
      /* вырезы на линии отрыва */
      -webkit-mask: radial-gradient(circle 9px at calc(100% - 64px) 0, #0000 98%, #000) top / 100% 51% no-repeat,
        radial-gradient(circle 9px at calc(100% - 64px) 100%, #0000 98%, #000) bottom / 100% 51% no-repeat;
      mask: radial-gradient(circle 9px at calc(100% - 64px) 0, #0000 98%, #000) top / 100% 51% no-repeat,
        radial-gradient(circle 9px at calc(100% - 64px) 100%, #0000 98%, #000) bottom / 100% 51% no-repeat;
    }
    .small .tk { min-height: 72px; grid-template-columns: 1fr 52px; }
    .main, .stub { background: var(--tk-bg); border: 1px solid color-mix(in srgb, var(--tk) 55%, transparent); }
    .main { display: grid; align-content: center; gap: 2px; padding: 12px 14px; border-right: 0; border-radius: var(--r-md) 0 0 var(--r-md); min-width: 0; }
    .stub {
      display: flex; align-items: baseline; justify-content: center; align-self: stretch; padding-top: 24px; border-left: 0; border-radius: 0 var(--r-md) var(--r-md) 0;
      /* перфорация по линии отрыва */
      background: repeating-linear-gradient(transparent 0 5px, color-mix(in srgb, var(--tk) 70%, transparent) 5px 9px) left top / 1px 100% no-repeat, var(--tk-bg);
    }
    .small .stub { padding-top: 16px; }
    .eb { font-size: 10px; letter-spacing: 1.5px; text-transform: uppercase; color: var(--ink-subtle); }
    .track { font-size: 18px; line-height: 1.2; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .small .track { font-size: 15px; }
    .lv { font-size: 12px; color: var(--tk); font-weight: 600; }
    .n { font-size: 30px; font-weight: 700; font-style: italic; color: var(--tk); line-height: 1; }
    .small .n { font-size: 24px; }
    .of { font-size: 11px; color: var(--ink-subtle); }
    .l1 { --tk: var(--ink-muted); }
    .l2 { --tk: color-mix(in srgb, var(--primary) 70%, var(--ink-muted)); }
    .l3 { --tk: var(--primary); --tk-bg: color-mix(in srgb, var(--primary) 8%, var(--surface-2)); }
    .l3 .n { text-shadow: 0 0 14px var(--primary-glow); }
    .l4 { --tk: #f5c242; --tk-bg: color-mix(in srgb, #f5c242 10%, var(--surface-2)); }
    .l4 .n { text-shadow: 0 0 16px rgba(245, 194, 66, 0.6); }
    .l4 .main { background-image: linear-gradient(110deg, transparent 30%, rgba(245, 194, 66, 0.12) 50%, transparent 70%); }
    .locked { --tk: var(--hairline-strong); opacity: 0.6; }
    .locked .main, .locked .stub { border-style: dashed; }
    .locked .lv { color: var(--ink-subtle); font-weight: 400; }
    .legend { margin: 10px 0 0; font-size: 12px; }
  `,
})
export class TrackTickets {
  readonly tickets = input<Ticket[]>([]);
  /** трассы, где пилот ещё не ездил (кабинет) */
  readonly locked = input<string[]>([]);
  readonly small = input(false);
  readonly hideTitle = input(false);
}
