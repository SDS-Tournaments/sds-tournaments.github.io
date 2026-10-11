import { Component, computed, input, OnInit, signal } from '@angular/core';
import { supabase } from '../auth';
import { teamStage } from '../scoring/scoring';
import { finishStage } from './finish';

interface Row {
  profile_id: string;
  team_id: number | null;
  qual_place: number;
  stage_place: number;
  qual_points: number;
  battle_points: number;
  total: number;
  pilot: { nickname: string; start_number: number | null } | null;
  team: { name: string } | null;
}

export const ACHIEVEMENT_LABEL: Record<string, string> = {
  win: '🏆 Победа',
  first_win: '⭐ Первая победа',
  hat_trick: '🎩 Хет-трик',
  podium: '🥉 Подиум',
  qual_king: '👑 Король квалификации',
  perfect_100: '💯 Идеальные 100',
  omt2: '🔥 Пережил 2 OMT',
};

// Итоги этапа в админке: личный и командный зачёт этапа, достижения, пересчёт
@Component({
  selector: 'app-admin-stage-results',
  template: `
    <section class="card stack">
      <header class="top">
        <h2 class="h">Итоги этапа</h2>
        <button class="btn btn-secondary" (click)="recalc()" [disabled]="busy()">{{ rows().length ? '↻ Пересчитать итоги' : 'Подвести итоги и завершить этап' }}</button>
      </header>
      @if (msg()) { <p [class]="ok() ? 'ok' : 'bad'">{{ msg() }}</p> }

      @if (rows().length) {
        <div class="cols">
          <div class="table-wrap">
            <table class="table">
              <thead><tr><th>#</th><th>Пилот</th><th>Команда</th><th class="num">Квал.</th><th class="num">Очки квал.</th><th class="num">Очки парных</th><th class="num">Итого</th></tr></thead>
              <tbody>
                @for (r of rows(); track r.profile_id) {
                  <tr [class.podium]="r.stage_place <= 3">
                    <td class="mono">{{ r.stage_place }}</td>
                    <td><span class="mono n">{{ r.pilot?.start_number ?? '—' }}</span> {{ r.pilot?.nickname }}</td>
                    <td class="muted">{{ r.team?.name ?? '' }}</td>
                    <td class="num">{{ r.qual_place }}</td>
                    <td class="num">{{ r.qual_points }}</td>
                    <td class="num">{{ r.battle_points }}</td>
                    <td class="num total">{{ r.total }}</td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
          <div class="side">
            <h3>Команды</h3>
            @for (t of teams(); track t.teamId) {
              <p class="team"><span class="mono">{{ t.place }}</span> {{ teamName(t.teamId) }} <b class="mono">{{ t.points }}</b></p>
            } @empty { <p class="subtle">Нет командных результатов</p> }
            <h3>Достижения</h3>
            @for (a of achievements(); track $index) {
              <p class="ach">{{ label[a.code] ?? a.code }} — {{ a.pilot?.nickname }}</p>
            } @empty { <p class="subtle">—</p> }
          </div>
        </div>
      }
    </section>
  `,
  styles: `
    .stack { display: grid; gap: 16px; }
    .top { display: flex; flex-wrap: wrap; gap: 12px; justify-content: space-between; align-items: center; }
    .h { font-size: 20px; }
    .cols { display: grid; gap: 24px; grid-template-columns: 1fr 260px; align-items: start; }
    @media (max-width: 900px) { .cols { grid-template-columns: 1fr; } }
    .n { color: var(--primary); margin-right: 6px; }
    .podium td { background: var(--primary-soft); }
    .total { color: var(--primary); font-weight: 600; }
    .side h3 { font-size: 13px; letter-spacing: 1px; text-transform: uppercase; color: var(--ink-subtle); margin: 0 0 8px; font-weight: 500; }
    .side h3:not(:first-child) { margin-top: 20px; }
    .team { display: flex; gap: 8px; margin: 0 0 6px; b { margin-left: auto; color: var(--primary); } }
    .ach { margin: 0 0 6px; font-size: 14px; }
    .ok { color: var(--primary); margin: 0; }
    .bad { color: var(--error); margin: 0; }
  `,
})
export class AdminStageResults implements OnInit {
  readonly stageId = input.required<number>();
  protected readonly rows = signal<Row[]>([]);
  protected readonly achievements = signal<{ code: string; pilot: { nickname: string } | null }[]>([]);
  private readonly teamNames = signal<Record<number, string>>({});
  protected readonly teams = computed(() =>
    teamStage(this.rows().map((r) => ({ teamId: r.team_id === null ? null : String(r.team_id), total: r.total, stagePlace: r.stage_place }))),
  );
  protected readonly busy = signal(false);
  protected readonly msg = signal<string | null>(null);
  protected readonly ok = signal(true);
  protected readonly label = ACHIEVEMENT_LABEL;

  ngOnInit() {
    this.load();
  }

  private async load() {
    const [rows, ach] = await Promise.all([
      supabase
        .from('stage_results')
        .select('profile_id, team_id, qual_place, stage_place, qual_points, battle_points, total, pilot:profiles(nickname, start_number), team:teams(name)')
        .eq('stage_id', this.stageId())
        .order('stage_place'),
      supabase.from('achievements').select('code, pilot:profiles(nickname)').eq('stage_id', this.stageId()),
    ]);
    const list = (rows.data ?? []) as unknown as Row[];
    this.rows.set(list);
    this.achievements.set((ach.data ?? []) as unknown as { code: string; pilot: { nickname: string } | null }[]);
    this.teamNames.set(Object.fromEntries(list.filter((r) => r.team_id).map((r) => [r.team_id!, r.team?.name ?? ''])));
  }

  protected teamName(id: string) {
    return this.teamNames()[Number(id)] ?? '?';
  }

  async recalc() {
    if (!this.rows().length && !confirm('Подвести итоги и перевести этап в «Завершён»?')) return;
    this.busy.set(true);
    const err = await finishStage(this.stageId());
    this.busy.set(false);
    this.msg.set(err ?? 'Итоги посчитаны, этап завершён');
    this.ok.set(!err);
    await this.load();
  }
}
