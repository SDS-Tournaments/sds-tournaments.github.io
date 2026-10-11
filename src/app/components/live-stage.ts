import { Component, computed, DestroyRef, inject, input, OnInit, signal } from '@angular/core';
import { DomSanitizer } from '@angular/platform-browser';
import { TranslocoPipe } from '@jsverse/transloco';
import { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from '../auth';
import { qualStandings } from '../scoring/scoring';

interface Pilot {
  nickname: string;
  start_number: number | null;
}
interface Battle {
  round: string;
  slot: number;
  leader_id: string | null;
  chaser_id: string | null;
  winner_id: string | null;
  status: string;
  omt_count: number;
}
const ORDER = ['r32', 'r16', 'qf', 'sf', 'third', 'final'];

// Прямой эфир этапа на главной: Twitch + живые данные (топ квалификации или текущая дуэль)
@Component({
  selector: 'app-live-stage',
  imports: [TranslocoPipe],
  template: `
    <div class="wrap">
      <div class="player">
        @if (playerUrl(); as url) {
          <iframe [src]="url" allowfullscreen title="Twitch"></iframe>
        } @else {
          <div class="noplayer subtle">{{ 'live.noStream' | transloco }}</div>
        }
      </div>

      <aside class="card side">
        @if (status() === 'battles') {
          <p class="eyebrow">{{ 'live.battle' | transloco }}</p>
          @if (current(); as b) {
            <p class="round subtle">{{ 'round.' + b.round | transloco }}
              @if (b.omt_count) { · OMT {{ b.omt_count }} }
            </p>
            <div class="vs">
              @for (pid of [b.leader_id, b.chaser_id]; track $index) {
                <div class="pl">
                  <span class="plate mono">{{ p(pid).start_number ?? '—' }}</span>
                  <span class="nick">{{ p(pid).nickname }}</span>
                </div>
                @if ($index === 0) { <span class="x mono">VS</span> }
              }
            </div>
          } @else {
            <p class="subtle">{{ 'live.waiting' | transloco }}</p>
          }
          @if (lastWinner(); as w) {
            <p class="last">{{ 'live.lastWin' | transloco: { name: w } }}</p>
          }
        } @else {
          <p class="eyebrow">{{ 'live.qual' | transloco }}</p>
          <ol class="top">
            @for (r of top(); track r.id) {
              <li class="rise-row">
                <span class="mono pl-place">{{ r.place }}</span>
                <span class="mono n">{{ p(r.id).start_number ?? '—' }}</span>
                <span class="nick">{{ p(r.id).nickname }}</span>
                <span class="mono score">{{ r.best }}</span>
              </li>
            } @empty {
              <li class="subtle">{{ 'live.noScores' | transloco }}</li>
            }
          </ol>
        }
      </aside>
    </div>
  `,
  styles: `
    .wrap { display: grid; gap: 16px; grid-template-columns: 1fr 340px; align-items: stretch; }
    @media (max-width: 900px) { .wrap { grid-template-columns: 1fr; } }
    .player { aspect-ratio: 16 / 9; border-radius: var(--r-lg); overflow: hidden; border: 1px solid var(--hairline-strong); background: var(--surface-1); }
    iframe { width: 100%; height: 100%; border: 0; display: block; }
    .noplayer { height: 100%; display: grid; place-items: center; }
    .side { display: grid; align-content: start; gap: 12px; padding: 20px; }
    .eyebrow { margin: 0; }
    .round { margin: 0; font-size: 13px; }
    .vs { display: grid; grid-template-columns: 1fr auto 1fr; align-items: center; gap: 8px; text-align: center; }
    .pl { display: grid; gap: 4px; justify-items: center; padding: 12px 4px; border-radius: var(--r-md); background: var(--surface-2); }
    .plate { font-size: 32px; font-weight: 600; font-style: italic; text-shadow: 2px 2px 0 var(--primary); line-height: 1; }
    .nick { font-weight: 500; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 100%; }
    .x { color: var(--primary); }
    .last { margin: 0; font-size: 14px; color: var(--ink-muted); }
    .top { list-style: none; margin: 0; padding: 0; display: grid; gap: 4px; }
    .top li { display: grid; grid-template-columns: 24px 36px 1fr auto; gap: 8px; align-items: center; padding: 8px 10px; border-radius: var(--r-sm); background: var(--surface-2); font-size: 14px; }
    .top li:first-child { box-shadow: inset 3px 0 0 var(--primary); }
    .pl-place { color: var(--ink-subtle); }
    .n { color: var(--primary); }
    .score { color: var(--primary); font-weight: 500; }
    .rise-row { animation: rise 500ms var(--ease-out) both; }
  `,
})
export class LiveStage implements OnInit {
  readonly stageId = input.required<number>();
  readonly status = input.required<string>();
  readonly channel = input<string | null>(null);

  private readonly pilots = signal(new Map<string, Pilot>());
  private readonly regs = signal<{ profile_id: string; queue_order: number | null }[]>([]);
  private readonly runs = signal<{ profile_id: string; attempt: number; total: number }[]>([]);
  private readonly battles = signal<Battle[]>([]);
  private readonly sanitizer = inject(DomSanitizer);
  private sub?: RealtimeChannel;

  protected readonly playerUrl = computed(() => {
    const ch = this.channel();
    if (!ch) return null;
    // Twitch требует parent = домен сайта
    const url = `https://player.twitch.tv/?channel=${encodeURIComponent(ch)}&parent=${location.hostname}&muted=true`;
    return this.sanitizer.bypassSecurityTrustResourceUrl(url);
  });
  protected readonly top = computed(() =>
    qualStandings(
      this.regs().map((r) => ({ id: r.profile_id, queueOrder: r.queue_order ?? 1e9, runs: this.runs().filter((x) => x.profile_id === r.profile_id) })),
    ).slice(0, 8),
  );
  private readonly sorted = computed(() => [...this.battles()].sort((a, b) => ORDER.indexOf(a.round) - ORDER.indexOf(b.round) || a.slot - b.slot));
  protected readonly current = computed(() => this.sorted().find((b) => b.status !== 'done' && b.leader_id && b.chaser_id) ?? null);
  protected readonly lastWinner = computed(() => {
    const done = this.sorted().filter((b) => b.status === 'done' && b.winner_id && b.leader_id && b.chaser_id);
    const w = done.at(-1)?.winner_id;
    return w ? this.p(w).nickname : null;
  });

  constructor() {
    inject(DestroyRef).onDestroy(() => this.sub && supabase.removeChannel(this.sub));
  }

  async ngOnInit() {
    await this.load();
    const f = `stage_id=eq.${this.stageId()}`;
    this.sub = supabase
      .channel(`live-${this.stageId()}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'qual_runs', filter: f }, () => this.load())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'battles', filter: f }, () => this.load())
      .subscribe();
  }

  private async load() {
    const id = this.stageId();
    const [regs, runs, battles] = await Promise.all([
      supabase.from('registrations').select('profile_id, queue_order, profile:profiles(nickname, start_number)').eq('stage_id', id).eq('status', 'registered'),
      supabase.from('qual_runs').select('profile_id, attempt, total').eq('stage_id', id),
      supabase.from('battles').select('round, slot, leader_id, chaser_id, winner_id, status, omt_count').eq('stage_id', id),
    ]);
    const r = (regs.data ?? []) as unknown as { profile_id: string; queue_order: number | null; profile: Pilot | null }[];
    this.pilots.set(new Map(r.map((x) => [x.profile_id, x.profile ?? { nickname: '?', start_number: null }])));
    this.regs.set(r);
    this.runs.set(runs.data ?? []);
    this.battles.set(battles.data ?? []);
  }

  protected p(id: string | null): Pilot {
    return (id && this.pilots().get(id)) || { nickname: '—', start_number: null };
  }
}
