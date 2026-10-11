import { supabase } from '../auth';
import { BattleResult, finishesFrom, PointsTable, qualStandings, Round, stageAchievements, stagePlaces, stagePoints } from '../scoring/scoring';

/**
 * §5.7 Итоги этапа: места, очки по таблицам сезона, команда из подтверждённого состава сезона,
 * достижения, статус «Завершён». Повторный запуск пересчитывает всё заново.
 * Возвращает текст ошибки или null.
 */
export async function finishStage(stageId: number): Promise<string | null> {
  const { data: stage, error: e1 } = await supabase.from('stages').select('id, season_id, ord').eq('id', stageId).single();
  if (e1) return e1.message;
  const [season, regs, runs, battles, members, prevStages] = await Promise.all([
    supabase.from('seasons').select('qual_points, battle_points').eq('id', stage.season_id).single(),
    supabase.from('registrations').select('profile_id, queue_order, status').eq('stage_id', stageId),
    supabase.from('qual_runs').select('profile_id, attempt, total').eq('stage_id', stageId),
    supabase.from('battles').select('round, leader_id, chaser_id, winner_id, result, omt_count').eq('stage_id', stageId),
    supabase.from('team_members').select('profile_id, team_id').eq('season_id', stage.season_id).eq('status', 'approved'),
    supabase.from('stages').select('id').eq('season_id', stage.season_id).eq('status', 'finished').lt('ord', stage.ord).order('ord'),
  ]);
  const err = [season, regs, runs, battles, members, prevStages].find((r) => r.error)?.error;
  if (err) return err.message;

  const table: PointsTable = { qual: season.data!.qual_points, battle: season.data!.battle_points };
  const registered = (regs.data ?? []).filter((r) => r.status === 'registered');
  const dq = new Set((regs.data ?? []).filter((r) => r.status === 'dq').map((r) => r.profile_id));
  const qual = qualStandings(
    registered.map((r) => ({
      id: r.profile_id,
      queueOrder: r.queue_order ?? 1e9,
      runs: (runs.data ?? []).filter((x) => x.profile_id === r.profile_id),
    })),
  );
  const finishes = finishesFrom(
    (battles.data ?? []).map(
      (b): BattleResult => ({ round: b.round as Round, leader: b.leader_id, chaser: b.chaser_id, winner: b.winner_id, bye: b.result === 'bye' }),
    ),
  );
  const teamOf = new Map((members.data ?? []).map((m) => [m.profile_id, m.team_id]));
  const places = stagePlaces(qual, finishes, dq);

  const results = places.map((p) => {
    const pts = stagePoints(p.qualPlace, p.finish, table);
    return {
      stage_id: stageId,
      profile_id: p.id,
      team_id: teamOf.get(p.id) ?? null,
      qual_place: p.qualPlace,
      battle_place: p.finish ? p.stagePlace : null,
      stage_place: p.stagePlace,
      qual_points: pts.qual,
      battle_points: pts.battle,
    };
  });

  // Достижения: история побед — из уже завершённых этапов
  const prevIds = (prevStages.data ?? []).map((s) => s.id);
  const [prevWins, everWins] = await Promise.all([
    prevIds.length ? supabase.from('stage_results').select('stage_id, profile_id').in('stage_id', prevIds).eq('stage_place', 1) : Promise.resolve({ data: [] }),
    supabase.from('stage_results').select('profile_id').eq('stage_place', 1).neq('stage_id', stageId),
  ]);
  const prevWinners = prevIds.map((id) => (prevWins.data ?? []).find((w) => w.stage_id === id)?.profile_id ?? '');
  const best = new Map(qual.map((q) => [q.id, q.best]));
  const omt2 = new Set((battles.data ?? []).filter((b) => b.omt_count >= 2 && b.winner_id).map((b) => b.winner_id as string));
  const achievements = stageAchievements(
    places.map((p) => ({ id: p.id, stagePlace: p.stagePlace, qualPlace: p.qualPlace, best: best.get(p.id) ?? 0 })),
    prevWinners,
    new Set((everWins.data ?? []).map((w) => w.profile_id)),
    omt2,
  ).map((a) => ({ profile_id: a.id, code: a.code, stage_id: stageId }));

  // Пересчёт с нуля
  const steps = [
    () => supabase.from('stage_results').delete().eq('stage_id', stageId),
    () => supabase.from('achievements').delete().eq('stage_id', stageId),
    () => (results.length ? supabase.from('stage_results').insert(results) : Promise.resolve({ error: null })),
    () => (achievements.length ? supabase.from('achievements').insert(achievements) : Promise.resolve({ error: null })),
    () => supabase.from('stages').update({ status: 'finished' }).eq('id', stageId),
  ];
  for (const step of steps) {
    const { error } = await step();
    if (error) return error.message;
  }
  return null;
}
