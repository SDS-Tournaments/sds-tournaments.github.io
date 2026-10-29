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
          <div class="body">
            <div class="main">
              <span class="eb">{{ 'ticket.kind' | transloco }}</span>
              <b class="track">{{ t.track }}</b>
              <span class="lv">{{ 'ticket.l' + t.level | transloco }}</span>
            </div>
            <div class="stub"><span class="mono n">{{ t.level }}</span><span class="of mono">/4</span></div>
            @if (t.level === 4) { <i class="spark s1">✦</i><i class="spark s2">✦</i> }
          </div>
        </div>
      }
      @for (tr of locked(); track tr) {
        <div class="tk locked">
          <div class="body">
            <div class="main">
              <span class="eb">{{ 'ticket.kind' | transloco }}</span>
              <b class="track">{{ tr }}</b>
              <span class="lv">{{ 'ticket.locked' | transloco }}</span>
            </div>
            <div class="stub"><span class="mono n">?</span></div>
          </div>
        </div>
      }
      @if (!tickets().length && !locked().length) { <p class="subtle">{{ 'ticket.none' | transloco }}</p> }
    </div>
    @if (!hideTitle()) { <p class="subtle legend">{{ 'ticket.legend' | transloco }}</p> }
  `,
  styles: `
    :host { display: block; }
    .list { display: grid; grid-template-columns: repeat(auto-fill, minmax(172px, 1fr)); gap: 10px; }
    .list.small { grid-template-columns: repeat(auto-fill, minmax(156px, 1fr)); gap: 8px; }
    /* уровни — как у карточек пилота: 1 бронза, 2 серебро, 3 золото (двойная рамка, свечение), 4 легенда (перламутр, голо-рамка, блик, искры) */
    .tk {
      --sw: 42px; --bw: 1px; --r: 9px;
      --tk: #c8895a; --frame: linear-gradient(135deg, #6b4226, #c8895a 50%, #7a4b2a); --tk-body: var(--surface-2); --tk-ink: var(--ink); --tk-sub: var(--ink-subtle);
      color: var(--tk-ink);
    }
    .small .tk { --sw: 36px; }
    .body {
      position: relative; isolation: isolate; overflow: hidden;
      display: grid; grid-template-columns: 1fr var(--sw); min-height: 58px; padding: var(--bw);
      border-radius: var(--r); background: var(--frame);
      /* вырезы на линии отрыва */
      -webkit-mask: radial-gradient(circle 6px at calc(100% - var(--sw)) 0, #0000 98%, #000) top / 100% 51% no-repeat,
        radial-gradient(circle 6px at calc(100% - var(--sw)) 100%, #0000 98%, #000) bottom / 100% 51% no-repeat;
      mask: radial-gradient(circle 6px at calc(100% - var(--sw)) 0, #0000 98%, #000) top / 100% 51% no-repeat,
        radial-gradient(circle 6px at calc(100% - var(--sw)) 100%, #0000 98%, #000) bottom / 100% 51% no-repeat;
    }
    .small .body { min-height: 48px; }
    .main, .stub { background: var(--tk-body); }
    .main { display: grid; align-content: center; padding: 7px 10px; border-radius: calc(var(--r) - var(--bw)) 0 0 calc(var(--r) - var(--bw)); min-width: 0; }
    .stub {
      display: flex; align-items: baseline; justify-content: center; padding-top: 14px; border-radius: 0 calc(var(--r) - var(--bw)) calc(var(--r) - var(--bw)) 0;
      /* перфорация по линии отрыва */
      background: repeating-linear-gradient(transparent 0 3px, color-mix(in srgb, var(--tk) 70%, transparent) 3px 6px) left top / 1px 100% no-repeat, var(--tk-body);
    }
    .small .stub { padding-top: 10px; }
    .eb { font-size: 9px; letter-spacing: 1.2px; text-transform: uppercase; color: var(--tk-sub); }
    .small .eb { display: none; }
    .track { font-size: 14px; line-height: 1.25; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .small .track { font-size: 13px; }
    .lv { font-size: 11px; color: var(--tk); font-weight: 600; }
    .n { font-size: 22px; font-weight: 700; font-style: italic; color: var(--tk); line-height: 1; }
    .small .n { font-size: 18px; }
    .of { font-size: 9px; color: var(--tk-sub); }

    .l2 { --bw: 2px; --tk: #e3e8eb; --frame: linear-gradient(150deg, #7d868c, #f4f7f8 40%, #9aa3a9 60%, #e9edef); }

    .l3 {
      --bw: 2px; --tk: #f5d77a; --tk-body: color-mix(in srgb, #f5d77a 7%, var(--surface-2));
      --frame: linear-gradient(135deg, #7a5a14, #f8e08e 22%, #b8902c 45%, #fff2b8 62%, #8a6a1c 82%, #e8c763);
      filter: drop-shadow(0 4px 12px rgba(245, 215, 122, 0.3));
    }
    /* вторая, тонкая рамка внутри */
    .l3 .body::after { content: ''; position: absolute; inset: calc(var(--bw) + 3px); border: 1px solid rgba(245, 215, 122, 0.35); border-radius: calc(var(--r) - 4px); pointer-events: none; }
    .l3 .n { text-shadow: 0 0 12px rgba(245, 215, 122, 0.6); }

    .l4 {
      --bw: 3px; --tk: #8a6a1c; --tk-body: #f4f2ee; --tk-ink: #111; --tk-sub: #6f6a63; --frame: none;
      filter: drop-shadow(0 4px 14px rgba(255, 211, 110, 0.35));
    }
    /* голографическая рамка вращается под телом билета */
    .l4 .body::before { content: ''; position: absolute; inset: -150%; z-index: -1; background: conic-gradient(#ff6ec7, #ffd36e, #7dffb0, #6ee7ff, #b28dff, #ff6ec7); animation: spin 4s linear infinite; }
    /* пробегающий блик */
    .l4 .body::after { content: ''; position: absolute; inset: 0; z-index: 1; pointer-events: none; background: linear-gradient(105deg, transparent 40%, rgba(255, 255, 255, 0.75) 50%, transparent 60%); animation: sweep 3.5s ease-in-out infinite; }
    .l4 .main { background-image: repeating-linear-gradient(115deg, transparent 0 9px, rgba(201, 151, 28, 0.1) 9px 10px); }
    .l4 .track { font-family: 'Russo One', var(--font); font-weight: 400; text-transform: uppercase; letter-spacing: 0.03em; }
    .small .l4 .track { font-family: inherit; font-weight: 700; text-transform: none; letter-spacing: 0; }
    .l4 .n { background: linear-gradient(120deg, #111, #8a6a1c 45%, #111); -webkit-background-clip: text; background-clip: text; color: transparent; font-family: 'Russo One', var(--font); font-style: normal; font-weight: 400; }
    .spark { position: absolute; z-index: 2; font-style: normal; color: #ffd36e; text-shadow: 0 0 6px #fff; animation: twinkle 2.4s ease-in-out infinite; pointer-events: none; }
    .s1 { top: 5px; right: calc(var(--sw) + 6px); font-size: 10px; }
    .s2 { bottom: 4px; right: 6px; font-size: 8px; animation-delay: 1.2s; }
    @keyframes spin { to { transform: rotate(360deg); } }
    @keyframes sweep { from { transform: translateX(-100%); } to { transform: translateX(100%); } }
    @keyframes twinkle { 0%, 100% { opacity: 0.2; transform: scale(0.7); } 50% { opacity: 1; transform: scale(1.15); } }
    @media (prefers-reduced-motion: reduce) { .l4 .body::before, .l4 .body::after, .spark { animation: none; } }

    .locked { --tk: var(--hairline-strong); --frame: none; --tk-body: transparent; opacity: 0.6; }
    .locked .body { border: 1px dashed var(--hairline-strong); padding: 0; }
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
