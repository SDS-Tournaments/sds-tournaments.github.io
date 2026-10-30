import { groupLabel } from './groups';

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
