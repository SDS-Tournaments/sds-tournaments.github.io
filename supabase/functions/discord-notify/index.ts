// Оповещения в Discord: регистрация открыта, этап начался, какая группа едет / готовится, итоги этапа (+ лидер сезона), новый протест, тест из админки.
// Два канала: RU и EN (зарубежные пилоты) — каждое объявление уходит в оба на своём языке; протесты — только в RU (штабу).
// Тестовый канал: test: true в запросе (штаб, «Прогнать все сообщения») или включённый тестовый режим — всё уходит только туда,
// оба языка подряд, с пометкой «🧪 ТЕСТ»; протест в тесте не помечается отправленным и может быть любой давности.
// Вебхуки — в private_settings (видны только admin). Вызывать может: штаб — любые события, пилот — только свой свежий протест.
import { createClient } from 'npm:@supabase/supabase-js@2';

const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const SITE = (Deno.env.get('SITE_URLS') ?? '').split(',')[0].trim();
const TIFFANY = 0x0abab5;
const RED = 0xff5c5c;
const AMBER = 0xf5b942;

type Lang = 'ru' | 'en';
type Embed = Record<string, unknown>;

const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, content-type, apikey, x-client-info' };
const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { ...cors, 'Content-Type': 'application/json' } });
/** канал Twitch: в настройках могут вписать и имя, и ссылку twitch.tv/имя */
const twitchName = (v: string | null | undefined) => v?.trim().replace(/^.*twitch\.tv\//i, '').split(/[/?#]/)[0] || null;
const date = (iso: string | null, l: Lang) =>
  iso
    ? new Date(iso).toLocaleString(l === 'en' ? 'en-GB' : 'ru-RU', { timeZone: 'Europe/Moscow', day: '2-digit', month: l === 'en' ? 'short' : '2-digit', hour: '2-digit', minute: '2-digit' }) +
      (l === 'en' ? ' MSK (UTC+3)' : ' МСК')
    : l === 'en' ? 'date TBA' : 'дата уточняется';

const T = {
  ru: {
    testTitle: '✅ Вебхук работает',
    testText: 'Тестовое сообщение из «Админка → Discord». Сюда будут приходить: открытие регистрации, старт этапа, итоги и новые протесты.',
    regTitle: '📝 Открыта регистрация',
    day1: 'День 1 · Квалификация',
    day2: 'День 2 · Парные заезды Top 32',
    regWhere: 'Регистрация — в личном кабинете на сайте',
    liveTitle: '🔴 LIVE — этап начался',
    liveText: 'Квалификация уже идёт!',
    table: 'Онлайн-таблица',
    battlesTitle: '🔴 LIVE — парные заезды',
    battlesText: 'Top 32 стартует — дуэли до финала!',
    bracket: 'Сетка',
    resTitle: '🏁 Итоги этапа',
    leader: 'Лидер сезона',
    group: 'Группа',
    buffer: 'Буфер',
    onTrack: 'на трассе',
    now: '🟢 Едет',
    next: '⏳ Готовится',
    last: 'Это последняя группа квалификации.',
  },
  en: {
    testTitle: '✅ Webhook works',
    testText: 'Test message from the SDS admin panel. This channel will get: registration opening, round start, results.',
    regTitle: '📝 Registration is open',
    day1: 'Day 1 · Qualifying',
    day2: 'Day 2 · Top 32 battles',
    regWhere: 'Sign up in your account on the website',
    liveTitle: '🔴 LIVE — the round has started',
    liveText: 'Qualifying is underway!',
    table: 'Live standings',
    battlesTitle: '🔴 LIVE — battles',
    battlesText: 'Top 32 is on — battles all the way to the final!',
    bracket: 'Bracket',
    resTitle: '🏁 Round results',
    leader: 'Season leader',
    group: 'Group',
    buffer: 'Buffer',
    onTrack: 'on track',
    now: '🟢 Now driving',
    next: '⏳ Get ready',
    last: 'This is the last qualifying group.',
  },
};

async function stageInfo(id: number) {
  const { data } = await db
    .from('stages')
    .select('id, ord, title_ru, title_en, track, starts_at, battles_at, twitch_channel, group_meta, season:seasons(id, title, team_counted)')
    .eq('id', id)
    .single();
  return data as unknown as { id: number; ord: number; title_ru: string; title_en: string | null; track: string | null; starts_at: string | null; battles_at: string | null; twitch_channel: string | null; group_meta: GroupMeta[] | null; season: { id: number; title: string } };
}

type GroupMeta = { buffer?: boolean; name?: string | null };
/** как groupLabel на сайте (src/app/groups.ts): буфер — своё название, обычные — по порядку без буферов */
function groupLabel(no: number, meta: GroupMeta[] | null, l: Lang) {
  const m = meta ?? [];
  if (m[no - 1]?.buffer) return m[no - 1].name?.trim() || T[l].buffer;
  return `${T[l].group} ${no - m.slice(0, no - 1).filter((x) => x?.buffer).length}`;
}

async function send(hook: string, embed: Embed) {
  const res = await fetch(hook, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      username: 'Sad Drift Series',
      avatar_url: SITE ? `${SITE}/icon.png` : undefined,
      embeds: [{ ...embed, thumbnail: SITE ? { url: `${SITE}/icon.png` } : undefined, footer: { text: 'Sad Drift Series · CarX Drift Racing Online 2' }, timestamp: new Date().toISOString() }],
    }),
  });
  return res.ok ? null : `Discord ответил ${res.status}`;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: cors });

  const token = req.headers.get('Authorization')?.replace('Bearer ', '') ?? '';
  const { data: who } = await db.auth.getUser(token);
  const uid = who.user?.id;
  if (!uid) return json({ error: 'Нужен вход' }, 401);
  const { data: me } = await db.from('profiles').select('role').eq('id', uid).single();
  const staff = me?.role === 'admin' || me?.role === 'staff';

  const body = await req.json();
  const { type, id, lang } = body;
  const { data: settings } = await db.from('private_settings').select('discord_webhook_url, discord_webhook_en, discord_webhook_test, discord_test_mode').eq('id', 1).single();
  const testRun = (staff && body.test === true) || lang === 'test' || !!settings?.discord_test_mode;
  if (testRun && !staff && type !== 'protest') return json({ error: 'Только для штаба' }, 403);
  const hooks: Partial<Record<Lang, string>> = {};
  if (testRun) {
    // тест: оба языка — в один тестовый канал; нет тестового вебхука — никуда (настоящие каналы не трогаем)
    if (!settings?.discord_webhook_test) return json({ skipped: 'тестовый вебхук не настроен' });
    hooks.ru = hooks.en = settings.discord_webhook_test;
  } else {
    if (settings?.discord_webhook_url) hooks.ru = settings.discord_webhook_url;
    if (settings?.discord_webhook_en) hooks.en = settings.discord_webhook_en;
  }

  /** готовое сообщение на нужном языке; null — в этот канал не шлём */
  let build: (l: Lang) => Embed | null;

  if (type === 'test') {
    if (!staff) return json({ error: 'Только для штаба' }, 403);
    const only: Lang = lang === 'en' ? 'en' : 'ru'; // lang 'test' — тестовый канал, сообщение по-русски
    build = (l) => (l === only ? { title: T[l].testTitle, description: T[l].testText, color: TIFFANY, url: SITE || undefined } : null);
  } else if (type === 'protest') {
    const { data: p } = await db
      .from('protests')
      .select('id, profile_id, created_at, notified_at, reason, video_url, battle:battles(round), pilot:profiles!protests_profile_id_fkey(nickname, start_number), stage:stages(title_ru)')
      .eq('id', id)
      .single();
    const pr = p as unknown as { profile_id: string; created_at: string; notified_at: string | null; reason: string; video_url: string; battle: { round: string } | null; pilot: { nickname: string; start_number: number | null } | null; stage: { title_ru: string } | null };
    if (!pr || (!staff && pr.profile_id !== uid)) return json({ error: 'Нет доступа' }, 403);
    if (!testRun) {
      if (pr.notified_at) return json({ skipped: 'уже отправлено' });
      if (Date.now() - Date.parse(pr.created_at) > 10 * 60_000) return json({ skipped: 'протест старше 10 минут' });
    }
    if (!hooks.ru) return json({ skipped: 'вебхук не настроен' });
    if (!testRun) await db.from('protests').update({ notified_at: new Date().toISOString() }).eq('id', id);
    // протест — дело штаба, только в русский канал
    build = (l) =>
      l === 'ru'
        ? {
            title: '⚠ Новый протест',
            description: `**#${pr.pilot?.start_number ?? '—'} ${pr.pilot?.nickname}** оспаривает поражение (${pr.battle?.round ?? ''}) — ${pr.stage?.title_ru ?? ''}\n\n> ${pr.reason.slice(0, 300)}`,
            color: AMBER,
            fields: [{ name: 'Видео', value: pr.video_url }],
            url: SITE ? `${SITE}/admin/protests` : undefined,
          }
        : null;
  } else {
    if (!staff) return json({ error: 'Только для штаба' }, 403);
    const s = await stageInfo(id);
    if (!s) return json({ error: 'Этап не найден' }, 404);
    const link = SITE ? `${SITE}/stages/${s.id}` : undefined;
    const name = (l: Lang) => `${s.season.title} · ${(l === 'en' && s.title_en) || s.title_ru}${s.track ? ` · ${s.track}` : ''}`;

    if (type === 'registration') {
      build = (l) => ({
        title: T[l].regTitle,
        description: `**${name(l)}**\n${T[l].day1}: ${date(s.starts_at, l)}${s.battles_at ? `\n${T[l].day2}: ${date(s.battles_at, l)}` : ''}\n\n${T[l].regWhere}${SITE ? `: ${SITE}/me` : '.'}`,
        color: TIFFANY,
        url: link,
      });
    } else if (type === 'stage_start' || type === 'battles_start') {
      const tw = twitchName(s.twitch_channel ?? (await db.from('app_settings').select('twitch_channel').eq('id', 1).single()).data?.twitch_channel);
      const qual = type === 'stage_start';
      build = (l) => ({
        title: qual ? T[l].liveTitle : T[l].battlesTitle,
        description: `**${name(l)}**\n${qual ? T[l].liveText : T[l].battlesText}${tw ? `\n\n📺 https://twitch.tv/${tw}` : ''}${link ? `\n🏁 ${qual ? T[l].table : T[l].bracket}: ${link}` : ''}`,
        color: RED,
        url: link,
      });
    } else if (type === 'groups') {
      // группа на трассе = первая по очереди, где кто-то ещё не проехал обе зачётные; следующая — за ней
      const [{ data: regs }, { data: runs }] = await Promise.all([
        db.from('registrations').select('profile_id, group_no, queue_order, pilot:profiles(nickname, start_number)').eq('stage_id', id).eq('status', 'registered').not('group_no', 'is', null).order('queue_order'),
        db.from('qual_runs').select('profile_id, attempt').eq('stage_id', id).in('attempt', [1, 2]),
      ]);
      const rows = (regs ?? []) as unknown as { profile_id: string; group_no: number; pilot: { nickname: string; start_number: number | null } | null }[];
      const n = new Map<string, number>();
      for (const r of runs ?? []) n.set(r.profile_id, (n.get(r.profile_id) ?? 0) + 1);
      const order = [...new Set(rows.map((r) => r.group_no))];
      const pending = order.filter((g) => rows.some((r) => r.group_no === g && (n.get(r.profile_id) ?? 0) < 2));
      const [now, next] = pending;
      if (!now) return json({ skipped: 'квалификация проехана' });
      const list = (g: number) => {
        const names = rows.filter((r) => r.group_no === g).map((r) => `#${r.pilot?.start_number ?? '—'} ${r.pilot?.nickname ?? '?'}`);
        return (names.length > 30 ? [...names.slice(0, 30), `… +${names.length - 30}`] : names).join(' · ').slice(0, 1000) || '—';
      };
      build = (l) => ({
        title: `🏁 ${groupLabel(now, s.group_meta, l)} — ${T[l].onTrack}`,
        description: `**${name(l)}**`,
        color: RED,
        url: link,
        fields: [
          { name: `${T[l].now}: ${groupLabel(now, s.group_meta, l)}`, value: list(now) },
          next ? { name: `${T[l].next}: ${groupLabel(next, s.group_meta, l)}`, value: list(next) } : { name: T[l].next, value: T[l].last },
        ],
      });
    } else if (type === 'results') {
      const { data: top } = await db.from('stage_results').select('stage_place, total, pilot:profiles(nickname)').eq('stage_id', id).lte('stage_place', 3).order('stage_place');
      const medals = ['🥇', '🥈', '🥉'];
      const podium = ((top ?? []) as unknown as { stage_place: number; total: number; pilot: { nickname: string } | null }[])
        .map((r) => `${medals[r.stage_place - 1]} **${r.pilot?.nickname}** — ${r.total}`)
        .join('\n');
      // лидер сезона по сумме очков завершённых этапов
      const { data: fin } = await db.from('stages').select('id').eq('season_id', s.season.id).eq('status', 'finished');
      const { data: all } = await db.from('stage_results').select('profile_id, total, pilot:profiles(nickname)').in('stage_id', (fin ?? []).map((x) => x.id));
      const sum = new Map<string, { n: string; t: number }>();
      for (const r of (all ?? []) as unknown as { profile_id: string; total: number; pilot: { nickname: string } | null }[]) {
        const cur = sum.get(r.profile_id) ?? { n: r.pilot?.nickname ?? '?', t: 0 };
        cur.t += r.total;
        sum.set(r.profile_id, cur);
      }
      const leader = [...sum.values()].sort((a, b) => b.t - a.t)[0];
      build = (l) => ({
        title: T[l].resTitle,
        description: `**${name(l)}**\n\n${podium || '—'}${leader ? `\n\n👑 ${T[l].leader}: **${leader.n}** (${leader.t})` : ''}`,
        color: TIFFANY,
        url: link,
      });
    } else {
      return json({ error: 'unknown type' }, 400);
    }
  }

  const jobs = (Object.entries(hooks) as [Lang, string][]).flatMap(([l, hook]) => {
    const e = build(l);
    if (!e) return [];
    // в тестовом канале видно, какой это язык и что это тест
    return [{ hook, e: testRun ? { ...e, title: `🧪 ТЕСТ · ${l.toUpperCase()} · ${e.title ?? ''}` } : e }];
  });
  if (!jobs.length) return json({ skipped: 'вебхук не настроен' });
  // по очереди: в тестовом канале RU и EN идут друг за другом, а не вперемешку
  const errors: string[] = [];
  for (const j of jobs) {
    const err = await send(j.hook, j.e);
    if (err) errors.push(err);
  }
  return json(errors.length ? { error: errors.join('; ') } : { sent: true }, errors.length ? 502 : 200);
});
