import { DatePipe } from '@angular/common';
import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Auth, supabase } from '../auth';

interface Pilot {
  id: string;
  steam_id: string;
  nickname: string;
  avatar_url: string | null;
  start_number: number | null;
  role: 'admin' | 'staff' | 'pilot';
}
interface Sanction {
  id: number;
  profile_id: string;
  type: 'warning' | 'dq' | 'ban';
  reason: string;
  created_at: string;
  stage: { title_ru: string } | null;
}

const TYPE: Record<Sanction['type'], string> = { warning: 'Предупреждение', dq: 'Дисквалификация с этапа', ban: 'Бан на турниры SDS' };

// Пилоты: роли, стартовые номера, санкции (регламент 1.6). Роли и номера меняет admin, санкции выдают admin/staff.
@Component({
  selector: 'app-admin-pilots',
  imports: [FormsModule, RouterLink, DatePipe],
  template: `
    <header class="top">
      <h1 class="display-md">Пилоты и санкции</h1>
      <div class="tools">
        <input class="input search" type="search" placeholder="Ник или номер…" [(ngModel)]="query" (ngModelChange)="q.set($event)" />
        @if (isAdmin()) { <button class="btn btn-ghost danger" (click)="removeAll()" [disabled]="busy()">Удалить всех пилотов</button> }
      </div>
    </header>
    @if (msg()) { <p [class]="ok() ? 'ok' : 'bad'">{{ msg() }}</p> }

    <div class="list">
      @for (p of shown(); track p.id) {
        @let ss = sanctionsOf(p.id);
        <article class="card pilot" [class.banned]="isBanned(p.id)">
          <div class="row">
            @if (p.avatar_url) { <img [src]="p.avatar_url" alt="" width="40" height="40" /> } @else { <span class="ph">{{ p.nickname[0] }}</span> }
            <a class="nick" [routerLink]="['/pilots', p.steam_id]" target="_blank">{{ p.nickname }}</a>
            @if (isBanned(p.id)) { <span class="badge ban">БАН</span> }
            @else if (ss.length) { <span class="badge warn">санкций: {{ ss.length }}</span> }
            <label class="num">№ <input class="input mono" type="number" min="1" max="999" [ngModel]="p.start_number" (change)="setNumber(p, $any($event.target).value)" [disabled]="!isAdmin()" /></label>
            <select class="input role" [ngModel]="p.role" (ngModelChange)="setRole(p, $event)" [disabled]="!isAdmin() || p.id === me()">
              <option value="pilot">Пилот</option>
              <option value="staff">Судья / штаб</option>
              <option value="admin">Организатор</option>
            </select>
            <button class="btn btn-ghost" (click)="open.set(open() === p.id ? null : p.id)">{{ open() === p.id ? 'Скрыть' : 'Санкции' }}</button>
            @if (isAdmin() && p.role === 'pilot') { <button class="btn btn-ghost danger" (click)="remove(p)" [disabled]="busy()" title="Удалить пилота">Удалить</button> }
          </div>

          @if (open() === p.id) {
            <div class="sanctions">
              @for (s of ss; track s.id) {
                <div class="s" [class]="s.type">
                  <b>{{ type[s.type] }}</b>
                  <span class="subtle">{{ s.created_at | date: 'dd.MM.yyyy' }}@if (s.stage) { · {{ s.stage.title_ru }} }</span>
                  <p>{{ s.reason }}</p>
                  @if (isAdmin()) { <button class="x" title="Снять санкцию" (click)="removeSanction(s)">✕</button> }
                </div>
              } @empty {
                <p class="subtle">Санкций нет.</p>
              }
              <form class="add" (ngSubmit)="addSanction(p)">
                <select class="input" name="t" [(ngModel)]="form.type">
                  <option value="warning">Предупреждение</option>
                  <option value="dq">Дисквалификация с этапа</option>
                  <option value="ban">Бан на турниры SDS</option>
                </select>
                <select class="input" name="st" [(ngModel)]="form.stageId">
                  <option [ngValue]="null">— без этапа —</option>
                  @for (st of stages(); track st.id) { <option [ngValue]="st.id">{{ st.title_ru }}</option> }
                </select>
                <input class="input reason" name="r" placeholder="Причина (видна штабу)" required [(ngModel)]="form.reason" />
                <button class="btn btn-primary" type="submit" [disabled]="busy() || !form.reason.trim()">Выдать</button>
              </form>
              @if (form.type === 'ban') { <p class="warn">Бан закрывает пилоту регистрацию на все этапы SDS.</p> }
            </div>
          }
        </article>
      }
    </div>
  `,
  styles: `
    .top { display: flex; flex-wrap: wrap; gap: 16px; justify-content: space-between; align-items: center; margin-bottom: 20px; }
    .tools { display: flex; flex-wrap: wrap; gap: 8px; }
    .search { width: min(100%, 300px); }
    .danger { color: var(--error); }
    .list { display: grid; gap: 8px; }
    .pilot { padding: 12px 16px; }
    .pilot.banned { border-color: var(--error); }
    .row { display: flex; flex-wrap: wrap; gap: 12px; align-items: center; }
    .row img, .ph { width: 40px; height: 40px; border-radius: 50%; flex-shrink: 0; }
    .ph { display: grid; place-items: center; background: var(--surface-3); color: var(--primary); font-weight: 600; }
    .nick { flex: 1; min-width: 120px; color: var(--ink); font-weight: 500; background: none; }
    .badge.ban { background: rgba(255, 92, 92, 0.15); color: var(--error); }
    .badge.warn { background: rgba(245, 185, 66, 0.15); color: var(--warning); }
    .num { display: flex; gap: 6px; align-items: center; color: var(--ink-subtle); font-size: 13px; input { width: 80px; min-height: 38px; } }
    .role { width: auto; min-height: 38px; }
    .sanctions { display: grid; gap: 8px; margin-top: 14px; padding-top: 14px; border-top: 1px solid var(--hairline); }
    .s { position: relative; padding: 10px 40px 10px 14px; border-radius: var(--r-sm); background: var(--surface-2); border-left: 3px solid var(--warning); }
    .s.dq { border-left-color: #ff9d5c; }
    .s.ban { border-left-color: var(--error); }
    .s b { margin-right: 8px; }
    .s p { margin: 4px 0 0; font-size: 14px; color: var(--ink-muted); }
    .x { position: absolute; right: 10px; top: 10px; border: 0; background: none; color: var(--ink-tertiary); cursor: pointer; &:hover { color: var(--error); } }
    .add { display: flex; flex-wrap: wrap; gap: 8px; select { width: auto; } }
    .reason { flex: 1; min-width: 200px; }
    .warn { margin: 0; font-size: 13px; color: var(--warning); }
    .ok { color: var(--primary); }
    .bad { color: var(--error); }
  `,
})
export class AdminPilots implements OnInit {
  private readonly auth = inject(Auth);
  protected readonly isAdmin = computed(() => this.auth.profile()?.role === 'admin');
  protected readonly me = computed(() => this.auth.profile()?.id);
  protected readonly pilots = signal<Pilot[]>([]);
  protected readonly sanctions = signal<Sanction[]>([]);
  protected readonly stages = signal<{ id: number; title_ru: string }[]>([]);
  protected readonly open = signal<string | null>(null);
  protected readonly busy = signal(false);
  protected readonly msg = signal<string | null>(null);
  protected readonly ok = signal(true);
  protected readonly type = TYPE;
  protected query = '';
  protected readonly q = signal('');
  protected form: { type: Sanction['type']; stageId: number | null; reason: string } = { type: 'warning', stageId: null, reason: '' };
  protected readonly shown = computed(() => {
    const q = this.q().trim().toLowerCase();
    return q ? this.pilots().filter((p) => p.nickname.toLowerCase().includes(q) || String(p.start_number ?? '').startsWith(q)) : this.pilots();
  });

  async ngOnInit() {
    await this.load();
  }

  private async load() {
    const [p, s, st] = await Promise.all([
      supabase.from('profiles').select('id, steam_id, nickname, avatar_url, start_number, role').order('nickname'),
      supabase.from('sanctions').select('id, profile_id, type, reason, created_at, stage:stages(title_ru)').order('created_at', { ascending: false }),
      supabase.from('stages').select('id, title_ru').order('id', { ascending: false }),
    ]);
    this.pilots.set((p.data ?? []) as Pilot[]);
    this.sanctions.set((s.data ?? []) as unknown as Sanction[]);
    this.stages.set(st.data ?? []);
  }

  protected sanctionsOf(id: string) {
    return this.sanctions().filter((s) => s.profile_id === id);
  }
  protected isBanned(id: string) {
    return this.sanctions().some((s) => s.profile_id === id && s.type === 'ban');
  }

  private async run(q: PromiseLike<{ error: { message: string; code?: string } | null }>, done: string) {
    this.busy.set(true);
    const { error } = await q;
    this.busy.set(false);
    this.msg.set(error ? (error.code === '23505' ? 'Этот номер уже занят другим пилотом' : error.message) : done);
    this.ok.set(!error);
    await this.load();
    return !error;
  }

  setRole(p: Pilot, role: Pilot['role']) {
    if (!confirm(`${p.nickname}: сменить роль на «${{ pilot: 'Пилот', staff: 'Судья / штаб', admin: 'Организатор' }[role]}»?`)) return this.load();
    return this.run(supabase.from('profiles').update({ role }).eq('id', p.id), `${p.nickname}: роль изменена`);
  }

  setNumber(p: Pilot, value: string) {
    const n = value === '' ? null : Number(value);
    return this.run(supabase.from('profiles').update({ start_number: n }).eq('id', p.id), `${p.nickname}: номер ${n ?? 'снят'}`);
  }

  async addSanction(p: Pilot) {
    if (this.form.type === 'ban' && !confirm(`Забанить ${p.nickname} на всех турнирах SDS?`)) return;
    const ok = await this.run(
      supabase.from('sanctions').insert({ profile_id: p.id, stage_id: this.form.stageId, type: this.form.type, reason: this.form.reason.trim() }),
      `${p.nickname}: ${TYPE[this.form.type].toLowerCase()}`,
    );
    if (ok) this.form = { type: 'warning', stageId: null, reason: '' };
  }

  /** Удаление аккаунта (edge-функция test-pilots): уходят профиль, заявки, оценки, результаты и санкции */
  private async invoke(body: object, done: (d: { deleted: number }) => string) {
    this.busy.set(true);
    const { data, error } = await supabase.functions.invoke('test-pilots', { body });
    this.busy.set(false);
    // текст ошибки функции лежит в теле ответа
    const msg = error ? ((await error.context?.json?.().catch(() => null))?.error ?? error.message) : done(data);
    this.msg.set(msg);
    this.ok.set(!error);
    await this.load();
  }

  remove(p: Pilot) {
    const banned = this.isBanned(p.id) ? '\nВнимание: у пилота бан — после удаления он сможет зайти заново уже без бана.' : '';
    if (!confirm(`Удалить пилота ${p.nickname} навсегда?\nПропадут его профиль, номер, заявки, оценки, результаты и санкции. Отменить нельзя.${banned}`)) return;
    return this.invoke({ action: 'remove', profileId: p.id }, () => `${p.nickname} удалён`);
  }

  removeAll() {
    const n = this.pilots().filter((p) => p.role === 'pilot').length;
    const typed = prompt(`Удалить ВСЕХ пилотов (${n})? Штаб и организаторы останутся.\nПропадут профили, номера, заявки, оценки, результаты и санкции. Отменить нельзя.\n\nЧтобы подтвердить, введите УДАЛИТЬ`);
    if (typed?.trim().toUpperCase() !== 'УДАЛИТЬ') return;
    return this.invoke({ action: 'remove-all' }, (d) => `Удалено пилотов: ${d.deleted}`);
  }

  removeSanction(s: Sanction) {
    if (!confirm(`Снять санкцию «${TYPE[s.type]}»?`)) return;
    return this.run(supabase.from('sanctions').delete().eq('id', s.id), 'Санкция снята');
  }
}
