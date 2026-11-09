import { CdkDrag, CdkDragDrop, CdkDragHandle, CdkDropList, CdkDropListGroup, moveItemInArray, transferArrayItem } from '@angular/cdk/drag-drop';
import { NgTemplateOutlet } from '@angular/common';
import { Component, computed, DestroyRef, inject, input, isDevMode, OnInit, signal } from '@angular/core';
import { supabase } from '../auth';
import { litePoll } from '../lite';
import { notify } from '../notify';
import { assignGroups } from '../scoring/scoring';
import { confirmedFirst, GroupMeta, groupLabel, restoreSpot } from '../groups';

interface Reg {
  profile_id: string;
  group_no: number | null;
  queue_order: number | null;
  status: string;
  created_at: string;
  profile: { nickname: string; start_number: number | null; avatar_url: string | null } | null;
  team: { name: string } | null;
}

const SAVE_CHUNK = 10;
const SAVE_PAUSE_MS = 1000;

// Участники этапа: группы по 10 и очередь квалификации (перетаскиванием)
@Component({
  selector: 'app-admin-participants',
  imports: [CdkDropListGroup, CdkDropList, CdkDrag, CdkDragHandle, NgTemplateOutlet],
  template: `
    <section class="card stack">
      <header class="top">
        <h2 class="h">Участники <span class="count mono">{{ total() }}</span></h2>
        <div class="row">
          <button class="btn btn-secondary" (click)="split(false)" [disabled]="busy() || !total()">По 10, по порядку регистрации</button>
          <button class="btn btn-secondary" (click)="split(true)" [disabled]="busy() || !total()">🎲 Перемешать и по 10</button>
          <button class="btn btn-ghost" (click)="addGroup()" [disabled]="busy()">+ Группа</button>
          <button class="btn btn-ghost" (click)="addGroup(true)" [disabled]="busy()" title="Запасная группа для внештатных ситуаций — например, пилоты на другом сервере">+ Буфер</button>
          <button class="btn btn-ghost" (click)="load()" [disabled]="busy()">↻ Обновить</button>
        </div>
      </header>
      @if (status() === 'registration') {
        <div class="checkin">
          <span>Подтвердили участие: <b class="mono">{{ confirmedCount() }}</b> из {{ total() }} · <span class="subtle">{{ checkinNote() }}</span></span>
          <button class="btn btn-primary" (click)="closeAndRebuild()" [disabled]="busy() || !total()">{{ closed() ? 'Перестроить группы ещё раз' : 'Закрыть подтверждение и перестроить группы' }}</button>
        </div>
      }
      <p class="muted small">Перетаскивайте пилотов между группами и внутри группы — это порядок выезда в квалификации. Группы двигаются стрелками ▲▼. Буфер — запасная группа со своим названием (например, «EN сервер»): едет там, где стоит в списке. Не забудьте сохранить.</p>

      <!-- содержимое строки пилота: ручка перетаскивания остаётся снаружи, иначе cdkDragHandle не найдёт cdkDrag -->
      <ng-template #row let-r>
        <span class="num mono">{{ r.profile?.start_number ?? '—' }}</span>
        <span class="who"><span class="nick">{{ r.profile?.nickname }}</span>@if (r.status === 'no_show') { <span class="ns">неявка</span> } @else if (discord().get(r.profile_id); as d) { <span class="dc mono subtle" title="Discord">{{ d }}</span> } @else { <span class="nodc">нет Discord</span> }</span>
        @if (r.status === 'no_show') {
          <button class="btn btn-ghost back" (click)="restore(r)" [disabled]="busy()">Вернуть</button>
        } @else {
          <span class="team subtle">{{ r.team?.name ?? '' }}</span>
        }
        <button class="ci" [class.on]="checked().has(r.profile_id)" [attr.aria-pressed]="checked().has(r.profile_id)" title="Подтвердил участие" aria-label="Подтвердил участие" (click)="toggleCheck(r)">✓</button>
        <button class="x" title="Снять с этапа" (click)="withdraw(r)">✕</button>
      </ng-template>

      <div class="groups" cdkDropListGroup>
        @if (unassigned().length) {
          <div class="group pool">
            <h3>Без группы <span class="mono subtle">{{ unassigned().length }}</span></h3>
            <ol cdkDropList [cdkDropListData]="unassigned()" (cdkDropListDropped)="drop($event)">
              @for (r of unassigned(); track r.profile_id) {
                <li cdkDrag class="pilot" [class.absent]="r.status === 'no_show'">
                  <span cdkDragHandle class="grip" aria-hidden="true">⋮⋮</span>
                  <ng-container [ngTemplateOutlet]="row" [ngTemplateOutletContext]="{ $implicit: r }" />
                </li>
              }
            </ol>
          </div>
        }
        @for (g of groups(); track $index; let gi = $index) {
          @let m = meta()[gi];
          <div class="group" [class.buffer]="m?.buffer">
            <h3>
              @if (m?.buffer) {
                <input class="gname" [value]="m.name ?? ''" placeholder="Буфер" maxlength="40" aria-label="Название буфера" (input)="rename(gi, $any($event.target).value)" />
              } @else {
                <span>{{ label(gi) }}</span>
              }
              <span class="gtools">
                <span class="mono subtle">{{ g.length }}</span>
                <button class="mv" title="Выше" (click)="moveGroup(gi, -1)" [disabled]="gi === 0">▲</button>
                <button class="mv" title="Ниже" (click)="moveGroup(gi, 1)" [disabled]="gi === groups().length - 1">▼</button>
                @if (m?.buffer) { <button class="mv" [title]="g.length ? 'Убрать буфер — пилоты станут обычной группой' : 'Убрать буфер'" (click)="unbuffer(gi)">✕</button> }
                @else if (!g.length) { <button class="mv" title="Убрать пустую группу" (click)="removeGroup(gi)">✕</button> }
              </span>
            </h3>
            <ol cdkDropList [cdkDropListData]="g" (cdkDropListDropped)="drop($event)">
              @for (r of g; track r.profile_id) {
                <li cdkDrag class="pilot" [class.absent]="r.status === 'no_show'">
                  <span cdkDragHandle class="grip" aria-hidden="true">⋮⋮</span>
                  <ng-container [ngTemplateOutlet]="row" [ngTemplateOutletContext]="{ $implicit: r }" />
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
    .groups { display: grid; gap: 16px; grid-template-columns: repeat(auto-fill, minmax(290px, 1fr)); }
    .checkin { display: flex; flex-wrap: wrap; gap: 10px 16px; align-items: center; justify-content: space-between; padding: 12px 14px; border: 1px solid var(--primary); border-radius: var(--r-md); background: var(--primary-soft); }
    .checkin b { color: var(--primary); }
    .group {
      border: 1px solid var(--hairline-strong);
      border-radius: var(--r-md);
      padding: 12px;
      h3 { font-size: 14px; font-weight: 500; margin: 0 0 10px; display: flex; gap: 8px; align-items: center; justify-content: space-between; }
    }
    .gtools { display: flex; gap: 2px; align-items: center; .subtle { margin-right: 6px; } }
    .mv {
      width: 26px; height: 26px; border: 1px solid var(--hairline); border-radius: var(--r-sm); background: none; color: var(--ink-muted); font-size: 11px; cursor: pointer;
      &:hover:not(:disabled) { color: var(--primary); border-color: var(--primary); }
      &:disabled { opacity: 0.3; cursor: default; }
    }
    .buffer { border-style: dashed; border-color: var(--warning); background: color-mix(in srgb, var(--warning) 5%, transparent); }
    .gname { min-width: 0; flex: 1; padding: 4px 8px; border: 1px solid var(--hairline-strong); border-radius: var(--r-sm); background: var(--surface-2); color: var(--warning); font: 600 14px var(--font); }
    .pool { border-style: dashed; border-color: var(--primary); }
    ol { list-style: none; margin: 0; padding: 0; display: grid; gap: 4px; min-height: 44px; }
    .pilot {
      display: grid;
      grid-template-columns: 20px 40px 1fr auto 24px 24px;
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
    /* ник и под ним Discord */
    .who { display: grid; min-width: 0; line-height: 1.25; }
    .dc, .nodc { font-size: 11px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .nodc { color: var(--warning); }
    .absent { opacity: 0.55; }
    .ns { font-size: 11px; color: var(--warning); }
    .back { padding: 2px 8px; font-size: 12px; }
    .ci { width: 24px; height: 24px; padding: 0; border: 1px solid var(--hairline-strong); border-radius: var(--r-sm); background: none; color: var(--ink-tertiary); cursor: pointer; &.on { border-color: var(--primary); background: var(--primary); color: var(--on-primary); } }
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
  /** буфер и название — по позиции группы, параллельно groups */
  protected readonly meta = signal<GroupMeta[]>([]);
  /** ник Discord участника (pilot_contacts) */
  protected readonly discord = signal(new Map<string, string>());
  protected readonly total = signal(0);
  protected readonly status = signal('');
  protected readonly closed = signal(false);
  private readonly startsAt = signal<string | null>(null);
  /** кто нажал «Я буду» или кого отметил админ */
  protected readonly checked = signal(new Set<string>());
  protected readonly confirmedCount = computed(() => [...this.unassigned(), ...this.groups().flat()].filter((r) => r.status === 'registered' && this.checked().has(r.profile_id)).length);
  protected readonly busy = signal(false);
  protected readonly dirty = signal(false);
  protected readonly msg = signal<string | null>(null);
  protected readonly ok = signal(true);
  // shortcut: кнопки тестовых пилотов только на локальном сайте; для пробного этапа на проде — включить там же
  protected readonly dev = isDevMode();

  private readonly destroy = inject(DestroyRef);

  ngOnInit() {
    this.load();
    // только галочки — опрос не трогает группы, которые админ может сейчас перетаскивать
    this.destroy.onDestroy(litePoll(() => this.status() === 'registration' && this.loadChecks(), 15_000));
  }

  private async loadChecks() {
    const { data } = await supabase.from('stage_checkins').select('profile_id').eq('stage_id', this.stageId());
    if (data) this.checked.set(new Set(data.map((c) => c.profile_id)));
  }

  protected checkinNote() {
    if (this.closed()) return 'закрыто';
    const at = this.startsAt();
    return at && Date.now() >= Date.parse(at) - 3_600_000 ? 'открыто, пилоты нажимают «Я буду»' : 'откроется за час до старта';
  }

  async toggleCheck(r: Reg) {
    const row = { stage_id: this.stageId(), profile_id: r.profile_id };
    const on = this.checked().has(r.profile_id);
    const { error } = on ? await supabase.from('stage_checkins').delete().match(row) : await supabase.from('stage_checkins').insert(row);
    if (error) return this.note(error.message, false);
    const next = new Set(this.checked());
    if (on) next.delete(r.profile_id);
    else next.add(r.profile_id);
    this.checked.set(next);
  }

  /** Подтвердившие занимают первые группы, остальные — за ними; буферы не меняются */
  async closeAndRebuild() {
    if (this.dirty()) return this.note('Сначала сохраните очередь или нажмите «Обновить»', false);
    const { count, error: e0 } = await supabase.from('qual_runs').select('profile_id', { count: 'exact', head: true }).eq('stage_id', this.stageId());
    if (e0) return this.note(e0.message, false);
    if (count) return this.note('Уже есть оценки — перестраивать группы нельзя', false);
    await this.load();
    if (!confirm(`Закрыть подтверждение и перестроить группы?\n\nПодтвердили: ${this.confirmedCount()} из ${this.total()}. Они займут первые группы, остальные пойдут за ними. Буферы не изменятся. В Discord уйдёт сообщение.`)) return;
    this.busy.set(true);
    const { error } = await supabase.from('stages').update({ checkin_closed: true }).eq('id', this.stageId());
    if (error) {
      this.busy.set(false);
      return this.note(error.message, false);
    }
    this.closed.set(true);
    const current = [...this.groups().filter((_, i) => !this.meta()[i]?.buffer).flat(), ...this.unassigned()];
    this.arrange(confirmedFirst(current, (r) => r.status === 'registered' && this.checked().has(r.profile_id)));
    if (!(await this.save())) return;
    notify('groups_ready', this.stageId());
    this.note('Группы перестроены, сообщение ушло в Discord', true);
  }

  async restore(r: Reg) {
    this.busy.set(true);
    const { data: runs, error: e0 } = await supabase.from('qual_runs').select('profile_id, attempt').eq('stage_id', this.stageId());
    if (e0) {
      this.busy.set(false);
      return this.note(e0.message, false);
    }
    const spot = restoreSpot([...this.unassigned(), ...this.groups().flat()], runs ?? [], r.profile_id);
    const { error } = await supabase.from('registrations').update({ status: 'registered', ...spot }).eq('stage_id', this.stageId()).eq('profile_id', r.profile_id);
    this.busy.set(false);
    if (error) return this.note(error.message, false);
    await this.load();
    this.note(`${r.profile?.nickname} возвращён`, true);
  }

  async load() {
    const { data, error } = await supabase
      .from('registrations')
      .select('profile_id, group_no, queue_order, status, created_at, profile:profiles(nickname, start_number, avatar_url), team:teams(name)')
      .eq('stage_id', this.stageId())
      .in('status', ['registered', 'no_show'])
      .order('queue_order', { nullsFirst: false })
      .order('created_at');
    if (error) return this.note(error.message, false);
    const rows = data as unknown as Reg[];
    const { data: st } = await supabase.from('stages').select('group_meta, status, checkin_closed, starts_at').eq('id', this.stageId()).single();
    this.status.set(st?.status ?? '');
    this.closed.set(!!st?.checkin_closed);
    this.startsAt.set(st?.starts_at ?? null);
    await this.loadChecks();
    const { data: dc } = await supabase.from('pilot_contacts').select('profile_id, discord').in('profile_id', rows.map((r) => r.profile_id));
    this.discord.set(new Map((dc ?? []).map((c) => [c.profile_id, c.discord])));
    const max = Math.max(0, ...rows.map((r) => r.group_no ?? 0));
    const meta = (st?.group_meta ?? []) as GroupMeta[];
    const count = Math.max(max, meta.length);
    this.groups.set(Array.from({ length: count }, (_, g) => rows.filter((r) => r.group_no === g + 1)));
    this.meta.set(Array.from({ length: count }, (_, g) => meta[g] ?? {}));
    this.unassigned.set(rows.filter((r) => !r.group_no));
    this.total.set(rows.filter((r) => r.status === 'registered').length);
    this.dirty.set(false);
  }

  /** по 10 раскладываются все, кроме буферов — они остаются как есть, в конце */
  split(shuffle: boolean) {
    const all = [...this.unassigned(), ...this.groups().filter((_, i) => !this.meta()[i]?.buffer).flat()];
    all.sort((a, b) => a.created_at.localeCompare(b.created_at));
    if (shuffle)
      for (let i = all.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1)); // Фишер–Йетс
        [all[i], all[j]] = [all[j], all[i]];
      }
    this.arrange(all);
  }

  /** список → обычные группы по 10, буферы в конце как были */
  private arrange(ordered: Reg[]) {
    const buffers = this.groups().flatMap((g, i) => (this.meta()[i]?.buffer ? [{ g, m: this.meta()[i] }] : []));
    const rows = assignGroups(ordered);
    const count = Math.max(0, ...rows.map((r) => r.group));
    this.groups.set([...Array.from({ length: count }, (_, g) => rows.filter((r) => r.group === g + 1).map((r) => r.item)), ...buffers.map((b) => b.g)]);
    this.meta.set([...Array.from({ length: count }, () => ({})), ...buffers.map((b) => b.m)]);
    this.unassigned.set([]);
    this.dirty.set(true);
  }

  addGroup(buffer = false) {
    this.groups.update((g) => [...g, []]);
    this.meta.update((m) => [...m, buffer ? { buffer: true, name: null } : {}]);
    this.dirty.set(true);
  }

  protected label(gi: number) {
    return groupLabel(gi + 1, this.meta());
  }

  moveGroup(gi: number, dir: -1 | 1) {
    const swap = <T>(a: T[]) => {
      const b = [...a];
      [b[gi], b[gi + dir]] = [b[gi + dir], b[gi]];
      return b;
    };
    this.groups.update(swap);
    this.meta.update(swap);
    this.dirty.set(true);
  }

  removeGroup(gi: number) {
    this.groups.update((g) => g.filter((_, i) => i !== gi));
    this.meta.update((m) => m.filter((_, i) => i !== gi));
    this.dirty.set(true);
  }

  /** убрать буфер: пустой — удаляется, с пилотами — становится обычной группой на том же месте */
  unbuffer(gi: number) {
    if (!this.groups()[gi].length) return this.removeGroup(gi);
    if (!confirm('Убрать буфер? Пилоты из него станут обычной группой (' + groupLabel(gi + 1, this.meta().map((m, i) => (i === gi ? {} : m))) + ').')) return;
    this.meta.update((m) => m.map((x, i) => (i === gi ? {} : x)));
    this.dirty.set(true);
  }

  rename(gi: number, name: string) {
    this.meta.update((m) => m.map((x, i) => (i === gi ? { ...x, name } : x)));
    this.dirty.set(true);
  }

  drop(e: CdkDragDrop<Reg[]>) {
    if (e.previousContainer === e.container) moveItemInArray(e.container.data, e.previousIndex, e.currentIndex);
    else transferArrayItem(e.previousContainer.data, e.container.data, e.previousIndex, e.currentIndex);
    // новые ссылки, чтобы перерисовались счётчики
    this.groups.update((g) => [...g]);
    this.unassigned.update((u) => [...u]);
    this.dirty.set(true);
  }

  async save(): Promise<boolean> {
    this.busy.set(true);
    // пустые обычные группы выкидываем, пустой буфер оставляем — он может понадобиться по ходу квалы
    const kept = this.groups()
      .map((g, i) => ({ g, m: this.meta()[i] ?? {} }))
      .filter((x) => x.g.length || x.m.buffer);
    const groups = kept.map((x) => x.g);
    const meta: GroupMeta[] = kept.map((x) => (x.m.buffer ? { buffer: true, name: x.m.name?.trim() || null } : {}));
    let queue = 0;
    const rows = [
      ...groups.flatMap((g, gi) => g.map((r) => ({ r, group_no: gi + 1, queue_order: ++queue }))),
      ...this.unassigned().map((r) => ({ r, group_no: null, queue_order: null })),
    ]
      // только изменённые: перезапись всех ~140 строк разом положила базу 2026-10-31 (каждая строка — событие каждому подписчику)
      .filter((x) => x.r.group_no !== x.group_no || x.r.queue_order !== x.queue_order)
      .map((x) => ({ stage_id: this.stageId(), profile_id: x.r.profile_id, group_no: x.group_no, queue_order: x.queue_order }));
    const { error: e1 } = await supabase.from('stages').update({ group_meta: meta }).eq('id', this.stageId());
    let error = e1;
    // порциями с паузой: каждая строка — событие каждому открытому пульту, лимит Realtime на Free — 100 сообщений в секунду
    for (let i = 0; !error && i < rows.length; i += SAVE_CHUNK) {
      if (i) {
        this.note(`Сохраняю… ${i} из ${rows.length}`, true);
        await new Promise((r) => setTimeout(r, SAVE_PAUSE_MS));
      }
      ({ error } = await supabase.from('registrations').upsert(rows.slice(i, i + SAVE_CHUNK)));
    }
    this.busy.set(false);
    if (error) {
      this.note(error.message, false);
      return false;
    }
    await this.load();
    this.note('Очередь сохранена', true);
    return true;
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
