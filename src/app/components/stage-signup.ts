import { DatePipe } from '@angular/common';
import { Component, inject, input, OnInit, output, signal } from '@angular/core';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { supabase } from '../auth';
import { Loader } from './loader';

interface OpenStage {
  id: number;
  title_ru: string;
  title_en: string | null;
  track: string | null;
  starts_at: string | null;
  battles_at: string | null;
  reg_closed: boolean;
  registrations: { profile_id: string; status: string }[];
}

// Регистрация пилота на этапы с открытой регистрацией
@Component({
  selector: 'app-stage-signup',
  imports: [TranslocoPipe, DatePipe, Loader],
  template: `
    <h2 class="h">{{ 'signup.title' | transloco }}</h2>
    @for (s of stages(); track s.id) {
      @let mine = isMine(s);
      <!-- билет: слева этап и дни, по линии отрыва — корешок с номером пилота, штампом и кнопкой -->
      <article class="ticket" [class.in]="mine">
        <div class="main">
          <p class="kicker mono">SDS · {{ 'signup.ticket' | transloco }}</p>
          <h3>{{ lang() === 'en' && s.title_en ? s.title_en : s.title_ru }}</h3>
          @if (s.track) { <p class="track">{{ s.track }}</p> }
          <div class="days">
            @if (s.starts_at) {
              <div class="day"><span class="dl">{{ 'home.next.day1' | transloco }}</span><b class="mono">{{ s.starts_at | date: 'dd.MM · HH:mm' }}</b></div>
            }
            @if (s.battles_at) {
              <div class="day"><span class="dl">{{ 'home.next.day2' | transloco }}</span><b class="mono">{{ s.battles_at | date: 'dd.MM · HH:mm' }}</b></div>
            }
          </div>
          <p class="count subtle">{{ 'signup.count' | transloco: { n: count(s) } }}</p>
        </div>
        <div class="stub">
          <span class="lbl">{{ 'signup.pilot' | transloco }}</span>
          <b class="num mono">#{{ number() ?? '—' }}</b>
          <span class="codebox">
            <i class="code" aria-hidden="true"></i>
            @if (mine) { <span class="stamp" role="status">✓ {{ 'signup.stamp' | transloco }}</span> }
          </span>
          @if (mine) {
            <button class="leave" (click)="set(s, 'withdrawn')" [disabled]="busy()">{{ 'signup.leave' | transloco }}</button>
          } @else if (s.reg_closed) {
            <button class="btn btn-secondary join shut" disabled>🔒 {{ 'signup.closed' | transloco }}</button>
          } @else {
            <button class="btn btn-primary join" (click)="set(s, 'registered')" [disabled]="busy() || !hasNumber() || !hasDiscord()">{{ 'signup.joinShort' | transloco }}</button>
          }
        </div>
      </article>
    } @empty {
      @if (loading()) { <app-loader [inline]="true" /> } @else { <p class="subtle">{{ 'signup.none' | transloco }}</p> }
    }
    @if (!hasDiscord() && stages().length) { <p class="hint">{{ 'signup.needDiscord' | transloco }}</p> }
    @if (!hasNumber() && stages().length) { <p class="hint">{{ 'signup.needNumber' | transloco }}</p> }
    @if (error()) { <p class="bad">{{ error() }}</p> }
  `,
  styles: `
    :host { display: grid; gap: 12px; }
    .h { font-size: 20px; }
    /* билет: вырезы по линии отрыва — маской, поэтому видно фон карточки под ним */
    .ticket {
      --stub: 132px;
      --cut: calc(100% - var(--stub));
      position: relative;
      display: grid;
      grid-template-columns: 1fr var(--stub);
      border-radius: var(--r-md);
      background:
        linear-gradient(135deg, rgba(var(--accent-rgb), 0.07), transparent 55%),
        var(--surface-2);
      -webkit-mask: radial-gradient(circle 11px at var(--cut) 0, #0000 98%, #000) top / 100% 51% no-repeat,
        radial-gradient(circle 11px at var(--cut) 100%, #0000 98%, #000) bottom / 100% 51% no-repeat;
      mask: radial-gradient(circle 11px at var(--cut) 0, #0000 98%, #000) top / 100% 51% no-repeat,
        radial-gradient(circle 11px at var(--cut) 100%, #0000 98%, #000) bottom / 100% 51% no-repeat;
      transition: translate var(--base), background var(--base);
      &:hover { translate: 0 -2px; }
      &.in {
        background:
          linear-gradient(135deg, rgba(var(--accent-rgb), 0.18), transparent 60%),
          var(--surface-2);
      }
    }
    .main { padding: 18px 20px; min-width: 0; }
    .kicker { margin: 0 0 8px; font-size: 10px; letter-spacing: 2px; text-transform: uppercase; color: var(--primary); }
    h3 { font-size: 20px; margin: 0; line-height: 1.15; }
    .track { margin: 2px 0 0; font-size: 13px; color: var(--ink-muted); }
    .days { display: flex; flex-wrap: wrap; gap: 8px 20px; margin-top: 14px; }
    .day { display: grid; gap: 2px; }
    .dl { font-size: 10px; letter-spacing: 1px; text-transform: uppercase; color: var(--ink-subtle); }
    .day b { font-size: 15px; }
    .count { margin: 12px 0 0; font-size: 12px; }
    /* корешок: пунктир отрыва, номер пилота, «штрихкод» */
    .stub {
      display: grid; justify-items: center; align-content: center; gap: 6px; padding: 16px 12px;
      border-left: 2px dashed var(--hairline-strong);
      text-align: center;
    }
    .lbl { font-size: 10px; letter-spacing: 2px; text-transform: uppercase; color: var(--ink-subtle); }
    .num { font-size: 30px; line-height: 1; color: var(--primary); }
    .codebox { position: relative; display: grid; place-items: center; }
    .code {
      width: 84px; height: 26px; opacity: 0.55;
      background: repeating-linear-gradient(90deg, var(--ink) 0 2px, transparent 2px 4px, var(--ink) 4px 5px, transparent 5px 8px, var(--ink) 8px 11px, transparent 11px 12px);
    }
    .join { padding: 8px 14px; font-size: 13px; }
    .shut { white-space: normal; line-height: 1.25; }
    .leave {
      border: 0; background: none; padding: 4px; cursor: pointer;
      font: inherit; font-size: 12px; color: var(--ink-subtle); text-decoration: underline; text-underline-offset: 3px;
      &:hover { color: var(--ink); }
    }
    /* штамп «Допущен» — ставится с ударом при записи */
    .stamp {
      position: absolute; left: 50%; top: 50%; translate: -50% -50%; white-space: nowrap;
      background: color-mix(in srgb, var(--surface-2) 75%, transparent); backdrop-filter: blur(1px);
      padding: 4px 10px; border: 2px solid var(--primary); border-radius: 6px;
      color: var(--primary); font-size: 12px; font-weight: 700; letter-spacing: 2px; text-transform: uppercase;
      rotate: -10deg; opacity: 0.9; pointer-events: none;
      animation: stamp 420ms cubic-bezier(0.2, 1.6, 0.4, 1) both;
    }
    @keyframes stamp { from { scale: 2.2; opacity: 0; } }
    @media (prefers-reduced-motion: reduce) { .stamp { animation: none; } .ticket:hover { translate: none; } }
    /* узко — корешок уходит вниз, вырезы по бокам */
    @media (max-width: 460px) {
      .ticket {
        --cut: calc(100% - 118px);
        grid-template-columns: 1fr;
        -webkit-mask: radial-gradient(circle 11px at 0 var(--cut), #0000 98%, #000) left / 51% 100% no-repeat,
          radial-gradient(circle 11px at 100% var(--cut), #0000 98%, #000) right / 51% 100% no-repeat;
        mask: radial-gradient(circle 11px at 0 var(--cut), #0000 98%, #000) left / 51% 100% no-repeat,
          radial-gradient(circle 11px at 100% var(--cut), #0000 98%, #000) right / 51% 100% no-repeat;
      }
      .stub {
        display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; column-gap: 12px;
        border-left: 0; border-top: 2px dashed var(--hairline-strong); height: 118px; box-sizing: border-box; padding: 12px 20px;
      }
      .lbl { width: 100%; text-align: left; }
    }
    .hint { color: var(--warning); font-size: 13px; margin: 0; }
    .bad { color: var(--error); font-size: 13px; margin: 0; }
  `,
})
export class StageSignup implements OnInit {
  readonly profileId = input.required<string>();
  readonly hasNumber = input(false);
  /** ник в Discord указан — без него база не запишет (0019) */
  readonly hasDiscord = input(false);
  readonly number = input<number | null>(null);
  /** номер уже закреплён в этом сезоне — предупреждать при записи не нужно */
  readonly numberLocked = input(false);
  /** запись изменилась — кабинет пересчитывает блокировку номера */
  readonly changed = output<void>();
  protected readonly stages = signal<OpenStage[]>([]);
  protected readonly busy = signal(false);
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  private readonly transloco = inject(TranslocoService);
  protected readonly lang = signal(this.transloco.getActiveLang());

  constructor() {
    this.transloco.langChanges$.subscribe((l) => this.lang.set(l));
  }

  ngOnInit() {
    this.load();
  }

  private async load() {
    const { data, error } = await supabase
      .from('stages')
      .select('id, title_ru, title_en, track, starts_at, battles_at, reg_closed, registrations(profile_id, status)')
      .eq('status', 'registration')
      .order('starts_at');
    this.loading.set(false);
    if (error) return this.error.set(error.message);
    this.stages.set(data);
  }

  protected isMine(s: OpenStage) {
    return s.registrations.some((r) => r.profile_id === this.profileId() && r.status === 'registered');
  }

  protected count(s: OpenStage) {
    return s.registrations.filter((r) => r.status === 'registered').length;
  }

  async set(s: OpenStage, status: 'registered' | 'withdrawn') {
    // первая запись в сезоне закрепляет номер до конца сезона (0011)
    if (status === 'registered' && !this.numberLocked() && !confirm(this.transloco.translate('signup.lockConfirm', { n: this.number() }))) return;
    // регистрация закрыта — снятие не отменить
    if (status === 'withdrawn' && s.reg_closed && !confirm(this.transloco.translate('signup.leaveClosed'))) return;
    this.busy.set(true);
    this.error.set(null);
    const row = { stage_id: s.id, profile_id: this.profileId() };
    // Снятие — update (место в группе освобождается); регистрация/повторная — upsert
    const { error } =
      status === 'withdrawn'
        ? await supabase.from('registrations').update({ status, group_no: null, queue_order: null }).match(row)
        : await supabase.from('registrations').upsert({ ...row, status });
    this.busy.set(false);
    if (error) return this.error.set(error.message);
    await this.load();
    this.changed.emit();
  }
}
