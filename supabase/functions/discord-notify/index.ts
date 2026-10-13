// Оповещения в Discord: регистрация открыта, этап начался, итоги этапа (+ лидер сезона), новый протест, тест из настроек.
// Вебхук — в private_settings (виден только admin). Вызывать может: штаб — любые события, пилот — только свой свежий протест.
import { createClient } from 'npm:@supabase/supabase-js@2';

const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const SITE = (Deno.env.get('SITE_URLS') ?? '').split(',')[0].trim();
const TIFFANY = 0x0abab5;
const RED = 0xff5c5c;
const AMBER = 0xf5b942;

const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, content-type, apikey, x-client-info' };
const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { ...cors, 'Content-Type': 'application/json' } });
/** канал Twitch: в настройках могут вписать и имя, и ссылку twitch.tv/имя */
const twitchName = (v: string | null | undefined) => v?.trim().replace(/^.*twitch\.tv\//i, '').split(/[/?#]/)[0] || null;
const date = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString('ru-RU', { timeZone: 'Europe/Moscow', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) + ' МСК' : 'дата уточняется';

async function stageInfo(id: number) {
  const { data } = await db.from('stages').select('id, ord, title_ru, track, starts_at, battles_at, twitch_channel, season:seasons(id, title, team_counted)').eq('id', id).single();
  return data as unknown as { id: number; ord: number; title_ru: string; track: string | null; starts_at: string | null; battles_at: string | null; twitch_channel: string | null; season: { id: number; title: string } };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: cors });

  const token = req.headers.get('Authorization')?.replace('Bearer ', '') ?? '';
  const { data: who } = await db.auth.getUser(token);
  const uid = who.user?.id;
  if (!uid) return json({ error: 'Нужен вход' }, 401);
  const { data: me } = await db.from('profiles').select('role').eq('id', uid).single();
  const staff = me?.role === 'admin' || me?.role === 'staff';

  const { type, id } = await req.json();
  const { data: settings } = await db.from('private_settings').select('discord_webhook_url').eq('id', 1).single();
  const hook = settings?.discord_webhook_url;
  if (!hook) return json({ skipped: 'вебхук не настроен' });

  let embed: Record<string, unknown> | null = null;

  if (type === 'test') {
    if (!staff) return json({ error: 'Только для штаба' }, 403);
    embed = {
      title: '✅ Вебхук работает',
      description: 'Тестовое сообщение из «Админка → Настройки». Сюда будут приходить: открытие регистрации, старт этапа, итоги и новые протесты.',
      color: TIFFANY,
      url: SITE || undefined,
    };
  } else if (type === 'protest') {
    const { data: p } = await db
      .from('protests')
      .select('id, profile_id, created_at, notified_at, reason, video_url, battle:battles(round), pilot:profiles!protests_profile_id_fkey(nickname, start_number), stage:stages(title_ru)')
      .eq('id', id)
      .single();
    const pr = p as unknown as { profile_id: string; created_at: string; notified_at: string | null; reason: string; video_url: string; battle: { round: string } | null; pilot: { nickname: string; start_number: number | null } | null; stage: { title_ru: string } | null };
    if (!pr || (!staff && pr.profile_id !== uid)) return json({ error: 'Нет доступа' }, 403);
    if (pr.notified_at) return json({ skipped: 'уже отправлено' });
    if (Date.now() - Date.parse(pr.created_at) > 10 * 60_000) return json({ skipped: 'протест старше 10 минут' });
    await db.from('protests').update({ notified_at: new Date().toISOString() }).eq('id', id);
    embed = {
      title: '⚠ Новый протест',
      description: `**#${pr.pilot?.start_number ?? '—'} ${pr.pilot?.nickname}** оспаривает поражение (${pr.battle?.round ?? ''}) — ${pr.stage?.title_ru ?? ''}\n\n> ${pr.reason.slice(0, 300)}`,
      color: AMBER,
      fields: [{ name: 'Видео', value: pr.video_url }],
      url: SITE ? `${SITE}/admin/protests` : undefined,
    };
  } else {
    if (!staff) return json({ error: 'Только для штаба' }, 403);
    const s = await stageInfo(id);
    if (!s) return json({ error: 'Этап не найден' }, 404);
    const link = SITE ? `${SITE}/stages/${s.id}` : undefined;
    const name = `${s.season.title} · ${s.title_ru}${s.track ? ` · ${s.track}` : ''}`;

    if (type === 'registration') {
      embed = { title: '📝 Открыта регистрация', description: `**${name}**\nДень 1 · Квалификация: ${date(s.starts_at)}${s.battles_at ? `\nДень 2 · Парные заезды Top 32: ${date(s.battles_at)}` : ''}\n\nРегистрация — в личном кабинете на сайте${SITE ? `: ${SITE}/me` : '.'}`, color: TIFFANY, url: link };
    } else if (type === 'stage_start') {
      const tw = twitchName(s.twitch_channel ?? (await db.from('app_settings').select('twitch_channel').eq('id', 1).single()).data?.twitch_channel);
      embed = { title: '🔴 LIVE — этап начался', description: `**${name}**\nКвалификация уже идёт!${tw ? `\n\n📺 https://twitch.tv/${tw}` : ''}${link ? `\n🏁 Онлайн-таблица: ${link}` : ''}`, color: RED, url: link };
    } else if (type === 'battles_start') {
      const tw = twitchName(s.twitch_channel ?? (await db.from('app_settings').select('twitch_channel').eq('id', 1).single()).data?.twitch_channel);
      embed = { title: '🔴 LIVE — парные заезды', description: `**${name}**\nTop 32 стартует — дуэли до финала!${tw ? `\n\n📺 https://twitch.tv/${tw}` : ''}${link ? `\n🏁 Сетка: ${link}` : ''}`, color: RED, url: link };
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
      embed = {
        title: '🏁 Итоги этапа',
        description: `**${name}**\n\n${podium || '—'}${leader ? `\n\n👑 Лидер сезона: **${leader.n}** (${leader.t})` : ''}`,
        color: TIFFANY,
        url: link,
      };
    } else {
      return json({ error: 'unknown type' }, 400);
    }
  }

  const res = await fetch(hook, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      username: 'Sad Drift Series',
      avatar_url: SITE ? `${SITE}/icon.png` : undefined,
      embeds: [{ ...embed, thumbnail: SITE ? { url: `${SITE}/icon.png` } : undefined, footer: { text: 'Sad Drift Series · CarX Drift Racing Online 2' }, timestamp: new Date().toISOString() }],
    }),
  });
  return json(res.ok ? { sent: true } : { error: `Discord ответил ${res.status}` }, res.ok ? 200 : 502);
});
