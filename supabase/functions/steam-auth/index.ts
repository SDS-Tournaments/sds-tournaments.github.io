// Вход через Steam (OpenID 2.0) → сессия Supabase. Spec §3.
// Секреты: STEAM_API_KEY, SITE_URLS (разрешённые адреса сайта через запятую).
import { createClient } from 'npm:@supabase/supabase-js@2';

const STEAM = 'https://steamcommunity.com/openid/login';
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SELF = `${SUPABASE_URL}/functions/v1/steam-auth`;
const ALLOWED = (Deno.env.get('SITE_URLS') ?? '').split(',').map((s) => s.trim()).filter(Boolean);

const db = createClient(SUPABASE_URL, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
  auth: { persistSession: false, autoRefreshToken: false },
});

Deno.serve(async (req) => {
  const url = new URL(req.url);
  const redirect = url.searchParams.get('redirect') ?? '';
  // Токен входа уходит только на наш сайт — иначе его можно увести на чужой адрес
  if (!ALLOWED.some((origin) => redirect.startsWith(origin + '/'))) {
    return new Response('Bad redirect', { status: 400 });
  }
  const fail = (why: string) => Response.redirect(`${redirect}#error=${encodeURIComponent(why)}`, 302);

  // Шаг 1: отправляем на страницу входа Steam
  if (url.searchParams.get('openid.mode') !== 'id_res') {
    const p = new URLSearchParams({
      'openid.ns': 'http://specs.openid.net/auth/2.0',
      'openid.mode': 'checkid_setup',
      'openid.return_to': `${SELF}?redirect=${encodeURIComponent(redirect)}`,
      'openid.realm': new URL(SUPABASE_URL).origin,
      'openid.identity': 'http://specs.openid.net/auth/2.0/identifier_select',
      'openid.claimed_id': 'http://specs.openid.net/auth/2.0/identifier_select',
    });
    return Response.redirect(`${STEAM}?${p}`, 302);
  }

  // Шаг 2: Steam вернул пользователя — проверяем ответ у самого Steam
  if (!url.searchParams.get('openid.return_to')?.startsWith(SELF)) return fail('return_to');
  const check = new URLSearchParams();
  for (const [k, v] of url.searchParams) if (k.startsWith('openid.')) check.set(k, v);
  check.set('openid.mode', 'check_authentication');
  const verified = await fetch(STEAM, { method: 'POST', body: check }).then((r) => r.text());
  if (!verified.includes('is_valid:true')) return fail('steam_invalid');

  const steamId = url.searchParams.get('openid.claimed_id')?.match(/^https:\/\/steamcommunity\.com\/openid\/id\/(\d{17})$/)?.[1];
  if (!steamId) return fail('steam_id');

  // Ник и аватар
  const summary = await fetch(
    `https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v2/?key=${Deno.env.get('STEAM_API_KEY')}&steamids=${steamId}`,
  ).then((r) => (r.ok ? r.json() : null));
  const player = summary?.response?.players?.[0];
  if (!player) return fail('steam_profile');

  // Пользователь Supabase: создаём при первом входе (ошибку «уже существует» пропускаем)
  const email = `${steamId}@steam.sds-drift.app`;
  await db.auth.admin.createUser({ email, email_confirm: true, user_metadata: { steam_id: steamId } });
  const { data: link, error: linkErr } = await db.auth.admin.generateLink({ type: 'magiclink', email });
  if (linkErr || !link.user) {
    console.error('generateLink', linkErr);
    return fail('session');
  }

  const { error: profErr } = await db
    .from('profiles')
    .upsert({ id: link.user.id, steam_id: steamId, nickname: player.personaname, avatar_url: player.avatarfull });
  if (profErr) {
    console.error('profile', profErr);
    return fail('profile');
  }

  // Одноразовый токен — в #фрагменте, чтобы не попадал в логи серверов
  return Response.redirect(`${redirect}#token_hash=${link.properties.hashed_token}`, 302);
});
