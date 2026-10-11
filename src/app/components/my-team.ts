import { Component, computed, inject, input, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { supabase } from '../auth';
import { compressImage } from '../image';
import { Loader } from './loader';

interface Team {
  id: number;
  name: string;
  logo_url: string | null;
  captain_id: string | null;
}
interface Member {
  profile_id: string;
  status: 'pending' | 'approved';
  profile: { nickname: string; start_number: number | null; avatar_url: string | null } | null;
}

// Команда пилота в текущем сезоне: создать, подать заявку, состав; капитану — приглашения и логотип
@Component({
  selector: 'app-my-team',
  imports: [FormsModule, TranslocoPipe, Loader],
  template: `
    <h2 class="h">{{ 'team.title' | transloco }}</h2>

    @if (loading()) {
      <app-loader [inline]="true" />
    } @else if (!seasonId()) {
      <p class="subtle">{{ 'team.noSeason' | transloco }}</p>
    } @else if (team(); as t) {
      <div class="team">
        <span class="logo" [style.background-image]="t.logo_url ? 'url(' + t.logo_url + ')' : null">
          @if (!t.logo_url) { {{ initials(t.name) }} }
        </span>
        <div>
          <h3>{{ t.name }}</h3>
          @if (myStatus() === 'pending') {
            <span class="badge warn">{{ 'team.pending' | transloco }}</span>
          } @else if (isCaptain()) {
            <span class="badge">{{ 'team.captain' | transloco }}</span>
          }
        </div>
      </div>

      @if (myStatus() === 'approved') {
        <ul class="members">
          @for (m of members(); track m.profile_id) {
            <li>
              <span class="num mono">{{ m.profile?.start_number ?? '—' }}</span>
              <span class="nick">{{ m.profile?.nickname }}</span>
              @if (m.profile_id === t.captain_id) { <span class="tag">C</span> }
              @if (m.status === 'pending') { <span class="subtle small">{{ 'team.awaiting' | transloco }}</span> }
              @if (isCaptain() && m.profile_id !== t.captain_id) {
                <button class="x" [title]="'team.remove' | transloco" (click)="remove(m)">✕</button>
              }
            </li>
          }
        </ul>
        <p class="subtle small">{{ 'team.limit' | transloco: { n: approvedCount() } }}</p>
      }

      @if (isCaptain()) {
        <div class="captain">
          <label class="field">
            <span class="lbl">{{ 'team.invite' | transloco }}</span>
            <input class="input" [placeholder]="'team.searchNick' | transloco" [(ngModel)]="query" (ngModelChange)="search()" />
          </label>
          @for (p of found(); track p.id) {
            <button class="found" (click)="invite(p.id)"><span class="mono num">{{ p.start_number ?? '—' }}</span> {{ p.nickname }} <span class="plus">+</span></button>
          } @empty {
            @if (searched()) { <span class="hint">{{ 'team.notFound' | transloco }}</span> }
          }
          <label class="btn btn-secondary file">
            {{ 'team.logo' | transloco }}
            <input type="file" accept="image/png,image/jpeg,image/webp" (change)="uploadLogo($event, t)" />
          </label>
        </div>
      } @else {
        <button class="btn btn-ghost" (click)="leave()" [disabled]="busy()">
          {{ (myStatus() === 'pending' ? 'team.cancel' : 'team.leave') | transloco }}
        </button>
      }
    } @else if (ownTeam(); as own) {
      <p class="muted">{{ 'team.ownNotEntered' | transloco: { name: own.name } }}</p>
      <button class="btn btn-primary" (click)="join(own.id)" [disabled]="busy()">{{ 'team.enter' | transloco }}</button>
    } @else {
      <div class="choose">
        <form class="field" (ngSubmit)="create()">
          <span class="lbl">{{ 'team.create' | transloco }}</span>
          <div class="inline">
            <input class="input" name="tn" maxlength="40" [placeholder]="'team.name' | transloco" [(ngModel)]="newName" />
            <button class="btn btn-primary" type="submit" [disabled]="busy() || newName.trim().length < 2">{{ 'team.createBtn' | transloco }}</button>
          </div>
        </form>
        <div class="field">
          <span class="lbl">{{ 'team.request' | transloco }}</span>
          <div class="inline">
            <select class="input" [(ngModel)]="pickTeam">
              <option [ngValue]="null">{{ 'me.choose' | transloco }}</option>
              @for (t of allTeams(); track t.id) { <option [ngValue]="t.id">{{ t.name }}</option> }
            </select>
            <button class="btn btn-secondary" (click)="join(pickTeam!)" [disabled]="busy() || !pickTeam">{{ 'team.send' | transloco }}</button>
          </div>
        </div>
      </div>
    }
    @if (error()) { <p class="bad small">{{ error() }}</p> }
  `,
  styles: `
    :host { display: grid; gap: 16px; }
    .h { font-size: 20px; }
    .team { display: flex; gap: 16px; align-items: center; }
    .logo {
      display: grid; place-items: center; width: 64px; height: 64px; flex-shrink: 0;
      border-radius: var(--r-md); border: 1px solid var(--primary);
      background: var(--primary-soft) center / cover no-repeat;
      color: var(--primary); font: 600 22px var(--mono);
    }
    h3 { font-size: 18px; margin: 0 0 6px; }
    .badge.warn { background: rgba(245, 185, 66, 0.12); color: var(--warning); }
    .members { list-style: none; margin: 0; padding: 0; display: grid; gap: 4px; }
    .members li { display: flex; align-items: center; gap: 10px; padding: 8px 10px; border-radius: var(--r-sm); background: var(--surface-2); font-size: 14px; }
    .num { color: var(--primary); min-width: 32px; }
    .nick { flex: 1; }
    .tag { font: 600 11px var(--mono); padding: 1px 6px; border-radius: var(--r-sm); background: var(--primary); color: var(--on-primary); }
    .x { border: 0; background: none; color: var(--ink-tertiary); cursor: pointer; &:hover { color: var(--error); } }
    .small { font-size: 13px; margin: 0; }
    .captain, .choose { display: grid; gap: 12px; }
    .field { display: grid; gap: 6px; }
    .lbl { font-size: 13px; color: var(--ink-muted); }
    .inline { display: flex; gap: 8px; flex-wrap: wrap; > .input { flex: 1; min-width: 180px; } }
    .found {
      display: flex; align-items: center; gap: 8px; padding: 8px 12px; text-align: left;
      border: 1px solid var(--hairline-strong); border-radius: var(--r-sm); background: var(--surface-1); color: var(--ink); cursor: pointer;
      &:hover { border-color: var(--primary); }
      .plus { margin-left: auto; color: var(--primary); }
    }
    .hint { font-size: 13px; color: var(--warning); }
    .file { position: relative; justify-self: start; input { position: absolute; inset: 0; opacity: 0; cursor: pointer; } }
    .bad { color: var(--error); }
  `,
})
export class MyTeam implements OnInit {
  readonly profileId = input.required<string>();
  protected readonly loading = signal(true);
  protected readonly busy = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly seasonId = signal<number | null>(null);
  protected readonly team = signal<Team | null>(null);
  protected readonly myStatus = signal<'pending' | 'approved' | null>(null);
  protected readonly members = signal<Member[]>([]);
  protected readonly ownTeam = signal<Team | null>(null);
  protected readonly allTeams = signal<Team[]>([]);
  protected readonly found = signal<{ id: string; nickname: string; start_number: number | null }[]>([]);
  protected readonly searched = signal(false);
  protected readonly isCaptain = computed(() => this.team()?.captain_id === this.profileId() && this.myStatus() === 'approved');
  protected readonly approvedCount = computed(() => this.members().filter((m) => m.status === 'approved').length);
  protected newName = '';
  protected pickTeam: number | null = null;
  protected query = '';
  private searchSeq = 0;
  private readonly t = inject(TranslocoService);

  ngOnInit() {
    this.load();
  }

  private async load() {
    this.loading.set(true);
    const { data: season } = await supabase.from('seasons').select('id').eq('status', 'active').maybeSingle();
    this.seasonId.set(season?.id ?? null);
    if (season) {
      const me = this.profileId();
      const [mine, own, all] = await Promise.all([
        supabase.from('team_members').select('status, team:teams(id, name, logo_url, captain_id)').eq('season_id', season.id).eq('profile_id', me).maybeSingle(),
        supabase.from('teams').select('id, name, logo_url, captain_id').eq('captain_id', me).maybeSingle(),
        supabase.from('teams').select('id, name, logo_url, captain_id').order('name'),
      ]);
      const t = (mine.data?.team ?? null) as unknown as Team | null;
      this.team.set(t);
      this.myStatus.set(mine.data?.status ?? null);
      this.ownTeam.set(own.data);
      this.allTeams.set(all.data ?? []);
      if (t) {
        const { data } = await supabase
          .from('team_members')
          .select('profile_id, status, profile:profiles(nickname, start_number, avatar_url)')
          .eq('season_id', season.id)
          .eq('team_id', t.id)
          .order('status');
        this.members.set((data ?? []) as unknown as Member[]);
      }
    }
    this.loading.set(false);
  }

  private async run(fn: () => PromiseLike<{ error: { message: string; code?: string } | null }>) {
    this.busy.set(true);
    this.error.set(null);
    const { error } = await fn();
    this.busy.set(false);
    if (error) {
      this.error.set(error.code === '23505' ? this.t.translate('team.dupMember') : error.message);
      return false;
    }
    await this.load();
    return true;
  }

  async create() {
    this.busy.set(true);
    const { data, error } = await supabase.from('teams').insert({ name: this.newName.trim(), captain_id: this.profileId() }).select('id').single();
    this.busy.set(false);
    if (error) return this.error.set(error.code === '23505' ? this.t.translate('team.dupTeam') : error.message);
    this.newName = '';
    await this.join(data.id);
  }

  join(teamId: number) {
    return this.run(() => supabase.from('team_members').insert({ season_id: this.seasonId(), profile_id: this.profileId(), team_id: teamId }));
  }

  leave() {
    if (this.myStatus() === 'approved' && !confirm(this.t.translate('team.leaveConfirm'))) return;
    return this.run(() => supabase.from('team_members').delete().match({ season_id: this.seasonId(), profile_id: this.profileId() }));
  }

  remove(m: Member) {
    if (!confirm(this.t.translate('team.removeConfirm', { name: m.profile?.nickname }))) return;
    return this.run(() => supabase.from('team_members').delete().match({ season_id: this.seasonId(), profile_id: m.profile_id }));
  }

  async search() {
    const q = this.query.trim();
    const seq = ++this.searchSeq;
    this.searched.set(false);
    if (q.length < 2) return this.found.set([]);
    const { data } = await supabase.from('profiles').select('id, nickname, start_number').ilike('nickname', `%${q}%`).limit(6);
    if (seq !== this.searchSeq) return;
    this.found.set((data ?? []).filter((p) => !this.members().some((m) => m.profile_id === p.id)));
    this.searched.set(true);
  }

  async invite(profileId: string) {
    const ok = await this.run(() => supabase.from('team_members').insert({ season_id: this.seasonId(), profile_id: profileId, team_id: this.team()!.id }));
    if (ok) {
      this.query = '';
      this.found.set([]);
    }
  }

  async uploadLogo(e: Event, t: Team) {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    this.busy.set(true);
    try {
      const blob = await compressImage(file, 512, 200_000);
      const path = `${t.id}/logo.webp`;
      const up = await supabase.storage.from('team-logos').upload(path, blob, { upsert: true, contentType: 'image/webp' });
      if (up.error) throw up.error;
      const url = `${supabase.storage.from('team-logos').getPublicUrl(path).data.publicUrl}?v=${Date.now()}`;
      await this.run(() => supabase.from('teams').update({ logo_url: url }).eq('id', t.id));
    } catch (err) {
      this.error.set((err as Error).message);
    } finally {
      this.busy.set(false);
    }
  }

  protected initials(name: string) {
    return name.split(/\s+/).map((w) => w[0]).join('').slice(0, 2).toUpperCase();
  }
}
