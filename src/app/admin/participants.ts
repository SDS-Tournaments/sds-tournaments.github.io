import { CdkDrag, CdkDragDrop, CdkDragHandle, CdkDropList, CdkDropListGroup, moveItemInArray, transferArrayItem } from '@angular/cdk/drag-drop';
import { Component, input, isDevMode, OnInit, signal } from '@angular/core';
import { supabase } from '../auth';
import { assignGroups } from '../scoring/scoring';

interface Reg {
  profile_id: string;
  group_no: number | null;
  queue_order: number | null;
  created_at: string;
  profile: { nickname: string; start_number: number | null; avatar_url: string | null } | null;
  team: { name: string } | null;
}

// Участники этапа: группы по 10 и очередь квалификации (перетаскиванием)
@Component({
  selector: 'app-admin-participants',
  imports: [CdkDropListGroup, CdkDropList, CdkDrag, CdkDragHandle],
  template: `
    <section class="card stack">
      <header class="top">
        <h2 class="h">Участники <span class="count mono">{{ total() }}</span></h2>
        <div class="row">
          <button class="btn btn-secondary" (click)="split(false)" [disabled]="busy() || !total()">По 10, по порядку регистрации</button>
          <button class="btn btn-secondary" (click)="split(true)" [disabled]="busy() || !total()">🎲 Перемешать и по 10</button>
          <button class="btn btn-ghost" (click)="addGroup()" [disabled]="busy()">+ Группа</button>
          <button class="btn btn-ghost" (click)="load()" [disabled]="busy()">↻ Обновить</button>
        </div>
      </header>
      <p class="muted small">Перетаскивайте пилотов между группами и внутри группы — это порядок выезда в квалификации. Не забудьте сохранить.</p>

      <div class="groups" cdkDropListGroup>
        @if (unassigned().length) {
          <div class="group pool">
            <h3>Без группы <span class="mono subtle">{{ unassigned().length }}</span></h3>
            <ol cdkDropList [cdkDropListData]="unassigned()" (cdkDropListDropped)="drop($event)">
              @for (r of unassigned(); track r.profile_id) {
                <li cdkDrag class="pilot">
                  <span cdkDragHandle class="grip" aria-hidden="true">⋮⋮</span>
                  <span class="num mono">{{ r.profile?.start_number ?? '—' }}</span>
                  <span class="nick">{{ r.profile?.nickname }}</span>
                  @if (discord().get(r.profile_id); as d) { <span class="dc mono subtle" title="Discord">{{ d }}</span> } @else { <span class="nodc">нет DS</span> }
                  <span class="team subtle">{{ r.team?.name ?? '' }}</span>
                  <button class="x" title="Снять с этапа" (click)="withdraw(r)">✕</button>
                </li>
              }
            </ol>
          </div>
        }
        @for (g of groups(); track $index; let gi = $index) {
          <div class="group">
            <h3>Группа {{ gi + 1 }} <span class="mono subtle">{{ g.length }}</span></h3>
            <ol cdkDropList [cdkDropListData]="g" (cdkDropListDropped)="drop($event)">
              @for (r of g; track r.profile_id) {
                <li cdkDrag class="pilot">
                  <span cdkDragHandle class="grip" aria-hidden="true">⋮⋮</span>
                  <span class="num mono">{{ r.profile?.start_number ?? '—' }}</span>
                  <span class="nick">{{ r.profile?.nickname }}</span>
                  @if (discord().get(r.profile_id); as d) { <span class="dc mono subtle" title="Discord">{{ d }}</span> } @else { <span class="nodc">нет DS</span> }
                  <span class="team subtle">{{ r.team?.name ?? '' }}</span>
                  <button class="x" title="Снять с этапа" (click)="withdraw(r)">✕</button>
                </li>
              } @empty {
                <li class="empty subtle">Перетащите сюда пилотов</li>
              }
            </ol>
          </div>
        }
      </div>

      @if (!total()) { <p class="subtle">Пока никто не зарегистрировался.</p> }

      <div class="row">
        <button class="btn btn-primary" (click)="save()" [disabled]="busy() || !dirty()">Сохранить очередь</button>
        @if (msg()) { <span [class]="ok() ? 'ok' : 'bad'">{{ msg() }}</span> }
        @if (dev) {
          <span class="testzone">
            <button class="btn btn-ghost" (click)="testPilots('create')" [disabled]="busy()">+ 24 тестовых пилота</button>
            <button class="btn btn-ghost" (click)="testPilots('create', 100)" [disabled]="busy()">+ 100 тестовых</button>
            <button class="btn btn-ghost" (click)="testPilots('delete')" [disabled]="busy()">Удалить тестовых</button>
          </span>
        }
      </div>
    </section>
  `,
  styles: `
    .stack { display: grid; gap: 16px; }
    .top { display: flex; flex-wrap: wrap; gap: 12px; align-items: center; justify-content: space-between; }
    .h { font-size: 20px; }
    .count { margin-left: 6px; color: var(--primary); }
    .row { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
    .small { font-size: 14px; margin: 0; }
    .groups { display: grid; gap: 16px; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); }
    .group {
      border: 1px solid var(--hairline-strong);
      border-radius: var(--r-md);
      padding: 12px;
      h3 { font-size: 14px; font-weight: 500; margin: 0 0 10px; display: flex; justify-content: space-between; }
    }
    .pool { border-style: dashed; border-color: var(--primary); }
    ol { list-style: none; margin: 0; padding: 0; display: grid; gap: 4px; min-height: 44px; }
    .pilot {
      display: grid;
      grid-template-columns: 20px 40px 1fr auto auto 24px;
      align-items: center;
      gap: 8px;
      padding: 8px 10px;
      border-radius: var(--r-sm);
      background: var(--surface-2);
      font-size: 14px;
    }
    .grip { cursor: grab; color: var(--ink-tertiary); letter-spacing: -2px; }
    .num { color: var(--primary); }
    .nick { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .team { font-size: 12px; }
    .dc { font-size: 12px; max-width: 140px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .nodc { font-size: 11px; color: var(--warning); }
    .x { border: 0; background: none; color: var(--ink-tertiary); cursor: pointer; &:hover { color: var(--error); } }
    .empty { padding: 10px; font-size: 13px; text-align: center; }
    .cdk-drag-preview { box-shadow: 0 8px 24px rgba(0, 0, 0, 0.6), 0 0 0 1px var(--primary); }
    .cdk-drag-placeholder { opacity: 0.3; }
    .cdk-drag-animating, .cdk-drop-list-dragging .pilot:not(.cdk-drag-placeholder) { transition: transform 250ms var(--ease-out); }
    .testzone { margin-left: auto; display: flex; gap: 4px; padding-left: 12px; border-left: 1px dashed var(--warning); }
    .testzone .btn { color: var(--warning); }
    .ok { color: var(--primary); }
    .bad { color: var(--error); }
  `,
})
export class AdminParticipants implements OnInit {
  readonly stageId = input.required<number>();
  protected readonly unassigned = signal<Reg[]>([]);
  protected readonly groups = signal<Reg[][]>([]);
  /** ник Discord участника (pilot_contacts) */
  protected readonly discord = signal(new Map<string, string>());
  protected readonly total = signal(0);
  protected readonly busy = signal(false);
  protected readonly dirty = signal(false);
  protected readonly msg = signal<string | null>(null);
  protected readonly ok = signal(true);
  // shortcut: кнопки тестовых пилотов только на локальном сайте; для пробного этапа на проде — включить там же
  protected readonly dev = isDevMode();

  ngOnInit() {
    this.load();
  }

  async load() {
    const { data, error } = await supabase
      .from('registrations')
      .select('profile_id, group_no, queue_order, created_at, profile:profiles(nickname, start_number, avatar_url), team:teams(name)')
      .eq('stage_id', this.stageId())
      .eq('status', 'registered')
      .order('queue_order', { nullsFirst: false })
      .order('created_at');
    if (error) return this.note(error.message, false);
    const rows = data as unknown as Reg[];
    const { data: dc } = await supabase.from('pilot_contacts').select('profile_id, discord').in('profile_id', rows.map((r) => r.profile_id));
    this.discord.set(new Map((dc ?? []).map((c) => [c.profile_id, c.discord])));
    const max = Math.max(0, ...rows.map((r) => r.group_no ?? 0));
    this.groups.set(Array.from({ length: max }, (_, g) => rows.filter((r) => r.group_no === g + 1)));
    this.unassigned.set(rows.filter((r) => !r.group_no));
    this.total.set(rows.length);
    this.dirty.set(false);
  }

  split(shuffle: boolean) {
    const all = [...this.unassigned(), ...this.groups().flat()];
    all.sort((a, b) => a.created_at.localeCompare(b.created_at));
    if (shuffle)
      for (let i = all.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1)); // Фишер–Йетс
        [all[i], all[j]] = [all[j], all[i]];
      }
    const ordered = all;
    const rows = assignGroups(ordered);
    const count = Math.max(0, ...rows.map((r) => r.group));
    this.groups.set(Array.from({ length: count }, (_, g) => rows.filter((r) => r.group === g + 1).map((r) => r.item)));
    this.unassigned.set([]);
    this.dirty.set(true);
  }

  addGroup() {
    this.groups.update((g) => [...g, []]);
  }

  drop(e: CdkDragDrop<Reg[]>) {
    if (e.previousContainer === e.container) moveItemInArray(e.container.data, e.previousIndex, e.currentIndex);
    else transferArrayItem(e.previousContainer.data, e.container.data, e.previousIndex, e.currentIndex);
    // новые ссылки, чтобы перерисовались счётчики
    this.groups.update((g) => [...g]);
    this.unassigned.update((u) => [...u]);
    this.dirty.set(true);
  }

  async save() {
    this.busy.set(true);
    const groups = this.groups().filter((g) => g.length);
    let queue = 0;
    const rows = [
      ...groups.flatMap((g, gi) => g.map((r) => ({ stage_id: this.stageId(), profile_id: r.profile_id, group_no: gi + 1, queue_order: ++queue }))),
      ...this.unassigned().map((r) => ({ stage_id: this.stageId(), profile_id: r.profile_id, group_no: null, queue_order: null })),
    ];
    const { error } = await supabase.from('registrations').upsert(rows);
    this.busy.set(false);
    if (error) return this.note(error.message, false);
    await this.load();
    this.note('Очередь сохранена', true);
  }

  async withdraw(r: Reg) {
    if (!confirm(`Снять ${r.profile?.nickname} с этапа?`)) return;
    const { error } = await supabase
      .from('registrations')
      .update({ status: 'withdrawn', group_no: null, queue_order: null })
      .eq('stage_id', this.stageId())
      .eq('profile_id', r.profile_id);
    if (error) return this.note(error.message, false);
    await this.load();
  }

  async testPilots(action: 'create' | 'delete', count = 24) {
    if (action === 'delete' && !confirm('Удалить всех тестовых пилотов (test-…) со всеми их заездами?')) return;
    this.busy.set(true);
    const { data, error } = await supabase.functions.invoke('test-pilots', { body: { action, stageId: this.stageId(), count } });
    this.busy.set(false);
    if (error) return this.note(error.message, false);
    await this.load();
    this.note(action === 'create' ? `Тестовых пилотов на этапе: ${data.total}` : `Удалено: ${data.deleted}`, true);
  }

  private note(text: string, ok: boolean) {
    this.msg.set(text);
    this.ok.set(ok);
  }
}
