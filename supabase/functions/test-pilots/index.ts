// Тестовые пилоты для проверки этапа: создать 24 и записать на этап / удалить всех. Только для admin.
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

  const { action, stageId } = await req.json();

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

  return json({ error: 'unknown action' }, 400);
});
