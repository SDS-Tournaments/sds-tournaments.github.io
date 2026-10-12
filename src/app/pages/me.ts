import { Component, effect, inject, signal } from '@angular/core';
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
import { publicSeasons } from '../data/standings';
import { SkillRun } from '../scoring/scoring';
import { StageSignup } from '../components/stage-signup';
import { compressImage } from '../image';

// Личный кабинет пилота (шаг 2.2). Регистрация на этап и команда — шаги 3.3–3.4.
@Component({
  selector: 'app-me',
  imports: [FormsModule, TranslocoPipe, NumberPicker, StageSignup, MyTeam, MyProtests, Loader, PilotShowcase, ContentRules],
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

        <!-- 2. Сезон: главные действия — запись на этап и команда -->
        <p class="eyebrow sec">{{ 'me.secSeason' | transloco }}</p>
        <div class="cols eq">
          <app-stage-signup class="card" [profileId]="me.id" [hasNumber]="!!me.start_number" [number]="me.start_number" [numberLocked]="numberLocked()" (changed)="loadLock(me.id)" />
          <app-my-team class="card" [profileId]="me.id" />
        </div>

        <!-- 3. Профиль пилота: номер, машина, о себе, ливрея -->
        <p class="eyebrow sec">{{ 'me.secProfile' | transloco }}</p>
        <form class="cols" (ngSubmit)="save()">
          <div class="card stack numcard" [class.wide]="pickingNumber()" [class.view]="!pickingNumber()">
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

          <div class="card stack">
            <h2 class="h">{{ 'me.about' | transloco }}</h2>
            <label>
              <span class="lbl">{{ 'me.bioRu' | transloco }}</span>
              <textarea class="input" name="bioRu" rows="3" maxlength="500" [(ngModel)]="bioRu"></textarea>
            </label>
            <label>
              <span class="lbl">{{ 'me.bioEn' | transloco }}</span>
              <textarea class="input" name="bioEn" rows="3" maxlength="500" [(ngModel)]="bioEn"></textarea>
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

          <div class="savebar wide">
            <button class="btn btn-primary" type="submit" [disabled]="saving() || !dirty()">
              {{ (saving() ? 'me.saving' : 'me.save') | transloco }}
            </button>
            @if (saved()) { <span class="hint ok">✓ {{ 'me.saved' | transloco }}</span> }
            @if (error()) { <span class="hint bad">{{ error() }}</span> }
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
      background: radial-gradient(60% 120% at 80% 0%, rgba(10, 186, 181, 0.25), transparent 70%), var(--surface-1);
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
    .fit { justify-self: start; }
    .warn { color: var(--warning); }
    /* свёрнутый номер: заголовок / наклейка на всю свободную высоту / подсказка с кнопкой */
    .numcard.view { grid-template-rows: auto 1fr auto; align-content: stretch; }
    .decal {
      position: relative; display: flex; align-items: baseline; justify-content: center; min-height: 120px;
      align-self: stretch; place-content: center; border-radius: var(--r-lg);
      border: 1px solid rgba(10, 186, 181, 0.25);
      background: radial-gradient(60% 80% at 50% 50%, rgba(10, 186, 181, 0.16), transparent 70%), var(--surface-2);
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
    .savebar {
      position: sticky;
      bottom: 16px;
      z-index: 5;
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 12px;
      padding: 12px 16px;
      border: 1px solid var(--hairline-strong);
      border-radius: var(--r-lg);
      background: rgba(10, 10, 10, 0.8);
      backdrop-filter: blur(10px);
    }
    .stack { display: grid; gap: 18px; }
    .h { font-size: 20px; }
    label { display: grid; gap: 6px; }
    .lbl { font-size: 13px; color: var(--ink-muted); }
    textarea { resize: none; height: 96px; overflow-y: auto; }
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
      this.number.set(p.start_number);
      this.car = p.car ?? '';
      this.engine = p.engine ?? '';
      this.gearbox = p.gearbox ?? '';
      this.power = p.power_hp;
      this.bioRu = p.bio_ru ?? '';
      this.bioEn = p.bio_en ?? '';
      this.loadTaken(p.id);
    });
    // id пилота не меняется — витрину грузим один раз на пилота
    effect(() => {
      const id = this.auth.profile()?.id;
      if (id) this.loadShowcase(id);
    });
  }

  private loadedFor?: string;
  private async loadShowcase(id: string) {
    if (this.loadedFor === id) return;
    this.loadedFor = id;
    const seasons = await publicSeasons();
    const season = seasons.find((s) => s.status === 'active') ?? null;
    this.seasonId.set(season?.id ?? null);
    this.loadLock(id);
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
