// Вымышленный этап для пульта трансляции (режим «Тестовые данные»): 16 пилотов, квалификация, сетка Top 16,
// текущая дуэль с голосами судей и подиум — чтобы посмотреть все плашки без настоящего этапа.
import { CardData } from '../components/pilot-card';

const NAMES = ['Kaido', 'Touge_Ghost', 'NightOwl', 'SmokeUnit', 'Hachiroku', 'Akina_Down', 'RedSuns', 'Usui_Line', 'Clutchkick', 'Feint', 'Manji', 'Choku_Dori', 'Inertia', 'Shakedown', 'Handbrake', 'Gaiden'];
const TEAMS = ['21 Project', 'KISS THE WALL', 'CYBERCATS', null];
const CARS = ['Nishimo SI5', 'Kyoto E86', 'BNM 36E', 'Nishimo 34R', 'Vankel R7D', 'Kyoto S90'];
const NUMS = [7, 21, 33, 44, 86, 101, 13, 9, 88, 110, 66, 3, 12, 55, 27, 5];

export function mockStage(now = Date.now()) {
  const ids = NAMES.map((_, i) => `mock-${i}`);
  const pilots = new Map(
    ids.map((id, i) => [id, { nickname: NAMES[i], start_number: NUMS[i], avatar_url: null, car: CARS[i % CARS.length], team: TEAMS[i % TEAMS.length] }]),
  );
  const regs = ids.map((id, i) => ({ profile_id: id, group_no: Math.floor(i / 8) + 1, queue_order: i + 1 }));
  // оценки: у всех 3 заезда, у последнего — только прогрев и 1-я попытка (он «на трассе»)
  const runs = ids.flatMap((id, i) => {
    const base = 92 - i * 2.4;
    const run = (attempt: number, k: number, ago: number) => {
      const angle = +Math.min(40, base * 0.4 + k).toFixed(1);
      const style = +Math.min(30, base * 0.3 - k / 2).toFixed(1);
      const line = +Math.min(30, base * 0.3 + k / 3).toFixed(1);
      return { profile_id: id, attempt, angle, style, line, spin: false, total: +(angle + style + line).toFixed(1), created_at: new Date(now - ago).toISOString() };
    };
    const list = [run(0, 0, 3_600_000 - i * 60_000), run(1, -1.5, 3_000_000 - i * 60_000)];
    if (i < ids.length - 1) list.push(run(2, 1.2, 2_400_000 - i * 60_000));
    // свежая оценка с разным «жаром» полосок: стиль — максимум (30/30), траектория почти максимум, угол средний
    else list[1] = { ...list[1], angle: 24, style: 30, line: 28.5, total: 82.5, created_at: new Date(now - 3_000).toISOString() };
    return list;
  });
  // сетка Top 16: 1–8 против 16–9; первые 4 пары решены, 5-я идёт сейчас
  const pairs = [0, 7, 4, 3, 2, 5, 6, 1].map((s) => [ids[s], ids[15 - s]] as const);
  const battles = pairs.map(([a, b], slot) => ({
    id: 900 + slot,
    round: 'r16' as const,
    slot,
    leader_id: a,
    chaser_id: b,
    winner_id: slot < 4 ? (slot === 2 ? b : a) : null,
    omt_count: slot === 4 ? 1 : 0,
    status: slot < 4 ? 'done' : 'pending',
    result: slot < 4 ? 'votes' : null,
    decided_at: slot < 4 ? new Date(now - (5 - slot) * 600_000).toISOString() : null,
  }));
  const qf = [0, 1, 2, 3].map((slot) => ({
    id: 920 + slot,
    round: 'qf' as const,
    slot,
    leader_id: slot < 2 ? battles[slot * 2].winner_id : null,
    chaser_id: slot < 2 ? battles[slot * 2 + 1].winner_id : null,
    winner_id: null,
    omt_count: 0,
    status: 'pending',
    result: null,
    decided_at: null,
  }));
  const later = [
    ...[0, 1].map((slot) => ({ round: 'sf' as const, slot })),
    { round: 'third' as const, slot: 0 },
    { round: 'final' as const, slot: 0 },
  ].map((x, i) => ({ id: 940 + i, ...x, leader_id: null, chaser_id: null, winner_id: null, omt_count: 0, status: 'pending', result: null, decided_at: null }));
  const current = battles[4];
  // голоса по текущей дуэли (после 1 OMT): угол — за лидера, стиль — OMT, траектория ещё думает
  const votes = [
    { battle_id: current.id, try: 1, judge: 'angle', vote: 'leader' },
    { battle_id: current.id, try: 1, judge: 'style', vote: 'omt' },
  ];
  const card = (id: string, ovr: number, wins: number): CardData => {
    const p = pilots.get(id)!;
    return { nickname: p.nickname, start_number: p.start_number, avatar_url: null, team: p.team, car: p.car, overall: ovr, angle: ovr + 3, style: ovr - 4, line: ovr + 1, wins };
  };
  return {
    stage: { id: -1, ord: 3, title_ru: 'Этап 3 · Тест', title_en: 'Round 3 · Test', status: 'battles', season_id: -1, weights: { angle: 40, style: 30, line: 30 } },
    pilots,
    regs,
    runs,
    battles: [...battles, ...qf, ...later],
    votes,
    // подиум — для плашки «Подиум» (этап как будто уже подытожен)
    results: [ids[0], ids[3], ids[1]].map((id, i) => ({ profile_id: id, stage_place: i + 1 })),
    cards: { [current.leader_id]: card(current.leader_id, 91, 3), [current.chaser_id]: card(current.chaser_id, 84, 1) } as Record<string, CardData>,
    sponsors: [
      { id: -1, name: 'CarX Technologies', logo_url: null },
      { id: -2, name: 'Sad Drift Series', logo_url: null },
    ],
  };
}
