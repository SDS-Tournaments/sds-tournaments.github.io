import { supabase } from '../auth';
import { seasonStandings, teamSeason, teamStage } from '../scoring/scoring';

export interface PilotStanding {
  id: string;
  place: number;
  points: number;
  nickname: string;
  start_number: number | null;
  avatar_url: string | null;
  team: string | null;
}
export interface TeamStanding {
  id: string;
  place: number;
  points: number;
  name: string;
  logo_url: string | null;
}

interface ResultRow {
  stage_id: number;
  profile_id: string;
  team_id: number | null;
  qual_place: number;
  stage_place: number;
  total: number;
  pilot: { nickname: string; start_number: number | null; avatar_url: string | null } | null;
  team: { name: string; logo_url: string | null } | null;
}

/** Активный сезон (или последний, если активного нет) */
export async function currentSeason() {
  const { data } = await supabase.from('seasons').select('id, number, title, status, team_counted').neq('status', 'draft').order('number', { ascending: false });
  return (data ?? []).find((s) => s.status === 'active') ?? data?.[0] ?? null;
}

/** §5.6 Личный и командный зачёт сезона по итогам завершённых этапов */
export async function loadStandings(seasonId: number, teamCounted = 3): Promise<{ pilots: PilotStanding[]; teams: TeamStanding[]; stages: number }> {
  const { data: stages } = await supabase.from('stages').select('id').eq('season_id', seasonId).eq('status', 'finished').order('ord');
  const ids = (stages ?? []).map((s) => s.id);
  if (!ids.length) return { pilots: [], teams: [], stages: 0 };
  const { data } = await supabase
    .from('stage_results')
    .select('stage_id, profile_id, team_id, qual_place, stage_place, total, pilot:profiles(nickname, start_number, avatar_url), team:teams(name, logo_url)')
    .in('stage_id', ids);
  const rows = (data ?? []) as unknown as ResultRow[];
  const byStage = ids.map((id) => rows.filter((r) => r.stage_id === id));

  const personal = seasonStandings(byStage.map((s) => s.map((r) => ({ id: r.profile_id, total: r.total, stagePlace: r.stage_place, qualPlace: r.qual_place }))));
  // последняя известная команда и данные пилота
  const last = new Map<string, ResultRow>();
  for (const r of rows) last.set(r.profile_id, r);
  const pilots = personal.map((p) => {
    const r = last.get(p.id)!;
    return { ...p, nickname: r.pilot?.nickname ?? '?', start_number: r.pilot?.start_number ?? null, avatar_url: r.pilot?.avatar_url ?? null, team: r.team?.name ?? null };
  });

  const stageTeams = byStage.map((s) => teamStage(s.map((r) => ({ teamId: r.team_id ? String(r.team_id) : null, total: r.total, stagePlace: r.stage_place })), teamCounted));
  const members = new Map<string, string[]>();
  const teamInfo = new Map<string, { name: string; logo_url: string | null }>();
  for (const r of rows) {
    if (!r.team_id) continue;
    const t = String(r.team_id);
    members.set(t, [...new Set([...(members.get(t) ?? []), r.profile_id])]);
    if (r.team) teamInfo.set(t, r.team);
  }
  const teams = teamSeason(stageTeams, members, personal).map((t) => ({ ...t, name: teamInfo.get(t.id)?.name ?? '?', logo_url: teamInfo.get(t.id)?.logo_url ?? null }));
  return { pilots, teams, stages: ids.length };
}
