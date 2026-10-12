import { Component, computed, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { supabase } from '../auth';

interface Team {
  id: number;
  name: string;
  logo_url: string | null;
  captain_id: string | null;
}
interface Member {
  team_id: number;
  profile_id: string;
  status: 'pending' | 'approved';
  profile: { nickname: string; start_number: number | null } | null;
}

@Component({
  selector: 'app-admin-teams',
  imports: [FormsModule],
  template: `
    <header class="top">
      <h1 class="display-md">Команды</h1>
      <label class="field season">
        <span class="lbl">Сезон</span>
        <select class="input" [(ngModel)]="seasonId" (ngModelChange)="load()">
          @for (s of seasons(); track s.id) { <option [ngValue]="s.id">{{ s.title }}</option> }
        </select>
      </label>
    </header>
    @if (msg()) { <p [class]="ok() ? 'ok' : 'bad'">{{ msg() }}</p> }

    @if (pending().length) {
      <section class="card stack requests">
        <h2 class="h">Заявки <span class="mono count">{{ pending().length }}</span></h2>
        @for (m of pending(); track m.profile_id) {
          <div class="req">
            <span class="num mono">{{ m.profile?.start_number ?? '—' }}</span>
            <span class="nick">{{ m.profile?.nickname }}</span>
            <span class="subtle">→ {{ teamName(m.team_id) }}</span>
            <button class="btn btn-primary sm" (click)="approve(m)" [disabled]="busy()">Принять</button>
            <button class="btn btn-ghost sm" (click)="drop(m, 'Отклонить заявку')" [disabled]="busy()">Отклонить</button>
          </div>
        }
      </section>
    }

    <div class="teams">
      @for (t of teams(); track t.id) {
        @let ms = approvedOf(t.id);
        <article class="card stack">
          <header class="thead">
            <span class="logo" [style.background-image]="t.logo_url ? 'url(' + t.logo_url + ')' : null"></span>
            <h3>{{ t.name }}</h3>
            <span class="mono subtle">{{ ms.length }}/8</span>
          </header>
          <ul>
            @for (m of ms; track m.profile_id) {
              <li>
                <span class="num mono">{{ m.profile?.start_number ?? '—' }}</span>
                <span class="nick">{{ m.profile?.nickname }}</span>
                @if (m.profile_id === t.captain_id) { <span class="tag">C</span> }
                <button class="x" title="Убрать" (click)="drop(m, 'Убрать из команды')">✕</button>
              </li>
            } @empty {
              <li class="subtle">Не заявлена на сезон</li>
            }
          </ul>
          <label class="field">
            <span class="lbl">Капитан</span>
            <select class="input" [ngModel]="t.captain_id" (ngModelChange)="setCaptain(t, $event)">
              <option [ngValue]="null">— нет —</option>
              @for (m of ms; track m.profile_id) { <option [ngValue]="m.profile_id">{{ m.profile?.nickname }}</option> }
            </select>
          </label>
          <div class="add">
            <label class="field">
              <span class="lbl">Добавить пилота</span>
              <input class="input" placeholder="Начните вводить ник…" [(ngModel)]="query[t.id]" (ngModelChange)="search(t.id)" />
            </label>
            @for (p of found()[t.id] ?? []; track p.id) {
              <button type="button" class="found" (click)="add(t.id, p.id)"><span class="mono num">{{ p.start_number ?? '—' }}</span> {{ p.nickname }} <span class="plus">+</span></button>
            } @empty {
              @if ((query[t.id] ?? '').trim().length >= 2 && found()[t.id]) {
                <span class="hint">Не найдено. Пилот должен хотя бы раз войти на сайт через Steam.</span>
              }
            }
          </div>
          <button class="btn btn-ghost" (click)="rename(t)" [disabled]="busy()">Переименовать</button>
          <button class="btn btn-ghost" (click)="dropLogo(t)" [disabled]="busy() || !t.logo_url">Убрать логотип</button>
          <button class="btn btn-ghost danger" (click)="remove(t)" [disabled]="busy()">Удалить команду</button>
        </article>
      } @empty {
        <p class="subtle">Команд пока нет — пилоты создают их в личном кабинете.</p>
      }
    </div>
  `,
  styles: `
    .top { display: flex; flex-wrap: wrap; gap: 16px; align-items: end; justify-content: space-between; margin-bottom: 24px; }
    .season { min-width: 200px; }
    .field { display: grid; gap: 6px; }
    .lbl { font-size: 13px; color: var(--ink-muted); }
    .stack { display: grid; gap: 12px; }
    .h { font-size: 20px; }
    .count { color: var(--warning); margin-left: 6px; }
    .requests { margin-bottom: 24px; border-color: rgba(245, 185, 66, 0.4); }
    .req { display: flex; flex-wrap: wrap; align-items: center; gap: 10px; padding: 8px 0; border-bottom: 1px solid var(--hairline); }
    .sm { min-height: 34px; padding: 6px 12px; }
    .teams { display: grid; gap: 24px; grid-template-columns: repeat(auto-fill, minmax(min(100%, 300px), 1fr)); align-items: start; }
    .thead { display: flex; align-items: center; gap: 12px; h3 { flex: 1; font-size: 18px; } }
    .logo { width: 40px; height: 40px; border-radius: var(--r-sm); border: 1px solid var(--hairline-strong); background: var(--surface-2) center / cover no-repeat; }
    ul { list-style: none; margin: 0; padding: 0; display: grid; gap: 4px; }
    li { display: flex; align-items: center; gap: 10px; padding: 6px 10px; border-radius: var(--r-sm); background: var(--surface-2); font-size: 14px; }
    .num { color: var(--primary); min-width: 32px; }
    .nick { flex: 1; }
    .tag { font: 600 11px var(--mono); padding: 1px 6px; border-radius: var(--r-sm); background: var(--primary); color: var(--on-primary); }
    .x { border: 0; background: none; color: var(--ink-tertiary); cursor: pointer; &:hover { color: var(--error); } }
    .add { display: grid; gap: 6px; }
    .hint { font-size: 13px; color: var(--warning); }
    .found {
      display: flex; align-items: center; gap: 8px; padding: 6px 10px; text-align: left;
      border: 1px solid var(--hairline-strong); border-radius: var(--r-sm); background: var(--surface-1); color: var(--ink); cursor: pointer;
      &:hover { border-color: var(--primary); }
      .plus { margin-left: auto; color: var(--primary); }
    }
    .danger { justify-self: start; color: var(--error); }
    .ok { color: var(--primary); }
    .bad { color: var(--error); }
  `,
})
export class AdminTeams implements OnInit {
  protected readonly seasons = signal<{ id: number; title: string; status: string }[]>([]);
  protected seasonId: number | null = null;
  protected readonly teams = signal<Team[]>([]);
  protected readonly members = signal<Member[]>([]);
  protected readonly pending = computed(() => this.members().filter((m) => m.status === 'pending'));
  /** результаты поиска по команде; undefined — ещё не искали (подсказку «не найдено» не показываем) */
  protected readonly found = signal<Record<number, { id: string; nickname: string; start_number: number | null }[] | undefined>>({});
  protected query: Record<number, string> = {};
  protected readonly busy = signal(false);
  protected readonly msg = signal<string | null>(null);
  protected readonly ok = signal(true);

  async ngOnInit() {
    const { data } = await supabase.from('seasons').select('id, title, status').order('number', { ascending: false });
    this.seasons.set(data ?? []);
    this.seasonId = (data ?? []).find((s) => s.status === 'active')?.id ?? data?.[0]?.id ?? null;
    await this.load();
  }

  async load() {
    const [teams, members] = await Promise.all([
      supabase.from('teams').select('id, name, logo_url, captain_id').order('name'),
      this.seasonId
        ? supabase.from('team_members').select('team_id, profile_id, status, profile:profiles(nickname, start_number)').eq('season_id', this.seasonId)
        : Promise.resolve({ data: [] }),
    ]);
    this.teams.set(teams.data ?? []);
    this.members.set((members.data ?? []) as unknown as Member[]);
  }

  protected approvedOf(teamId: number) {
    return this.members().filter((m) => m.team_id === teamId && m.status === 'approved');
  }

  protected teamName(id: number) {
    return this.teams().find((t) => t.id === id)?.name ?? '?';
  }

  private async run(q: PromiseLike<{ error: { message: string } | null }>, done?: string) {
    this.busy.set(true);
    const { error } = await q;
    this.busy.set(false);
    this.msg.set(error ? error.message : (done ?? null));
    this.ok.set(!error);
    if (!error) await this.load();
  }

  approve(m: Member) {
    return this.run(supabase.from('team_members').update({ status: 'approved' }).match({ season_id: this.seasonId, profile_id: m.profile_id }), 'Заявка принята');
  }

  drop(m: Member, what: string) {
    if (!confirm(`${what}: ${m.profile?.nickname}?`)) return;
    return this.run(supabase.from('team_members').delete().match({ season_id: this.seasonId, profile_id: m.profile_id }));
  }

  setCaptain(t: Team, captainId: string | null) {
    return this.run(supabase.from('teams').update({ captain_id: captainId }).eq('id', t.id), 'Капитан изменён');
  }

  remove(t: Team) {
    if (!confirm(`Удалить команду «${t.name}» со всеми составами? Результаты пилотов останутся.`)) return;
    return this.run(supabase.from('teams').delete().eq('id', t.id), 'Команда удалена');
  }

  /** Модерация: недопустимое название */
  rename(t: Team) {
    const name = prompt(`Новое название для «${t.name}» (2–40 символов):`, t.name)?.trim();
    if (!name || name === t.name) return;
    return this.run(supabase.from('teams').update({ name }).eq('id', t.id), `Команда переименована в «${name}»`);
  }

  /** Модерация: недопустимый логотип — файл из хранилища и ссылку из команды */
  async dropLogo(t: Team) {
    if (!confirm(`Убрать логотип команды «${t.name}»?`)) return;
    await supabase.storage.from('team-logos').remove([`${t.id}/logo.webp`]);
    return this.run(supabase.from('teams').update({ logo_url: null }).eq('id', t.id), `«${t.name}»: логотип убран`);
  }

  async search(teamId: number) {
    const q = (this.query[teamId] ?? '').trim();
    if (q.length < 2) return this.found.update((f) => ({ ...f, [teamId]: undefined }));
    const { data } = await supabase.from('profiles').select('id, nickname, start_number').ilike('nickname', `%${q}%`).limit(6);
    this.found.update((f) => ({ ...f, [teamId]: data ?? [] }));
  }

  async add(teamId: number, profileId: string) {
    this.query[teamId] = '';
    this.found.update((f) => ({ ...f, [teamId]: undefined }));
    await this.run(supabase.from('team_members').insert({ season_id: this.seasonId, profile_id: profileId, team_id: teamId, status: 'approved' }), 'Пилот добавлен');
  }
}
