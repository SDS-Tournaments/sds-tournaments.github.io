import { bestTickets, ticketLevel, ticketOn } from './tickets';

describe('tickets', () => {
  it('уровень по итогам этапа', () => {
    expect(ticketLevel({ stage_place: 40, battle_place: null })).toBe(1);
    expect(ticketLevel({ stage_place: 17, battle_place: 17 })).toBe(2);
    expect(ticketLevel({ stage_place: 2, battle_place: 2 })).toBe(3);
    expect(ticketLevel({ stage_place: 1, battle_place: 1 })).toBe(4);
  });
  it('один тикет на трассу — лучший, без понижения; трасса без названия не считается', () => {
    const t = bestTickets([
      { stage_id: 1, stage_place: 2, battle_place: 2, track: 'ADM 1', title: 'Этап 1' },
      { stage_id: 5, stage_place: 30, battle_place: null, track: ' adm 1 ', title: 'Этап 5' },
      { stage_id: 3, stage_place: 9, battle_place: 9, track: 'Ebisu', title: 'Этап 3' },
      { stage_id: 4, stage_place: 1, battle_place: 1, track: null, title: 'Этап 4' },
    ]);
    expect(t).toEqual([
      { track: 'ADM 1', level: 3, stageId: 1, title: 'Этап 1' },
      { track: 'Ebisu', level: 2, stageId: 3, title: 'Этап 3' },
    ]);
    expect(ticketOn(t, 'Adm 1')?.level).toBe(3);
    expect(ticketOn(t, 'Tsukuba')).toBeNull();
  });
});
