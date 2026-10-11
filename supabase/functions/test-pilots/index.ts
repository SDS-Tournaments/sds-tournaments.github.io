// Управление пилотами, только для admin: тестовые пилоты (создать 24 / удалить всех)
// и удаление настоящих пилотов — по одному или всех сразу между сезонами (штаб и организаторы не удаляются).
import { createClient } from 'npm:@supabase/supabase-js@2';

const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const NAMES = [
  'Kaido', 'Touge_Ghost', 'NightOwl', 'SmokeUnit', 'Hachiroku', 'Akina_Down', 'RedSuns', 'Usui_Line',
  'Clutchkick', 'Feint', 'Manji', 'Choku_Dori', 'Inertia', 'Shakedown', 'Handbrake', 'Gaiden',
  'Ebisu_Kid', 'Meihan', 'Wangan', 'Haruna', 'Irohazaka', 'Myogi', 'Tsukuba', 'Sideways',
];
const CARS = ['Kami S15', 'Spectre R34', 'Ronin 86', 'Vortex FC'];
const ENGINES = ['2.0 I4 Turbo', '2.6 I6 Twin-Turbo', '1.3 Rotary Turbo'];

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type, apikey, x-client-info',
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: cors });

  // Кто вызывает — только организатор
  const token = req.headers.get('Authorization')?.replace('Bearer ', '') ?? '';
  const { data: who } = await db.auth.getUser(token);
  const { data: me } = await db.from('profiles').select('role').eq('id', who.user?.id ?? '').maybeSingle();
  if (me?.role !== 'admin') return json({ error: 'Только для организатора' }, 403);

  const { action, stageId, profileId } = await req.json();

  // Удаление аккаунта каскадом убирает профиль и все его записи (заявки, оценки, результаты, санкции)
  if (action === 'remove') {
    const { data: p } = await db.from('profiles').select('role').eq('id', profileId ?? '').maybeSingle();
    if (!p) return json({ error: 'Пилот не найден' }, 404);
    if (p.role !== 'pilot') return json({ error: 'Штаб и организаторов удалить нельзя — сначала смените роль' }, 400);
    const { error } = await db.auth.admin.deleteUser(profileId);
    return error ? json({ error: error.message }, 500) : json({ deleted: 1 });
  }
  if (action === 'remove-all') {
    const { data } = await db.from('profiles').select('id').eq('role', 'pilot');
    for (const p of data ?? []) await db.auth.admin.deleteUser(p.id);
    return json({ deleted: data?.length ?? 0 });
  }

  if (action === 'delete') {
    const { data } = await db.from('profiles').select('id').like('steam_id', 'test-%');
    for (const p of data ?? []) await db.auth.admin.deleteUser(p.id);
    return json({ deleted: data?.length ?? 0 });
  }

  if (action === 'create') {
    let created = 0;
    for (const [i, nick] of NAMES.entries()) {
      const n = i + 1;
      const email = `test-${n}@test.sds`;
      const res = await db.auth.admin.createUser({ email, email_confirm: true, user_metadata: { test: true } });
      // уже есть — берём существующий профиль
      const id = res.data.user?.id ?? (await db.from('profiles').select('id').eq('steam_id', `test-${n}`).maybeSingle()).data?.id;
      if (!id) continue;
      const { error } = await db.from('profiles').upsert({
        id,
        steam_id: `test-${n}`,
        nickname: nick,
        start_number: 100 + n,
        car: CARS[n % CARS.length],
        engine: ENGINES[n % ENGINES.length],
        gearbox: '6-ст. секвентальная',
        power_hp: 500 + n * 10,
      });
      if (error) return json({ error: error.message }, 400);
      if (stageId) await db.from('registrations').upsert({ stage_id: stageId, profile_id: id, status: 'registered' });
      if (res.data.user) created++;
    }
    return json({ created, total: NAMES.length });
  }

  // Протест от проигравшего последней решённой дуэли (тестовые пилоты не могут войти сами).
  // Триггер guard_protest проверяет всё как для настоящего пилота: 5 минут, лимит 2, только проигравший.
  if (action === 'protest') {
    const { data: b } = await db
      .from('battles')
      .select('id, stage_id, leader_id, chaser_id, winner_id')
      .eq('stage_id', stageId)
      .eq('status', 'done')
      .neq('result', 'bye')
      .order('decided_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!b) return json({ error: 'Нет решённых дуэлей' }, 400);
    const loser = b.winner_id === b.leader_id ? b.chaser_id : b.leader_id;
    const { data: p, error } = await db
      .from('protests')
      .insert({
        battle_id: b.id,
        stage_id: b.stage_id,
        profile_id: loser,
        video_url: 'https://www.twitch.tv/videos/test',
        reason: 'Тестовый протест: судьи не заметили касание лидером внутренней бровки.',
      })
      .select('id')
      .single();
    if (error) return json({ error: error.message }, 400);
    return json({ ok: true, id: p.id });
  }

  return json({ error: 'unknown action' }, 400);
});
