import { supabase } from '../auth';

/** Тикет трассы: 1 — проехал квалификацию, 2 — попал в сетку (Top 32), 3 — финал, 4 — победа */
export type TicketLevel = 1 | 2 | 3 | 4;
export interface Ticket {
  track: string;
  level: TicketLevel;
  /** этап, где получен этот уровень */
  stageId: number;
  title: string;
}
export interface TicketRow {
  stage_id: number;
  stage_place: number;
  battle_place: number | null;
  track: string | null;
  title: string;
}

/** Уровень за этап по итогам: места в сетке 1 и 2 — победа и финал (stage_results: battle_place есть только у сетки) */
export function ticketLevel(r: { stage_place: number; battle_place: number | null }): TicketLevel {
  if (r.battle_place === null) return 1;
  return r.stage_place === 1 ? 4 : r.stage_place === 2 ? 3 : 2;
}

const key = (track: string) => track.trim().toLowerCase();

/** Один тикет на трассу — лучший уровень (не понижается); первым — где этот уровень получен впервые */
export function bestTickets(rows: TicketRow[]): Ticket[] {
  const m = new Map<string, Ticket>();
  for (const r of [...rows].sort((a, b) => a.stage_id - b.stage_id)) {
    if (!r.track?.trim()) continue;
    const level = ticketLevel(r);
    const k = key(r.track);
    if ((m.get(k)?.level ?? 0) < level) m.set(k, { track: r.track.trim(), level, stageId: r.stage_id, title: r.title });
  }
  return [...m.values()].sort((a, b) => b.level - a.level || a.track.localeCompare(b.track));
}

/** Тикет пилота на конкретной трассе (без текущего этапа) */
export function ticketOn(tickets: Ticket[], track: string | null): Ticket | null {
  return (track && tickets.find((t) => key(t.track) === key(track))) || null;
}

export async function loadTickets(profileId: string): Promise<Ticket[]> {
  const { data } = await supabase.from('stage_results').select('stage_id, stage_place, battle_place, stage:stages(track, title_ru)').eq('profile_id', profileId);
  return bestTickets(
    ((data ?? []) as unknown as { stage_id: number; stage_place: number; battle_place: number | null; stage: { track: string | null; title_ru: string } | null }[]).map((r) => ({
      stage_id: r.stage_id,
      stage_place: r.stage_place,
      battle_place: r.battle_place,
      track: r.stage?.track ?? null,
      title: r.stage?.title_ru ?? '',
    })),
  );
}

/** Все трассы опубликованных этапов — для «ещё не открыты» в кабинете */
export async function loadTracks(): Promise<string[]> {
  const { data } = await supabase.from('stages').select('track').neq('status', 'draft');
  const m = new Map<string, string>();
  for (const s of data ?? []) if (s.track?.trim()) m.set(key(s.track), s.track.trim());
  return [...m.values()].sort((a, b) => a.localeCompare(b));
}
