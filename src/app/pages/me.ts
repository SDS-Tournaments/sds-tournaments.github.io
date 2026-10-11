import { Component, effect, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { Auth, supabase } from '../auth';
import { compressImage } from '../image';

// Личный кабинет пилота (шаг 2.2). Регистрация на этап и команда — шаги 3.3–3.4.
@Component({
  selector: 'app-me',
  imports: [FormsModule, TranslocoPipe],
  template: `
    <section class="section container">
      @if (!auth.ready()) {
        <p class="muted">{{ 'common.loading' | transloco }}</p>
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
            </div>
            <button class="btn btn-ghost out" (click)="logout()">{{ 'auth.logout' | transloco }}</button>
          </div>
        </header>

        <div class="grid">
          <form class="card stack" (ngSubmit)="save()">
            <h2 class="h">{{ 'me.profile' | transloco }}</h2>

            <label>
              <span class="lbl">{{ 'me.number' | transloco }}</span>
              <input class="input mono" type="number" min="1" max="999" name="num" [(ngModel)]="number" (ngModelChange)="checkNumber()" />
              @switch (numberState()) {
                @case ('free') { <span class="hint ok">{{ 'me.numberFree' | transloco }}</span> }
                @case ('taken') { <span class="hint bad">{{ 'me.numberTaken' | transloco }}</span> }
                @case ('invalid') { <span class="hint bad">{{ 'me.numberInvalid' | transloco }}</span> }
                @default { <span class="hint subtle">{{ 'me.numberHint' | transloco }}</span> }
              }
            </label>

            <label>
              <span class="lbl">{{ 'me.bioRu' | transloco }}</span>
              <textarea class="input" name="bioRu" rows="3" maxlength="500" [(ngModel)]="bioRu"></textarea>
            </label>
            <label>
              <span class="lbl">{{ 'me.bioEn' | transloco }}</span>
              <textarea class="input" name="bioEn" rows="3" maxlength="500" [(ngModel)]="bioEn"></textarea>
            </label>

            <div class="row">
              <button class="btn btn-primary" type="submit" [disabled]="saving() || numberState() === 'taken' || numberState() === 'invalid'">
                {{ (saving() ? 'me.saving' : 'me.save') | transloco }}
              </button>
              @if (saved()) { <span class="hint ok">{{ 'me.saved' | transloco }}</span> }
              @if (error()) { <span class="hint bad">{{ error() }}</span> }
            </div>
          </form>

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
          </div>
        </div>
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
      margin-bottom: 24px;
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

    .grid {
      display: grid;
      gap: 24px;
      grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
      align-items: start;
    }
    .stack { display: grid; gap: 18px; }
    .h { font-size: 20px; }
    label { display: grid; gap: 6px; }
    .lbl { font-size: 13px; color: var(--ink-muted); }
    textarea { resize: vertical; }
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

  protected number: number | null = null;
  protected bioRu = '';
  protected bioEn = '';
  protected readonly numberState = signal<'idle' | 'free' | 'taken' | 'invalid'>('idle');
  protected readonly saving = signal(false);
  protected readonly saved = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly uploading = signal(false);
  protected readonly uploadError = signal<string | null>(null);
  private checkSeq = 0;

  constructor() {
    // Заполнить форму, когда профиль загрузился
    effect(() => {
      const p = this.auth.profile();
      if (!p) return;
      this.number = p.start_number;
      this.bioRu = p.bio_ru ?? '';
      this.bioEn = p.bio_en ?? '';
    });
  }

  async checkNumber() {
    this.saved.set(false);
    const n = this.number;
    const me = this.auth.profile();
    if (n === null || (n as unknown) === '') return this.numberState.set('idle');
    if (!Number.isInteger(n) || n < 1 || n > 999) return this.numberState.set('invalid');
    if (n === me?.start_number) return this.numberState.set('idle');
    const seq = ++this.checkSeq;
    const { count } = await supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('start_number', n);
    if (seq === this.checkSeq) this.numberState.set(count ? 'taken' : 'free');
  }

  async save() {
    const me = this.auth.profile();
    if (!me) return;
    this.saving.set(true);
    this.error.set(null);
    const n = this.number === null || (this.number as unknown) === '' ? null : this.number;
    const { error } = await supabase
      .from('profiles')
      .update({ start_number: n, bio_ru: this.bioRu.trim() || null, bio_en: this.bioEn.trim() || null })
      .eq('id', me.id);
    this.saving.set(false);
    if (error) {
      // 23505 — номер успели занять между проверкой и сохранением
      if (error.code === '23505') this.numberState.set('taken');
      return this.error.set(error.code === '23505' ? '' : error.message);
    }
    await this.auth.reload();
    this.numberState.set('idle');
    this.saved.set(true);
  }

  async upload(e: Event) {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    const me = this.auth.profile();
    if (!file || !me) return;
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
