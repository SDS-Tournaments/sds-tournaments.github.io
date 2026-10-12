import { supabase } from '../auth';
import { SkillRun } from '../scoring/scoring';

/** Оценки пилота для навыков: веса критериев берутся у этапа */
export async function loadSkillRuns(profileId: string): Promise<SkillRun[]> {
  const { data } = await supabase.from('qual_runs').select('attempt, angle, style, line, spin, stage:stages(weights)').eq('profile_id', profileId);
  return ((data ?? []) as unknown as (Omit<SkillRun, 'weights'> & { stage: { weights: SkillRun['weights'] } | null })[]).map((r) => ({
    ...r,
    weights: r.stage?.weights ?? { angle: 40, style: 30, line: 30 },
  }));
}
