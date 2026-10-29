import { Component, computed, effect, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { Auth, supabase } from '../auth';
import { CAR_PROTOTYPES, CARS, ENGINES, GEARBOXES } from '../catalog';
import { NumberPicker } from '../components/number-picker';
import { MyProtests } from '../components/my-protests';
import { MyTeam } from '../components/my-team';
import { ContentRules } from '../components/content-rules';
import { Loader } from '../components/loader';
import { loadSkillRuns, PilotShowcase } from '../components/pilot-showcase';
import { AchievementShelf } from '../components/achievement-shelf';
import { TrackTickets } from '../components/track-tickets';
import { loadTickets, loadTracks, Ticket } from '../data/tickets';
import { publicSeasons } from '../data/standings';
import { SkillRun } from '../scoring/scoring';
import { StageSignup } from '../components/stage-signup';
import { compressImage } from '../image';

// Личный кабинет пилота (шаг 2.2). Регистрация на этап и команда — шаги 3.3–3.4.
@Component({
  selector: 'app-me',
  imports: [FormsModule, TranslocoPipe, NumberPicker, StageSignup, MyTeam, MyProtests, Loader, PilotShowcase, AchievementShelf, ContentRules, TrackTickets],
  template: `
    <section class="section container">
      @if (!auth.ready()) {
        <app-loader />
      } @else if (auth.profile(); as me) {
        <header class="head">
          <div class="cover" [style.background-image]="me.livery_url ? 'url(' + me.livery_url + ')' : null"></div>
          <div class="who">
            @if (me.avatar_url) {
              <img class="avatar" [src]="me.avatar_url" alt="" width="96" height="96" />
            }
            <div>
              <p class="eyebrow">{{ 'role.' + me.role | transloco }}</p>
              <h1 class="display-md">
                @if (me.start_number) {
                  <span class="num mono">#{{ me.start_number }}</span>
                }
                {{ me.nickname }}
              </h1>
              <p class="subtle mono steam">Steam ID {{ me.steam_id }}</p>
              @if (me.car || me.power_hp) {
                <dl class="spec mono">
                  @if (me.car) { <div><dt>{{ 'me.carModel' | transloco }}</dt><dd>{{ me.car }}@if (proto[me.car]) { <small class="proto">{{ proto[me.car] }}</small> }</dd></div> }
                  @if (me.engine) { <div><dt>{{ 'me.engine' | transloco }}</dt><dd>{{ me.engine }}</dd></div> }
                  @if (me.gearbox) { <div><dt>{{ 'me.gearbox' | transloco }}</dt><dd>{{ me.gearbox }}</dd></div> }
                  @if (me.power_hp) { <div><dt>{{ 'me.powerShort' | transloco }}</dt><dd>{{ me.power_hp }}</dd></div> }
                </dl>
              }
            </div>
            <button class="btn btn-ghost out" (click)="logout()">{{ 'auth.logout' | transloco }}</button>
          </div>
        </header>

        <app-my-protests class="protests" [profileId]="me.id" />

        <!-- 1. Карточка и навыки -->
        <p class="eyebrow sec">{{ 'me.secCard' | transloco }}</p>
        <app-pilot-showcase [pilot]="me" [runs]="runs()" [team]="team()" [wins]="wins()" [legacy]="me.legacy" />
        <app-track-tickets class="tickets" [tickets]="tickets()" [locked]="lockedTracks()" />
        <app-achievement-shelf [profileId]="me.id" />

        <!-- 2. Сезон: главные действия — запись на этап и команда -->
        <p class="eyebrow sec">{{ 'me.secSeason' | transloco }}</p>
        <!-- чек-лист «как попасть на этап»: сделанное — ✓, следующий шаг подсвечен, клик — к нужному полю -->
        @if (checkDone() === steps().length) {
          <div class="card ck-ready" role="status">
            <span class="ck-dot done">✓</span>
            <span><b>{{ 'check.readyTitle' | transloco }}</b>&nbsp;<span class="muted">{{ 'check.readyText' | transloco }}</span></span>
          </div>
        } @else {
          <nav class="card ck" [attr.aria-label]="'check.title' | transloco">
            <div class="ck-head">
              <h2 class="h">{{ 'check.title' | transloco }}</h2>
              <span class="mono ck-count">{{ checkDone() }} / {{ steps().length }}</span>
            </div>
            <div class="ck-bar" aria-hidden="true"><i [style.width.%]="(checkDone() / steps().length) * 100"></i></div>
            <ol class="ck-steps">
              @for (s of steps(); track s.k; let i = $index) {
                <li [class.done]="s.done" [class.now]="s.k === nextStep()">
                  <button type="button" (click)="goTo(s.target)" [disabled]="s.done || !s.target">
                    <span class="ck-dot">{{ s.done ? '✓' : i + 1 }}</span>
                    <span class="ck-text">
                      <b>{{ 'check.' + s.k | transloco }}</b>
                      @if (!s.done) { <small>{{ 'check.' + s.k + 'Hint' | transloco }}</small> }
                    </span>
                  </button>
                </li>
              }
            </ol>
          </nav>
        }
        <form id="discord" class="card dc" [class.need]="!me.discord" (ngSubmit)="saveDiscord()">
          <div class="dc-text">
            <h2 class="h">Discord</h2>
            <p class="muted dc-hint">{{ 'me.discordHint' | transloco }}</p>
          </div>
          <div class="dc-row">
            <input class="input mono" name="discord" maxlength="64" autocomplete="off" [attr.aria-label]="'me.discordLbl' | transloco" [placeholder]="'me.discordPh' | transloco" [(ngModel)]="discord" />
            <button class="btn btn-primary" type="submit" [disabled]="dcSaving() || discord.trim() === (me.discord ?? '')">{{ 'me.save' | transloco }}</button>
          </div>
          @if (dcMsg(); as m) { <p class="hint" [class.bad]="!m.ok" [class.ok]="m.ok">{{ m.text }}</p> }
        </form>
        <div class="cols eq">
          <app-stage-signup id="signup" class="card" [profileId]="me.id" [hasNumber]="!!me.start_number" [hasDiscord]="!!me.discord" [number]="me.start_number" [numberLocked]="numberLocked()" (changed)="loadLock(me.id); loadReg(me.id)" />
          <app-my-team class="card" [profileId]="me.id" />
        </div>

        <!-- 3. Профиль пилота: номер, машина, о себе, ливрея -->
        <p class="eyebrow sec">{{ 'me.secProfile' | transloco }}</p>
        <form class="cols" (ngSubmit)="save()">
          <div id="num" class="card stack numcard" [class.wide]="pickingNumber()" [class.view]="!pickingNumber()">
            <h2 class="h">{{ 'me.number' | transloco }}</h2>
            @if (pickingNumber()) {
              <p class="muted small">{{ 'me.numberHint' | transloco }}</p>
              <p class="warn small">{{ 'me.numberUntilSignup' | transloco }}</p>
              <app-number-picker [(value)]="number" [taken]="taken()" [nickname]="me.nickname" />
              @if (me.start_number) {
                <button type="button" class="btn btn-ghost fit" (click)="cancelNumber()">{{ 'me.numberCancel' | transloco }}</button>
              }
            } @else {
              <!-- номер «наклейкой» по центру карточки, подсказка и кнопка — снизу -->
              <div class="decal" [class.lock]="numberLocked()">
                <span class="hash">#</span><span class="digits">{{ me.start_number }}</span>
                @if (numberLocked()) { <span class="lockmark" aria-hidden="true">🔒</span> }
              </div>
              <div class="numfoot">
                <p class="muted">{{ (numberLocked() ? 'me.numberLocked' : 'me.numberKeep') | transloco }}</p>
                @if (!numberLocked()) {
                  <button type="button" class="btn btn-secondary" (click)="editNumber.set(true)">{{ 'me.numberChange' | transloco }}</button>
                }
              </div>
            }
          </div>

          <div class="card stack">
            <h2 class="h">{{ 'me.car' | transloco }}</h2>
            <label>
              <span class="lbl">{{ 'me.carModel' | transloco }}</span>
              <select class="input" name="car" [(ngModel)]="car">
                <option value="">{{ 'me.choose' | transloco }}</option>
                @for (o of cars; track o) { <option [value]="o">{{ o }}{{ proto[o] ? ' — ' + proto[o] : '' }}</option> }
              </select>
            </label>
            <div class="two">
              <label>
                <span class="lbl">{{ 'me.engine' | transloco }}</span>
                <select class="input" name="engine" [(ngModel)]="engine">
                  <option value="">{{ 'me.choose' | transloco }}</option>
                  @for (o of engines; track o) { <option [value]="o">{{ o }}</option> }
                </select>
              </label>
              <label>
                <span class="lbl">{{ 'me.gearbox' | transloco }}</span>
                <select class="input" name="gearbox" [(ngModel)]="gearbox">
                  <option value="">{{ 'me.choose' | transloco }}</option>
                  @for (o of gearboxes; track o) { <option [value]="o">{{ o }}</option> }
                </select>
              </label>
            </div>
            <label>
              <span class="lbl">{{ 'me.power' | transloco }}</span>
              <input class="input mono" type="number" name="power" min="1" max="5000" [(ngModel)]="power" />
            </label>
          </div>

          <div class="card stack about">
            <h2 class="h">{{ 'me.about' | transloco }}</h2>
            <label class="bio">
              <span class="lbl">{{ 'me.bioRu' | transloco }}</span>
              <textarea class="input" name="bioRu" maxlength="500" [placeholder]="'me.bioPh' | transloco" [(ngModel)]="bioRu"></textarea>
              <span class="count mono">{{ bioRu.length }} / 500</span>
            </label>
            <label class="bio">
              <span class="lbl">{{ 'me.bioEn' | transloco }}</span>
              <textarea class="input" name="bioEn" maxlength="500" placeholder="A few words about you" [(ngModel)]="bioEn"></textarea>
              <span class="count mono">{{ bioEn.length }} / 500</span>
            </label>
            <app-content-rules />
          </div>

          <div class="card stack">
            <h2 class="h">{{ 'me.livery' | transloco }}</h2>
            <p class="muted small">{{ 'me.liveryHint' | transloco }}</p>
            <div class="livery" [class.empty]="!me.livery_url">
              @if (me.livery_url) {
                <img [src]="me.livery_url" [alt]="'me.livery' | transloco" />
              } @else {
                <span class="subtle">{{ 'me.noLivery' | transloco }}</span>
              }
            </div>
            <label class="btn btn-secondary file">
              {{ (uploading() ? 'me.uploading' : 'me.upload') | transloco }}
              <input type="file" accept="image/png,image/jpeg,image/webp" (change)="upload($event)" [disabled]="uploading()" />
            </label>
            @if (uploadError()) { <span class="hint bad">{{ uploadError() }}</span> }
            <app-content-rules />
          </div>

          <div class="savebar wide" [class.on]="dirty()" [class.err]="!!error()" role="status">
            @if (error()) {
              <span class="sb-text bad">{{ error() }}</span>
            } @else if (dirty()) {
              <span class="sb-text"><i class="sb-dot"></i>{{ 'me.unsaved' | transloco }}</span>
            } @else {
              <span class="sb-text ok">✓ {{ 'me.allSaved' | transloco }}</span>
            }
            @if (dirty()) {
              <button class="btn btn-ghost" type="button" (click)="resetForm()" [disabled]="saving()">{{ 'me.discard' | transloco }}</button>
              <button class="btn btn-primary" type="submit" [disabled]="saving()">{{ (saving() ? 'me.saving' : 'me.save') | transloco }}</button>
            }
          </div>
        </form>

      } @else {
        <div class="card guest">
          <h1 class="display-md">{{ 'nav.me' | transloco }}</h1>
          <p class="muted">{{ 'me.guest' | transloco }}</p>
          <button class="btn btn-primary" (click)="auth.login()">{{ 'auth.login' | transloco }}</button>
        </div>
      }
    </section>
  `,
  styles: `
    .head {
      position: relative;
      overflow: hidden;
      border: 1px solid var(--hairline);
      border-radius: var(--r-xl);
    }
    .cover {
      height: 200px;
      background: radial-gradient(60% 120% at 80% 0%, rgba(var(--accent-rgb), 0.25), transparent 70%), var(--surface-1);
      background-size: cover;
      background-position: center;
      mask-image: linear-gradient(to bottom, #000 40%, transparent);
    }
    .who {
      display: flex;
      flex-wrap: wrap;
      align-items: flex-end;
      gap: 20px;
      padding: 0 28px 24px;
      margin-top: -56px;
      position: relative;
    }
    .avatar {
      border-radius: 50%;
      box-shadow: 0 0 0 3px var(--canvas), 0 0 0 5px var(--primary), 0 0 32px var(--primary-glow);
    }
    h1 { margin: 4px 0; }
    .num { color: var(--primary); margin-right: 8px; }
    .steam { margin: 0; font-size: 12px; }
    .out { margin-left: auto; }
    .spec {
      display: flex;
      flex-wrap: wrap;
      gap: 6px 20px;
      margin: 12px 0 0;
      div { display: grid; }
      dt { font-size: 10px; letter-spacing: 1px; text-transform: uppercase; color: var(--ink-subtle); }
      dd { margin: 0; font-size: 14px; color: var(--ink); }
      .proto { display: block; font-family: var(--font); font-size: 11px; color: var(--ink-subtle); }
    }

    /* разделы кабинета: подпись + две колонки */
    .sec { margin: 40px 0 16px; }
    /* карточки в ряду одной высоты, содержимое прижато кверху */
    .cols { display: grid; gap: 24px; grid-template-columns: repeat(2, minmax(0, 1fr)); align-items: stretch; }
    .cols > * { align-content: start; }
    @media (max-width: 860px) { .cols { grid-template-columns: 1fr; } }
    .wide { grid-column: 1 / -1; }
    /* чек-лист «как попасть на этап» */
    .ck { display: grid; gap: 14px; margin-bottom: 24px; }
    .ck-head { display: flex; align-items: baseline; justify-content: space-between; gap: 12px; }
    .ck-head .h { margin: 0; }
    .ck-count { color: var(--primary); }
    .ck-bar { height: 3px; border-radius: 2px; background: var(--surface-3); overflow: hidden; }
    .ck-bar i { display: block; height: 100%; background: var(--primary); box-shadow: 0 0 10px var(--primary-glow); transition: width 600ms var(--ease-out); }
    .ck-steps { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 10px; }
    .ck-steps button {
      width: 100%; height: 100%; display: flex; gap: 10px; align-items: flex-start; text-align: left; padding: 12px;
      border: 1px solid var(--hairline); border-radius: var(--r-md); background: var(--surface-2); color: var(--ink); font: inherit; cursor: pointer;
      transition: border-color var(--fast), background-color var(--fast);
      &:disabled { cursor: default; }
      &:hover:not(:disabled) { border-color: var(--primary); }
    }
    .ck-dot {
      flex: none; display: grid; place-items: center; width: 26px; height: 26px; border-radius: 50%;
      border: 1px solid var(--hairline-strong); font: 600 12px var(--mono); color: var(--ink-muted);
    }
    .ck-text { display: grid; gap: 2px; min-width: 0; }
    .ck-text b { font-size: 14px; font-weight: 600; }
    .ck-text small { font-size: 12px; color: var(--ink-subtle); line-height: 1.35; }
    .ck-steps .done button { opacity: 0.7; }
    .ck-steps .done .ck-dot, .ck-ready .ck-dot { border-color: var(--primary); background: var(--primary); color: var(--on-primary); }
    .ck-steps .now button { border-color: var(--primary); background: rgba(var(--accent-rgb), 0.08); box-shadow: 0 0 20px -10px var(--primary-glow); }
    .ck-steps .now .ck-dot { border-color: var(--primary); color: var(--primary); animation: ck-pulse 1.8s ease-in-out infinite; }
    @keyframes ck-pulse { 50% { box-shadow: 0 0 0 5px rgba(var(--accent-rgb), 0.18); } }
    .ck-ready { display: flex; align-items: center; gap: 12px; margin-bottom: 24px; padding-top: 14px; padding-bottom: 14px; }
    /* поле, к которому привёл чек-лист, коротко подсвечивается */
    :host ::ng-deep .ck-flash { animation: ck-flash 1.4s ease-out; }
    @keyframes ck-flash { 0%, 30% { box-shadow: 0 0 0 2px var(--primary), 0 0 30px -6px var(--primary-glow); } }
    @media (max-width: 860px) { .ck-steps { grid-template-columns: 1fr 1fr; } }
    @media (max-width: 480px) { .ck-steps { grid-template-columns: 1fr; } }
    @media (prefers-reduced-motion: reduce) { .ck-steps .now .ck-dot { animation: none; } }
    /* Discord: подсвечен, пока ник не указан — без него не записаться на этап */
    .dc { display: grid; grid-template-columns: 1fr minmax(260px, 380px); gap: 12px 24px; align-items: center; margin-bottom: 24px; }
    .dc.need { border-color: var(--warning); box-shadow: 0 0 24px -12px var(--warning); }
    .dc .h { margin: 0 0 4px; }
    .dc-hint { margin: 0; font-size: 13px; }
    .dc-row { display: flex; gap: 8px; }
    .dc-row .input { flex: 1; min-width: 0; }
    .dc .hint { grid-column: 1 / -1; margin: 0; }
    .ok { color: var(--primary); }
    @media (max-width: 700px) { .dc { grid-template-columns: 1fr; } }
    .fit { justify-self: start; }
    .warn { color: var(--warning); }
    /* свёрнутый номер: заголовок / наклейка на всю свободную высоту / подсказка с кнопкой */
    .numcard.view { grid-template-rows: auto 1fr auto; align-content: stretch; }
    .decal {
      position: relative; display: flex; align-items: baseline; justify-content: center; min-height: 120px;
      align-self: stretch; place-content: center; border-radius: var(--r-lg);
      border: 1px solid rgba(var(--accent-rgb), 0.25);
      background: radial-gradient(60% 80% at 50% 50%, rgba(var(--accent-rgb), 0.16), transparent 70%), var(--surface-2);
      font-family: 'Russo One', var(--font); color: var(--primary); text-shadow: 0 0 28px var(--primary-glow);
    }
    .hash { font-size: 40px; opacity: 0.6; margin-right: 4px; align-self: center; }
    .digits { font-size: 96px; line-height: 1; align-self: center; letter-spacing: 0.02em; }
    .decal.lock { border-color: var(--hairline-strong); }
    .lockmark { position: absolute; top: 12px; right: 14px; font-size: 18px; text-shadow: none; }
    .numfoot { display: flex; align-items: center; justify-content: space-between; gap: 16px; }
    .numfoot p { margin: 0; font-size: 14px; }
    .numfoot .btn { flex-shrink: 0; }
    @media (max-width: 560px) { .numfoot { flex-direction: column; align-items: flex-start; } }
    .protests { display: block; margin-top: 24px; }
    .protests:empty { display: none; }
    .two { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
    /* «О себе»: поля делят высоту карточки поровну, длинный текст прокручивается внутри */
    .about { grid-template-rows: auto 1fr 1fr auto; align-content: stretch; }
    .bio { position: relative; grid-template-rows: auto 1fr; }
    .bio textarea { height: 100%; min-height: 96px; resize: none; overflow-y: auto; padding-bottom: 26px; }
    .count { position: absolute; right: 12px; bottom: 8px; font-size: 11px; color: var(--ink-tertiary); pointer-events: none; }

    /* Сохранение — плавающая капсула по центру снизу, как острова шапки */
    .savebar {
      position: sticky; bottom: 20px; z-index: 5;
      justify-self: center; width: fit-content; max-width: 100%;
      display: flex; flex-wrap: wrap; align-items: center; justify-content: center; gap: 12px;
      padding: 8px 8px 8px 20px;
      border: 1px solid var(--hairline); border-radius: var(--r-pill);
      background: var(--glass-strong); backdrop-filter: blur(14px);
      transition: border-color var(--base), box-shadow var(--base);
    }
    .savebar:not(.on) { padding: 10px 20px; }
    .savebar.on {
      border-color: rgba(var(--accent-rgb), 0.6);
      box-shadow: 0 0 0 1px rgba(var(--accent-rgb), 0.2), 0 10px 40px rgba(0, 0, 0, 0.6), 0 0 32px var(--primary-glow);
      animation: rise 300ms var(--ease-out) both;
    }
    .savebar.err { border-color: rgba(255, 92, 92, 0.6); }
    .savebar .btn { border-radius: var(--r-pill); }
    .sb-text { display: inline-flex; align-items: center; gap: 8px; font-size: 14px; color: var(--ink); }
    .sb-dot { width: 8px; height: 8px; border-radius: 50%; background: var(--warning); box-shadow: 0 0 8px var(--warning); }
    .stack { display: grid; gap: 18px; }
    .h { font-size: 20px; }
    label { display: grid; gap: 6px; }
    .lbl { font-size: 13px; color: var(--ink-muted); }
    .hint { font-size: 13px; }
    .ok { color: var(--primary); }
    .bad { color: var(--error); }
    .row { display: flex; flex-wrap: wrap; align-items: center; gap: 12px; }
    .small { font-size: 14px; margin: -8px 0 0; }

    .livery {
      aspect-ratio: 16 / 9;
      border-radius: var(--r-lg);
      overflow: hidden;
      background: var(--surface-2);
      display: grid;
      place-items: center;
      img { width: 100%; height: 100%; object-fit: cover; }
    }
    .livery.empty { border: 1px dashed var(--hairline-strong); }
    .file {
      position: relative;
      input { position: absolute; inset: 0; opacity: 0; cursor: pointer; }
      &:has(input:focus-visible) { box-shadow: 0 0 0 3px var(--primary-glow); }
    }

    .guest { display: grid; gap: 16px; justify-items: start; max-width: 520px; }
  `,
})
export class Me {
  protected auth = inject(Auth);
  private router = inject(Router);

  protected readonly cars = CARS;
  protected readonly proto = CAR_PROTOTYPES;
  /** выбор номера раскрыт: нажали «Сменить номер» или номера ещё нет */
  protected readonly editNumber = signal(false);
  protected pickingNumber() {
    return !this.numberLocked() && (this.editNumber() || !this.auth.profile()?.start_number);
  }
  protected cancelNumber() {
    this.number.set(this.auth.profile()?.start_number ?? null);
    this.editNumber.set(false);
  }
  protected readonly engines = ENGINES;
  protected readonly gearboxes = GEARBOXES;
  protected readonly number = signal<number | null>(null);
  protected car = '';
  protected engine = '';
  protected gearbox = '';
  protected power: number | null = null;
  protected bioRu = '';
  protected bioEn = '';
  protected discord = '';
  protected readonly dcSaving = signal(false);
  protected readonly dcMsg = signal<{ ok: boolean; text: string } | null>(null);
  /** занятые номера: номер → ник (кроме своего) */
  protected readonly taken = signal(new Map<number, string>());
  protected readonly saving = signal(false);
  protected readonly saved = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly uploading = signal(false);
  protected readonly uploadError = signal<string | null>(null);
  private readonly transloco = inject(TranslocoService);
  protected readonly runs = signal<SkillRun[]>([]);
  protected readonly team = signal<string | null>(null);
  protected readonly wins = signal(0);
  /** id активного сезона */
  private readonly seasonId = signal<number | null>(null);
  /** пилот уже записывался на этап активного сезона — номер меняет только админ (0011) */
  protected readonly numberLocked = signal(false);

  /** запись на этап с открытой регистрацией: registered — записан, open — регистрация идёт, но не записан, closed — нет открытых этапов */
  protected readonly tickets = signal<Ticket[]>([]);
  private readonly tracks = signal<string[]>([]);
  /** трассы опубликованных этапов, где тикета ещё нет */
  protected readonly lockedTracks = computed(() => {
    const own = new Set(this.tickets().map((t) => t.track.toLowerCase()));
    return this.tracks().filter((t) => !own.has(t.toLowerCase()));
  });
  protected readonly regState = signal<'registered' | 'open' | 'closed' | null>(null);
  async loadReg(id: string) {
    const [open, mine] = await Promise.all([
      supabase.from('stages').select('id', { count: 'exact', head: true }).eq('status', 'registration'),
      supabase
        .from('registrations')
        .select('stage_id, stage:stages!inner(status)', { count: 'exact', head: true })
        .eq('profile_id', id)
        .eq('status', 'registered')
        .eq('stage.status', 'registration'),
    ]);
    this.regState.set(mine.count ? 'registered' : open.count ? 'open' : 'closed');
  }
  /** шаги чек-листа: Steam → номер → Discord → запись */
  protected readonly steps = computed(() => {
    const p = this.auth.profile();
    const reg = this.regState();
    return [
      { k: 'steam', done: /^\d{17}$/.test(p?.steam_id ?? ''), target: null },
      { k: 'number', done: !!p?.start_number, target: 'num' },
      { k: 'discord', done: !!p?.discord, target: 'discord' },
      { k: reg === 'closed' ? 'stageClosed' : 'stage', done: reg === 'registered', target: reg === 'open' ? 'signup' : null },
    ];
  });
  protected readonly checkDone = computed(() => this.steps().filter((s) => s.done).length);
  protected readonly nextStep = computed(() => this.steps().find((s) => !s.done)?.k ?? null);
  protected goTo(id: string | null) {
    const el = id && document.getElementById(id);
    if (!el) return;
    el.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'center' });
    el.classList.remove('ck-flash');
    void el.offsetWidth; // перезапуск подсветки
    el.classList.add('ck-flash');
    el.querySelector<HTMLElement>('input, button')?.focus({ preventScroll: true });
  }

  async loadLock(id: string) {
    const season = this.seasonId();
    if (!season) return this.numberLocked.set(false);
    const { count } = await supabase
      .from('registrations')
      .select('stage_id, stage:stages!inner(season_id)', { count: 'exact', head: true })
      .eq('profile_id', id)
      .eq('stage.season_id', season);
    this.numberLocked.set(!!count && !!this.auth.profile()?.start_number);
  }
  /** «Сохранить» активна, только если что-то изменилось */
  protected dirty() {
    const p = this.auth.profile();
    if (!p) return false;
    const t = (s: string) => s.trim() || null;
    return (
      this.number() !== p.start_number ||
      t(this.car) !== p.car ||
      t(this.engine) !== p.engine ||
      t(this.gearbox) !== p.gearbox ||
      (this.power || null) !== p.power_hp ||
      t(this.bioRu) !== p.bio_ru ||
      t(this.bioEn) !== p.bio_en
    );
  }

  constructor() {
    // Заполнить форму, когда профиль загрузился
    effect(() => {
      const p = this.auth.profile();
      if (!p) return;
      this.resetForm();
      this.loadTaken(p.id);
    });
    // id пилота не меняется — витрину грузим один раз на пилота
    effect(() => {
      const id = this.auth.profile()?.id;
      if (id) this.loadShowcase(id);
    });
  }

  /** форма = сохранённый профиль (при загрузке и по «Отменить») */
  protected resetForm() {
    const p = this.auth.profile();
    if (!p) return;
    this.number.set(p.start_number);
    this.car = p.car ?? '';
    this.engine = p.engine ?? '';
    this.gearbox = p.gearbox ?? '';
    this.power = p.power_hp;
    this.bioRu = p.bio_ru ?? '';
    this.bioEn = p.bio_en ?? '';
    this.discord = p.discord ?? '';
    this.editNumber.set(false);
    this.error.set(null);
  }

  private loadedFor?: string;
  private async loadShowcase(id: string) {
    if (this.loadedFor === id) return;
    this.loadedFor = id;
    const seasons = await publicSeasons();
    const season = seasons.find((s) => s.status === 'active') ?? null;
    this.seasonId.set(season?.id ?? null);
    this.loadLock(id);
    this.loadReg(id);
    Promise.all([loadTickets(id), loadTracks()]).then(([t, tracks]) => {
      this.tickets.set(t);
      this.tracks.set(tracks);
    });
    const [runs, wins, member] = await Promise.all([
      loadSkillRuns(id),
      supabase.from('stage_results').select('stage_id', { count: 'exact', head: true }).eq('profile_id', id).eq('stage_place', 1),
      season ? supabase.from('team_members').select('team:teams(name)').eq('season_id', season.id).eq('profile_id', id).eq('status', 'approved').maybeSingle() : Promise.resolve({ data: null }),
    ]);
    this.runs.set(runs);
    this.wins.set(wins.count ?? 0);
    this.team.set((member.data as { team: { name: string } | null } | null)?.team?.name ?? null);
  }

  private async loadTaken(myId: string) {
    const { data } = await supabase.from('profiles').select('id, start_number, nickname').not('start_number', 'is', null);
    this.taken.set(new Map((data ?? []).filter((r) => r.id !== myId).map((r) => [r.start_number, r.nickname])));
  }

  async save() {
    const me = this.auth.profile();
    if (!me) return;
    this.saving.set(true);
    this.saved.set(false);
    this.error.set(null);
    const text = (s: string) => s.trim() || null;
    const { error } = await supabase
      .from('profiles')
      .update({
        start_number: this.number(),
        car: text(this.car),
        engine: text(this.engine),
        gearbox: text(this.gearbox),
        power_hp: this.power || null,
        bio_ru: text(this.bioRu),
        bio_en: text(this.bioEn),
      })
      .eq('id', me.id);
    this.saving.set(false);
    if (error) {
      // 23505 — номер успели занять, пока пилот выбирал
      if (error.code === '23505') {
        this.loadTaken(me.id);
        return this.error.set(this.transloco.translate('me.numberTaken'));
      }
      return this.error.set(error.message);
    }
    await this.auth.reload();
    this.editNumber.set(false);
    this.saved.set(true);
  }

  async saveDiscord() {
    const me = this.auth.profile();
    const nick = this.discord.trim();
    if (!me) return;
    if (nick.length < 2) return this.dcMsg.set({ ok: false, text: this.transloco.translate('me.discordShort') });
    this.dcSaving.set(true);
    const { error } = await supabase.from('pilot_contacts').upsert({ profile_id: me.id, discord: nick, updated_at: new Date().toISOString() });
    this.dcSaving.set(false);
    if (error) return this.dcMsg.set({ ok: false, text: error.message });
    await this.auth.reload();
    this.dcMsg.set({ ok: true, text: this.transloco.translate('me.allSaved') });
  }

  async upload(e: Event) {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    const me = this.auth.profile();
    if (!file || !me) return;
    if (!confirm(this.transloco.translate('rules.contentConfirm'))) return;
    this.uploading.set(true);
    this.uploadError.set(null);
    try {
      const blob = await compressImage(file);
      const path = `${me.id}/livery.webp`;
      const { error } = await supabase.storage.from('liveries').upload(path, blob, { upsert: true, contentType: 'image/webp' });
      if (error) throw error;
      // ?v= — чтобы браузер не показывал старую картинку из кэша
      const url = `${supabase.storage.from('liveries').getPublicUrl(path).data.publicUrl}?v=${Date.now()}`;
      const { error: upd } = await supabase.from('profiles').update({ livery_url: url }).eq('id', me.id);
      if (upd) throw upd;
      await this.auth.reload();
    } catch (err) {
      this.uploadError.set((err as Error).message ?? String(err));
    } finally {
      this.uploading.set(false);
    }
  }

  async logout() {
    await this.auth.logout();
    this.router.navigateByUrl('/');
  }
}
