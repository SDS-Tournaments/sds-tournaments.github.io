import { Component, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { supabase } from '../auth';
import { compressImage } from '../image';

interface Sponsor {
  id: number;
  name: string;
  logo_url: string | null;
  url: string | null;
  tier: 'general' | 'partner';
  active: boolean;
  on_overlay: boolean;
  sort: number;
  starts_at: string | null;
  ends_at: string | null;
}

// Спонсоры: генеральный и партнёры, логотип, показ на сайте и на стриме. Только admin.
@Component({
  selector: 'app-admin-sponsors',
  imports: [FormsModule],
  template: `
    <header class="top">
      <h1 class="display-md">Спонсоры</h1>
      <button class="btn btn-primary" (click)="add()" [disabled]="busy()">+ Спонсор</button>
    </header>
    <p class="muted small">Генеральный — крупно на главной, в подвале и первым на стриме. Неактивные нигде не показываются. Логотип лучше PNG/SVG с прозрачным фоном.</p>
    @if (msg()) { <p [class]="ok() ? 'ok' : 'bad'">{{ msg() }}</p> }

    <div class="list">
      @for (s of sponsors(); track s.id) {
        <article class="card sp" [class.off]="!s.active">
          <label class="logo" [style.background-image]="s.logo_url ? 'url(' + s.logo_url + ')' : null" title="Загрузить логотип">
            @if (!s.logo_url) { <span>+ лого</span> }
            <input type="file" accept="image/png,image/webp,image/svg+xml,image/jpeg" (change)="upload($event, s)" />
          </label>
          <div class="fields">
            <input class="input name" [(ngModel)]="s.name" placeholder="Название" />
            <input class="input" [(ngModel)]="s.url" placeholder="https://сайт-спонсора" />
            <div class="opts">
              <select class="input" [(ngModel)]="s.tier">
                <option value="general">Генеральный</option>
                <option value="partner">Партнёр</option>
              </select>
              <label class="chk"><input type="checkbox" [(ngModel)]="s.active" /> Активен</label>
              <label class="chk"><input type="checkbox" [(ngModel)]="s.on_overlay" /> На стриме</label>
              <label class="num">Порядок <input class="input mono" type="number" [(ngModel)]="s.sort" /></label>
            </div>
          </div>
          <div class="acts">
            <button class="btn btn-primary" (click)="save(s)" [disabled]="busy()">Сохранить</button>
            <button class="btn btn-ghost danger" (click)="remove(s)" [disabled]="busy()">Удалить</button>
          </div>
        </article>
      } @empty {
        <p class="subtle">Спонсоров пока нет.</p>
      }
    </div>
  `,
  styles: `
    .top { display: flex; justify-content: space-between; align-items: center; gap: 16px; margin-bottom: 8px; }
    .small { font-size: 14px; margin: 0 0 20px; }
    .list { display: grid; gap: 16px; }
    .sp { display: grid; grid-template-columns: 140px 1fr auto; gap: 20px; align-items: center; }
    @media (max-width: 860px) { .sp { grid-template-columns: 1fr; } }
    .sp.off { opacity: 0.55; }
    .logo {
      position: relative; display: grid; place-items: center; height: 90px; border: 1px dashed var(--hairline-strong); border-radius: var(--r-md);
      background: var(--surface-2) center / contain no-repeat; background-origin: content-box; padding: 10px; cursor: pointer; color: var(--ink-subtle); font-size: 13px;
      &:hover { border-color: var(--primary); }
      input { position: absolute; inset: 0; opacity: 0; cursor: pointer; }
    }
    .fields { display: grid; gap: 8px; }
    .name { font-weight: 600; }
    .opts { display: flex; flex-wrap: wrap; gap: 12px; align-items: center; select { width: auto; } }
    .chk { display: flex; gap: 6px; align-items: center; font-size: 14px; color: var(--ink-muted); input { accent-color: var(--primary); } }
    .num { display: flex; gap: 6px; align-items: center; font-size: 13px; color: var(--ink-muted); input { width: 72px; min-height: 36px; } }
    .acts { display: grid; gap: 6px; }
    .danger { color: var(--error); }
    .ok { color: var(--primary); }
    .bad { color: var(--error); }
  `,
})
export class AdminSponsors implements OnInit {
  protected readonly sponsors = signal<Sponsor[]>([]);
  protected readonly busy = signal(false);
  protected readonly msg = signal<string | null>(null);
  protected readonly ok = signal(true);

  async ngOnInit() {
    await this.load();
  }

  private async load() {
    const { data } = await supabase.from('sponsors').select('*').order('tier').order('sort');
    this.sponsors.set((data ?? []) as Sponsor[]);
  }

  private note(text: string, ok: boolean) {
    this.msg.set(text);
    this.ok.set(ok);
  }

  async add() {
    this.busy.set(true);
    const { error } = await supabase.from('sponsors').insert({ name: 'Новый спонсор', tier: 'partner', active: false, sort: this.sponsors().length });
    this.busy.set(false);
    if (error) return this.note(error.message, false);
    await this.load();
  }

  async save(s: Sponsor) {
    this.busy.set(true);
    const { error } = await supabase
      .from('sponsors')
      .update({ name: s.name.trim(), url: s.url?.trim() || null, tier: s.tier, active: s.active, on_overlay: s.on_overlay, sort: s.sort })
      .eq('id', s.id);
    this.busy.set(false);
    this.note(error ? error.message : `«${s.name}» сохранён`, !error);
    if (!error) await this.load();
  }

  async remove(s: Sponsor) {
    if (!confirm(`Удалить спонсора «${s.name}»?`)) return;
    this.busy.set(true);
    const { error } = await supabase.from('sponsors').delete().eq('id', s.id);
    this.busy.set(false);
    if (error) return this.note(error.message, false);
    await this.load();
  }

  async upload(e: Event, s: Sponsor) {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    this.busy.set(true);
    try {
      // SVG оставляем как есть — он и так лёгкий и чёткий
      const isSvg = file.type === 'image/svg+xml';
      const blob = isSvg ? file : await compressImage(file, 600, 200_000);
      const path = `${s.id}/logo.${isSvg ? 'svg' : 'webp'}`;
      const up = await supabase.storage.from('sponsors').upload(path, blob, { upsert: true, contentType: isSvg ? 'image/svg+xml' : 'image/webp' });
      if (up.error) throw up.error;
      const url = `${supabase.storage.from('sponsors').getPublicUrl(path).data.publicUrl}?v=${Date.now()}`;
      const { error } = await supabase.from('sponsors').update({ logo_url: url }).eq('id', s.id);
      if (error) throw error;
      await this.load();
      this.note('Логотип загружен', true);
    } catch (err) {
      this.note((err as Error).message, false);
    } finally {
      this.busy.set(false);
    }
  }
}
