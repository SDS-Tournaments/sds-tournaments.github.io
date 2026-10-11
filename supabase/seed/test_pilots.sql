-- ТЕСТОВЫЕ ПИЛОТЫ: 24 пилота (номера 101–124) + регистрация на последний этап со статусом «Регистрация».
-- Удаление — test_pilots_cleanup.sql. Не запускать на «боевом» чемпионате.
with names(n, nick) as (
  select row_number() over (), nick from unnest(array[
    'Kaido', 'Touge_Ghost', 'NightOwl', 'SmokeUnit', 'Hachiroku', 'Akina_Down', 'RedSuns', 'Usui_Line',
    'Clutchkick', 'Feint', 'Manji', 'Choku_Dori', 'Inertia', 'Shakedown', 'Handbrake', 'Gaiden',
    'Ebisu_Kid', 'Meihan', 'Wangan', 'Haruna', 'Irohazaka', 'Myogi', 'Tsukuba', 'Sideways'
  ]) as nick
),
u as (
  insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
  select gen_random_uuid(), '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
         'test-' || n || '@test.sds', '', now(), now(), now(), '{}', '{"test":true}'
  from names
  returning id, email
),
p as (
  insert into public.profiles (id, steam_id, nickname, start_number, car, engine, gearbox, power_hp)
  select u.id, 'test-' || names.n, names.nick, 100 + names.n,
         (array['Kami S15', 'Spectre R34', 'Ronin 86', 'Vortex FC'])[1 + names.n % 4],
         (array['2.0 I4 Turbo', '2.6 I6 Twin-Turbo', '1.3 Rotary Turbo'])[1 + names.n % 3],
         '6-ст. секвентальная', 500 + names.n * 10
  from u join names on u.email = 'test-' || names.n || '@test.sds'
  returning id
)
insert into public.registrations (stage_id, profile_id)
select (select id from public.stages where status = 'registration' order by id desc limit 1), p.id
from p
where exists (select 1 from public.stages where status = 'registration');
