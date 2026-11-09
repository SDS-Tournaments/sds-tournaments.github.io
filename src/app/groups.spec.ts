import { confirmedFirst, groupLabel, restoreSpot } from './groups';

describe('groupLabel', () => {
  it('буфер — своё название, обычные группы нумеруются без буферов', () => {
    const meta = [{}, { buffer: true, name: 'EN сервер' }, {}, { buffer: true }];
    expect(groupLabel(1, meta)).toBe('Группа 1');
    expect(groupLabel(2, meta)).toBe('EN сервер');
    expect(groupLabel(3, meta)).toBe('Группа 2');
    expect(groupLabel(4, meta)).toBe('Буфер');
    expect(groupLabel(5, [])).toBe('Группа 5');
    expect(groupLabel(null, meta)).toBe('Группа —');
  });
});

const reg = (profile_id: string, group_no: number, queue_order: number, status = 'registered') => ({ profile_id, group_no, queue_order, status });
const rode = (...ids: string[]) => ids.flatMap((profile_id) => [{ profile_id, attempt: 1 }, { profile_id, attempt: 2 }]);

describe('confirmedFirst', () => {
  it('подтвердившие вперёд, порядок внутри частей сохраняется', () => {
    expect(confirmedFirst([1, 2, 3, 4, 5], (x) => x % 2 === 0)).toEqual([2, 4, 1, 3, 5]);
  });
});

describe('restoreSpot', () => {
  const regs = [reg('a', 1, 1, 'no_show'), reg('b', 1, 2), reg('c', 2, 3), reg('d', 2, 4), reg('e', 3, 5), reg('f', 3, 6, 'no_show')];

  it('оценок ещё нет — на своё место', () => {
    expect(restoreSpot(regs, [], 'a')).toEqual({ group_no: 1, queue_order: 1 });
  });
  it('очередь ещё не дошла до его места — на своё место', () => {
    expect(restoreSpot(regs, rode('b'), 'f')).toEqual({ group_no: 3, queue_order: 6 });
  });
  it('очередь прошла его место — между последним в идущей группе и следующей группой', () => {
    expect(restoreSpot(regs, rode('b', 'c'), 'a')).toEqual({ group_no: 2, queue_order: 4.5 });
  });
  it('идёт последняя группа — в её конец', () => {
    expect(restoreSpot(regs, rode('b', 'c', 'd'), 'a')).toEqual({ group_no: 3, queue_order: 7 });
  });
  it('все проехали — на своё место, станет следующим', () => {
    expect(restoreSpot(regs, rode('b', 'c', 'd', 'e'), 'a')).toEqual({ group_no: 1, queue_order: 1 });
  });
});
