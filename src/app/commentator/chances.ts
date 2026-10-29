import { Achievement, Fail, Round } from '../scoring/scoring';

/** Подсказка комментатору: какую ачивку пилот может получить и при каком условии */
export interface Chance {
  code: Achievement;
  /** условие простыми словами */
  when: string;
  /** warn — «антиачивка» (спины, 322, деревянная медаль) */
  warn?: boolean;
}

const FAIL_WORD: Record<Fail, string> = { spin: 'спин', crash: 'авария', straight: 'выпрямление', offtrack: 'вылет' };
const PAIR_ACH: Record<Fail, Achievement> = { spin: 'spinner', crash: 'crash2', straight: 'straight2', offtrack: 'offtrack2' };
const fmt = (n: number) => String(Math.round(n * 100) / 100).replace('.', ',');

export interface QualInput {
  /** какую зачётную попытку пилот едет сейчас (null — обе проехал) */
  attempt: 1 | 2 | null;
  /** его зачётные попытки этого этапа */
  runs: { attempt: number; total: number; spin: boolean; fail: Fail | null }[];
  /** лучший результат лидера квалификации среди остальных (null — ещё никто не проехал) */
  leaderBest: number | null;
  /** первый этап SDS для пилота */
  debut: boolean;
}

/** Ачивки, которые решаются в квалификации — для пилота на трассе */
export function qualChances(q: QualInput): Chance[] {
  const out: Chance[] = [];
  const scored = q.runs.filter((r) => r.attempt > 0).sort((a, b) => a.attempt - b.attempt);
  if (q.debut) out.push({ code: 'debut', when: 'Первый этап в SDS — получит после этапа' });
  if (q.attempt === null) return out;

  const best = scored.length ? Math.max(...scored.map((r) => r.total)) : 0;
  if (best < 100) out.push({ code: 'perfect_100', when: 'Нужно 100 баллов за заезд' });
  if (q.leaderBest === null) out.push({ code: 'qual_king', when: 'Пока никто не проехал — сейчас любой результат выводит в лидеры' });
  else if (best <= q.leaderBest) out.push({ code: 'qual_king', when: `Нужно больше ${fmt(q.leaderBest)} (при равенстве решает вторая попытка)` });
  else out.push({ code: 'qual_king', when: 'Сейчас лидирует — получит, если никто не обгонит' });

  const first = scored.find((r) => r.attempt === 1);
  if (q.attempt === 2 && first) {
    if (!first.spin && first.total > 0) out.push({ code: 'sniper', when: `Попытка 2 от ${fmt(first.total - 0.5)} до ${fmt(first.total + 0.5)}` });
    else {
      const f = first.fail ?? 'spin';
      out.push({ code: PAIR_ACH[f], when: `В 1-й попытке ${FAIL_WORD[f]} — ещё раз так же, и ачивка`, warn: true });
    }
  }
  return out;
}

export interface DuelSide {
  id: string;
  qualPlace: number;
  /** выигранные дуэли на этом этапе (до текущей) */
  wins: number;
  /** все выигранные дуэли этапа без OMT */
  winsClean: boolean;
  /** сумма OMT в его дуэлях этапа (до текущей) */
  omtSoFar: number;
  /** последний номер посева в сетке */
  lastSeed: boolean;
  /** уже выигрывал этапы раньше */
  everWon: boolean;
}

export interface DuelInput {
  round: Round;
  /** OMT в текущей дуэли уже было */
  omt: number;
  leader: DuelSide;
  chaser: DuelSide;
  /** победители прошлых этапов сезона по порядку (последний — чемпион прошлого этапа) */
  prevWinners: string[];
  /** дуэли прошлого этапа сезона: кто кого выбил */
  prevDuels: { winner: string; loser: string }[];
}

/** Ачивки, которые решит эта дуэль, — отдельно для лидера и чейзера */
export function duelChances(d: DuelInput): { leader: Chance[]; chaser: Chance[] } {
  const champ = d.prevWinners.at(-1);
  const side = (me: DuelSide, rival: DuelSide): Chance[] => {
    const out: Chance[] = [];
    const win = (code: Achievement, why: string) => out.push({ code, when: `Победа — ${why}` });
    if (me.qualPlace - rival.qualPlace >= 8) win('giant_slayer', `соперник выше в квале на ${me.qualPlace - rival.qualPlace} мест`);
    if (champ && champ === rival.id) win('regicide', 'соперник — чемпион прошлого этапа');
    if (d.prevDuels.some((x) => x.winner === rival.id && x.loser === me.id)) win('revenge', 'соперник выбил его на прошлом этапе');
    if (me.lastSeed && !me.wins) win('last_wagon', 'попал в сетку последним номером посева');
    if (rival.lastSeed && me.qualPlace === 1) out.push({ code: 'throw_322', when: 'Проиграет последнему номеру посева, выиграв квалификацию', warn: true });
    if (d.omt >= 2) win('omt2', 'после двух перезаездов');
    else if (d.omt === 1) out.push({ code: 'omt2', when: 'Ещё один OMT — и победитель получит' });
    if (me.omtSoFar + d.omt >= 2) out.push({ code: 'marathon', when: `У него уже ${me.omtSoFar + d.omt} OMT на этапе — ещё один, и ачивка` });
    if (d.round === 'sf' || d.round === 'third') {
      const podium = d.round === 'sf' ? 'выход в финал = подиум' : '3-е место';
      win('podium', podium);
      if (me.qualPlace >= 9) win('underdog', `${podium} с ${me.qualPlace}-го места квалификации`);
    }
    if (d.round === 'third') out.push({ code: 'wooden', when: 'Поражение — 4-е место', warn: true });
    if (d.round === 'final') {
      win('win', 'победа на этапе');
      if (!me.everWon) win('first_win', 'первая победа на этапе');
      if (champ === me.id) win('back_to_back', 'выиграл и прошлый этап');
      if (d.prevWinners.length >= 2 && d.prevWinners.slice(-2).every((w) => w === me.id)) win('hat_trick', 'третий этап подряд');
      if (me.winsClean && d.omt === 0) out.push({ code: 'flawless', when: 'Победа без OMT — ни одной дуэли этапа с перезаездом' });
    }
    return out;
  };
  return { leader: side(d.leader, d.chaser), chaser: side(d.chaser, d.leader) };
}

/** Сколько нужно в квалификации: лидер и порог попадания в сетку (лучший результат на последнем проходном месте) */
export function qualTargets(standings: { id: string; best: number }[], me: string, cut: number): { leader: number | null; cutLine: number | null } {
  const others = standings.filter((s) => s.id !== me);
  return { leader: others[0]?.best ?? null, cutLine: others.length >= cut ? others[cut - 1].best : null };
}
