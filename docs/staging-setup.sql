-- SDS staging: все миграции 0001–0013 одним скриптом. Только для ТЕСТОВОГО проекта sds-staging!
-- Supabase → SQL Editor → вставить целиком → Run.

-- ═════ 0001_init.sql ═════
-- Sad Drift Series — начальная схема (spec §2, §4)
-- Применить: Supabase → SQL Editor → вставить файл целиком → Run.

-- ───────────── Типы ─────────────
create type public.app_role as enum ('admin', 'staff', 'pilot');
create type public.season_status as enum ('draft', 'active', 'finished');
create type public.stage_status as enum ('draft', 'registration', 'qualifying', 'battles', 'finished');
create type public.reg_status as enum ('registered', 'withdrawn', 'dq');
create type public.member_status as enum ('pending', 'approved');
create type public.battle_round as enum ('r32', 'r16', 'qf', 'sf', 'third', 'final');
create type public.battle_status as enum ('pending', 'running', 'done');
create type public.battle_result as enum ('normal', 'tech_loss', 'bye', 'qual_tiebreak');
create type public.judge_slot as enum ('angle', 'style', 'line');
create type public.vote_kind as enum ('leader', 'chaser', 'omt');
create type public.sanction_type as enum ('warning', 'dq', 'ban');
create type public.sponsor_tier as enum ('general', 'partner');

-- ───────────── Пилоты ─────────────
create table public.profiles (
  id uuid primary key references auth.users on delete cascade,
  steam_id text not null unique,
  nickname text not null,
  avatar_url text,
  role public.app_role not null default 'pilot',
  start_number smallint unique check (start_number between 1 and 999),
  livery_url text,
  bio_ru text check (char_length(bio_ru) <= 500),
  bio_en text check (char_length(bio_en) <= 500),
  created_at timestamptz not null default now()
);

-- Роль текущего пользователя (security definer — чтобы не ловить рекурсию RLS)
create function public.my_role() returns public.app_role
language sql stable security definer set search_path = '' as $$
  select role from public.profiles where id = (select auth.uid())
$$;
create function public.is_admin() returns boolean
language sql stable as $$ select coalesce(public.my_role() = 'admin', false) $$;
create function public.is_staff() returns boolean
language sql stable as $$ select coalesce(public.my_role() in ('admin', 'staff'), false) $$;

-- Пилот меняет у себя только номер, ливрею и «о себе»; роль/Steam-данные — admin,
-- сервер (вход через Steam, роль service_role) или SQL Editor (postgres)
create function public.guard_profile() returns trigger
language plpgsql set search_path = '' as $$
begin
  if current_user not in ('authenticated', 'anon') or public.is_admin() then
    return new;
  end if;
  if new.role is distinct from old.role
     or new.steam_id is distinct from old.steam_id
     or new.nickname is distinct from old.nickname
     or new.avatar_url is distinct from old.avatar_url then
    raise exception 'Можно менять только номер, ливрею и описание';
  end if;
  return new;
end $$;
create trigger profiles_guard before update on public.profiles
  for each row execute function public.guard_profile();

-- ───────────── Сезоны и этапы ─────────────
create table public.seasons (
  id bigint generated always as identity primary key,
  number smallint not null unique,
  title text not null,
  status public.season_status not null default 'draft',
  -- места 1–16 по списку, 17–32 → to32, 33+ → rest (RDS GP 2024)
  qual_points jsonb not null default '{"places":[22,19,17,15,14,13,12,11,10,9,8,7,6,5,4,3],"to32":2,"rest":1}',
  -- ключ = худшее место диапазона: 1, 2, 3, 4, 5–8, 9–16
  battle_points jsonb not null default '{"1":250,"2":180,"3":145,"4":120,"8":70,"16":30}',
  team_counted smallint not null default 3 check (team_counted between 1 and 8),
  champion_pilot_id uuid references public.profiles on delete set null,
  champion_team_id bigint,
  created_at timestamptz not null default now()
);
create unique index one_active_season on public.seasons (status) where status = 'active';

create table public.sponsors (
  id bigint generated always as identity primary key,
  name text not null,
  logo_url text,
  url text,
  tier public.sponsor_tier not null default 'partner',
  active boolean not null default true,
  starts_at date,
  ends_at date,
  on_overlay boolean not null default true,
  sort smallint not null default 0
);

create table public.stages (
  id bigint generated always as identity primary key,
  season_id bigint not null references public.seasons on delete cascade,
  ord smallint not null,
  title_ru text not null,
  title_en text,
  description_ru text,
  description_en text,
  track text,
  starts_at timestamptz,
  status public.stage_status not null default 'draft',
  weights jsonb not null default '{"angle":40,"style":30,"line":30}'
    check ((weights->>'angle')::int + (weights->>'style')::int + (weights->>'line')::int = 100),
  judges jsonb not null default '{"angle":"","style":"","line":""}',
  bracket_size text not null default 'auto' check (bracket_size in ('auto', '32', '16', '8')),
  sponsor_id bigint references public.sponsors on delete set null,
  twitch_channel text,
  created_at timestamptz not null default now(),
  unique (season_id, ord)
);

-- ───────────── Команды ─────────────
create table public.teams (
  id bigint generated always as identity primary key,
  name text not null unique check (char_length(name) between 2 and 40),
  logo_url text,
  captain_id uuid references public.profiles on delete set null,
  created_at timestamptz not null default now()
);
alter table public.seasons add foreign key (champion_team_id) references public.teams on delete set null;

-- Одна команда на пилота за сезон, до 8 подтверждённых пилотов
create table public.team_members (
  season_id bigint not null references public.seasons on delete cascade,
  profile_id uuid not null references public.profiles on delete cascade,
  team_id bigint not null references public.teams on delete cascade,
  status public.member_status not null default 'pending',
  created_at timestamptz not null default now(),
  primary key (season_id, profile_id)
);
create function public.guard_team_size() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.status = 'approved' and (
    select count(*) from public.team_members
    where team_id = new.team_id and season_id = new.season_id and status = 'approved'
      and profile_id <> new.profile_id
  ) >= 8 then
    raise exception 'В команде уже 8 пилотов';
  end if;
  return new;
end $$;
create trigger team_members_size before insert or update on public.team_members
  for each row execute function public.guard_team_size();

-- ───────────── Этап: регистрация, квалификация, сетка ─────────────
create table public.registrations (
  stage_id bigint not null references public.stages on delete cascade,
  profile_id uuid not null references public.profiles on delete cascade,
  team_id bigint references public.teams on delete set null, -- снимок команды на момент этапа
  group_no smallint,
  queue_order int,
  status public.reg_status not null default 'registered',
  created_at timestamptz not null default now(),
  primary key (stage_id, profile_id)
);

create table public.qual_runs (
  id bigint generated always as identity primary key,
  stage_id bigint not null references public.stages on delete cascade,
  profile_id uuid not null references public.profiles on delete cascade,
  attempt smallint not null check (attempt between 0 and 2), -- 0 = прогрев
  angle numeric(5, 2) check (angle >= 0),
  style numeric(5, 2) check (style >= 0),
  line numeric(5, 2) check (line >= 0),
  spin boolean not null default false,
  total numeric(5, 2) generated always as (
    case when spin then 0 else coalesce(angle, 0) + coalesce(style, 0) + coalesce(line, 0) end
  ) stored,
  created_by uuid default auth.uid() references public.profiles on delete set null,
  created_at timestamptz not null default now(),
  unique (stage_id, profile_id, attempt)
);
-- Балл критерия не больше его веса на этапе
create function public.guard_qual_run() returns trigger
language plpgsql set search_path = '' as $$
declare w jsonb;
begin
  select weights into w from public.stages where id = new.stage_id;
  if new.angle > (w->>'angle')::numeric or new.style > (w->>'style')::numeric or new.line > (w->>'line')::numeric then
    raise exception 'Балл больше веса критерия (угол %, стиль %, траектория %)', w->>'angle', w->>'style', w->>'line';
  end if;
  return new;
end $$;
create trigger qual_runs_guard before insert or update on public.qual_runs
  for each row execute function public.guard_qual_run();

create table public.battles (
  id bigint generated always as identity primary key,
  stage_id bigint not null references public.stages on delete cascade,
  round public.battle_round not null,
  slot smallint not null,
  leader_id uuid references public.profiles on delete set null,
  chaser_id uuid references public.profiles on delete set null,
  winner_id uuid references public.profiles on delete set null,
  omt_count smallint not null default 0 check (omt_count between 0 and 2),
  status public.battle_status not null default 'pending',
  result public.battle_result,
  unique (stage_id, round, slot)
);

create table public.battle_votes (
  battle_id bigint not null references public.battles on delete cascade,
  try smallint not null check (try between 0 and 2), -- 0 = основная дуэль, 1–2 = OMT
  judge public.judge_slot not null,
  vote public.vote_kind not null,
  primary key (battle_id, try, judge)
);

create table public.stage_results (
  stage_id bigint not null references public.stages on delete cascade,
  profile_id uuid not null references public.profiles on delete cascade,
  team_id bigint references public.teams on delete set null,
  qual_place smallint,
  battle_place smallint,
  stage_place smallint,
  qual_points smallint not null default 0,
  battle_points smallint not null default 0,
  total smallint generated always as (qual_points + battle_points) stored,
  primary key (stage_id, profile_id)
);

create table public.achievements (
  profile_id uuid not null references public.profiles on delete cascade,
  code text not null,
  stage_id bigint not null references public.stages on delete cascade,
  awarded_at timestamptz not null default now(),
  primary key (profile_id, code, stage_id)
);

create table public.sanctions (
  id bigint generated always as identity primary key,
  profile_id uuid not null references public.profiles on delete cascade,
  stage_id bigint references public.stages on delete set null,
  type public.sanction_type not null,
  reason text not null,
  created_by uuid default auth.uid() references public.profiles on delete set null,
  created_at timestamptz not null default now()
);

-- ───────────── Трансляция и настройки ─────────────
create table public.overlay_state (
  id smallint primary key default 1 check (id = 1),
  state jsonb not null default '{"lang":"ru","visible":{}}',
  updated_at timestamptz not null default now()
);
insert into public.overlay_state default values;

create table public.app_settings (
  id smallint primary key default 1 check (id = 1),
  twitch_channel text,
  regulation_ru text,
  regulation_en text,
  regulation_version text default '2.0'
);
insert into public.app_settings default values;

-- Только для admin (вебхук Discord не должен быть публичным)
create table public.private_settings (
  id smallint primary key default 1 check (id = 1),
  discord_webhook_url text
);
insert into public.private_settings default values;

-- ───────────── Индексы ─────────────
create index on public.stages (season_id);
create index on public.team_members (team_id);
create index on public.registrations (profile_id);
create index on public.qual_runs (stage_id);
create index on public.qual_runs (profile_id);
create index on public.battles (stage_id);
create index on public.stage_results (profile_id);
create index on public.sanctions (profile_id);

-- ───────────── Доступ (RLS) ─────────────
alter table public.profiles enable row level security;
alter table public.seasons enable row level security;
alter table public.sponsors enable row level security;
alter table public.stages enable row level security;
alter table public.teams enable row level security;
alter table public.team_members enable row level security;
alter table public.registrations enable row level security;
alter table public.qual_runs enable row level security;
alter table public.battles enable row level security;
alter table public.battle_votes enable row level security;
alter table public.stage_results enable row level security;
alter table public.achievements enable row level security;
alter table public.sanctions enable row level security;
alter table public.overlay_state enable row level security;
alter table public.app_settings enable row level security;
alter table public.private_settings enable row level security;

grant usage on schema public to anon, authenticated;
grant select on all tables in schema public to anon, authenticated;
grant insert, update, delete on all tables in schema public to authenticated;

-- Публичное чтение
create policy "read" on public.profiles for select using (true);
create policy "read" on public.seasons for select using (status <> 'draft' or public.is_staff());
create policy "read" on public.sponsors for select using (active or public.is_admin());
create policy "read" on public.stages for select using (status <> 'draft' or public.is_staff());
create policy "read" on public.teams for select using (true);
create policy "read" on public.team_members for select using (true);
create policy "read" on public.registrations for select using (true);
create policy "read" on public.qual_runs for select using (true);
create policy "read" on public.battles for select using (true);
create policy "read" on public.battle_votes for select using (true);
create policy "read" on public.stage_results for select using (true);
create policy "read" on public.achievements for select using (true);
create policy "read" on public.overlay_state for select using (true);
create policy "read" on public.app_settings for select using (true);
create policy "read" on public.sanctions for select using (public.is_staff());
create policy "read" on public.private_settings for select using (public.is_admin());

-- Профиль: свой (поля ограничивает триггер) или admin
create policy "own or admin" on public.profiles for update
  using (id = (select auth.uid()) or public.is_admin());

-- Только admin
create policy "admin" on public.seasons for all using (public.is_admin()) with check (public.is_admin());
create policy "admin" on public.sponsors for all using (public.is_admin()) with check (public.is_admin());
create policy "admin" on public.app_settings for all using (public.is_admin()) with check (public.is_admin());
create policy "admin" on public.private_settings for all using (public.is_admin()) with check (public.is_admin());
create policy "admin delete" on public.sanctions for delete using (public.is_admin());

-- Судьи и управляющий
create policy "staff" on public.stages for all using (public.is_staff()) with check (public.is_staff());
create policy "staff" on public.qual_runs for all using (public.is_staff()) with check (public.is_staff());
create policy "staff" on public.battles for all using (public.is_staff()) with check (public.is_staff());
create policy "staff" on public.battle_votes for all using (public.is_staff()) with check (public.is_staff());
create policy "staff" on public.stage_results for all using (public.is_staff()) with check (public.is_staff());
create policy "staff" on public.achievements for all using (public.is_staff()) with check (public.is_staff());
create policy "staff" on public.overlay_state for all using (public.is_staff()) with check (public.is_staff());
create policy "staff" on public.registrations for all using (public.is_staff()) with check (public.is_staff());
create policy "staff insert" on public.sanctions for insert with check (public.is_staff());

-- Регистрация на этап: пилот сам, пока открыта регистрация
create policy "pilot registers" on public.registrations for insert
  with check (
    profile_id = (select auth.uid()) and status = 'registered' and group_no is null and queue_order is null
    and exists (select 1 from public.stages s where s.id = stage_id and s.status = 'registration')
  );
create policy "pilot withdraws" on public.registrations for update
  using (profile_id = (select auth.uid()) and exists (select 1 from public.stages s where s.id = stage_id and s.status = 'registration'))
  with check (profile_id = (select auth.uid()) and status in ('registered', 'withdrawn') and group_no is null and queue_order is null);

-- Команды: пилот создаёт команду и становится капитаном; правит капитан или admin
create policy "create team" on public.teams for insert
  with check (captain_id = (select auth.uid()) or public.is_admin());
create policy "captain or admin" on public.teams for update
  using (captain_id = (select auth.uid()) or public.is_admin());
create policy "admin delete" on public.teams for delete using (public.is_admin());

-- Состав: заявка пилота или приглашение капитана (pending); подтверждает admin
create policy "request or invite" on public.team_members for insert
  with check (
    public.is_admin() or (
      status = 'pending' and (
        profile_id = (select auth.uid())
        or exists (select 1 from public.teams t where t.id = team_id and t.captain_id = (select auth.uid()))
      )
    )
  );
create policy "admin approves" on public.team_members for update using (public.is_admin()) with check (public.is_admin());
create policy "leave or remove" on public.team_members for delete
  using (
    public.is_admin()
    or profile_id = (select auth.uid())
    or exists (select 1 from public.teams t where t.id = team_id and t.captain_id = (select auth.uid()))
  );

-- ───────────── Realtime (живая сетка и плашки) ─────────────
alter publication supabase_realtime add table
  public.stages, public.registrations, public.qual_runs, public.battles, public.battle_votes, public.overlay_state;

-- ───────────── Хранилище картинок ─────────────
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('liveries', 'liveries', true, 1048576, array['image/jpeg', 'image/png', 'image/webp']),
  ('team-logos', 'team-logos', true, 524288, array['image/png', 'image/webp', 'image/svg+xml', 'image/jpeg']),
  ('sponsors', 'sponsors', true, 524288, array['image/png', 'image/webp', 'image/svg+xml', 'image/jpeg']);

-- Ливрея: пилот пишет только в папку со своим id (liveries/<uid>/…)
create policy "livery own" on storage.objects for all to authenticated
  using (bucket_id = 'liveries' and ((storage.foldername(name))[1] = (select auth.uid())::text or public.is_admin()))
  with check (bucket_id = 'liveries' and ((storage.foldername(name))[1] = (select auth.uid())::text or public.is_admin()));
-- Логотип команды: капитан своей команды (team-logos/<team_id>/…) или admin
create policy "team logo" on storage.objects for all to authenticated
  using (bucket_id = 'team-logos' and (public.is_admin() or exists (
    select 1 from public.teams t where t.id::text = (storage.foldername(name))[1] and t.captain_id = (select auth.uid()))))
  with check (bucket_id = 'team-logos' and (public.is_admin() or exists (
    select 1 from public.teams t where t.id::text = (storage.foldername(name))[1] and t.captain_id = (select auth.uid()))));
create policy "sponsor logo" on storage.objects for all to authenticated
  using (bucket_id = 'sponsors' and public.is_admin())
  with check (bucket_id = 'sponsors' and public.is_admin());

-- ───────────── Стартовые данные ─────────────
insert into public.sponsors (name, url, tier, sort) values ('CarX Technologies', 'https://carx-online.com', 'general', 0);

-- ═════ 0002_car.sql ═════
-- Машина пилота
alter table public.profiles
  add column car text check (char_length(car) <= 60),
  add column engine text check (char_length(engine) <= 60),
  add column gearbox text check (char_length(gearbox) <= 60),
  add column power_hp smallint check (power_hp between 1 and 5000);

-- ═════ 0003_protests.sql ═════
-- Протесты на решение судей в парных заездах (spec §5.8)
create type public.protest_status as enum ('pending', 'rejected', 'reversed', 'rerun');

-- Когда судьи вынесли решение по дуэли — от него отсчитываются 5 минут на протест
alter table public.battles add column decided_at timestamptz;

create table public.protests (
  id bigint generated always as identity primary key,
  battle_id bigint not null references public.battles on delete cascade,
  stage_id bigint not null references public.stages on delete cascade,
  profile_id uuid not null default auth.uid() references public.profiles on delete cascade,
  video_url text not null check (video_url ~* '^https?://' and char_length(video_url) <= 500),
  reason text not null check (char_length(reason) between 10 and 1000),
  status public.protest_status not null default 'pending',
  admin_comment text check (char_length(admin_comment) <= 1000),
  resolved_by uuid references public.profiles on delete set null,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  unique (battle_id, profile_id)
);
create index on public.protests (stage_id);
create index on public.protests (status) where status = 'pending';

-- Подаёт только проигравший, в течение 5 минут после решения, на этапе дуэлей, не больше 2 за этап
create function public.guard_protest() returns trigger
language plpgsql security definer set search_path = '' as $$
declare b public.battles;
begin
  if public.is_admin() then return new; end if;
  select * into b from public.battles where id = new.battle_id;
  if b.stage_id is distinct from new.stage_id then raise exception 'Дуэль не из этого этапа'; end if;
  if (select status from public.stages where id = b.stage_id) <> 'battles' then
    raise exception 'Протесты принимаются только во время парных заездов';
  end if;
  if b.status <> 'done' or b.winner_id is null or b.decided_at is null then
    raise exception 'По дуэли ещё нет решения';
  end if;
  if new.profile_id not in (b.leader_id, b.chaser_id) or new.profile_id = b.winner_id then
    raise exception 'Протест может подать только проигравший пилот';
  end if;
  if now() > b.decided_at + interval '5 minutes' then
    raise exception 'Время на протест (5 минут) истекло';
  end if;
  if (select count(*) from public.protests where stage_id = new.stage_id and profile_id = new.profile_id) >= 2 then
    raise exception 'Не больше 2 протестов за этап';
  end if;
  new.status := 'pending';
  new.admin_comment := null;
  new.resolved_by := null;
  new.resolved_at := null;
  return new;
end $$;
create trigger protests_guard before insert on public.protests
  for each row execute function public.guard_protest();

alter table public.protests enable row level security;
grant select, insert, update on public.protests to authenticated;

create policy "own or staff" on public.protests for select
  using (profile_id = (select auth.uid()) or public.is_staff());
create policy "pilot files" on public.protests for insert
  with check (profile_id = (select auth.uid()));
create policy "admin resolves" on public.protests for update
  using (public.is_admin()) with check (public.is_admin());

-- Уведомления админу в реальном времени
alter publication supabase_realtime add table public.protests;

-- ═════ 0004_registration.sql ═════
-- Регистрация на этап: команда подставляется из состава сезона, нужен стартовый номер, бан не пускает
create function public.prepare_registration() returns trigger
language plpgsql security definer set search_path = '' as $$
declare season bigint;
begin
  select season_id into season from public.stages where id = new.stage_id;
  new.team_id := (
    select team_id from public.team_members
    where season_id = season and profile_id = new.profile_id and status = 'approved'
  );
  if public.is_staff() then return new; end if;
  if (select start_number from public.profiles where id = new.profile_id) is null then
    raise exception 'Сначала выберите стартовый номер в личном кабинете';
  end if;
  if exists (select 1 from public.sanctions where profile_id = new.profile_id and type = 'ban') then
    raise exception 'Регистрация недоступна: у вас бан на турниры SDS';
  end if;
  return new;
end $$;
create trigger registrations_prepare before insert on public.registrations
  for each row execute function public.prepare_registration();

-- ═════ 0005_teams.sql ═════
-- Команды: один пилот — капитан не больше одной команды; капитан сразу в составе
create unique index one_team_per_captain on public.teams (captain_id) where captain_id is not null;

create function public.captain_joins() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if exists (select 1 from public.teams where id = new.team_id and captain_id = new.profile_id) then
    new.status := 'approved';
  end if;
  return new;
end $$;
-- имя с «a_», чтобы сработал раньше проверки размера команды (триггеры идут по алфавиту)
create trigger a_team_members_captain before insert on public.team_members
  for each row execute function public.captain_joins();

-- RLS проверяет строку уже после триггера: капитану своей команды можно сразу «approved»
drop policy "request or invite" on public.team_members;
create policy "request or invite" on public.team_members for insert
  with check (
    public.is_admin()
    or (status = 'approved' and profile_id = (select auth.uid())
        and exists (select 1 from public.teams t where t.id = team_id and t.captain_id = (select auth.uid())))
    or (status = 'pending' and (
        profile_id = (select auth.uid())
        or exists (select 1 from public.teams t where t.id = team_id and t.captain_id = (select auth.uid()))))
  );

-- ═════ 0006_public_stages.sql ═════
-- Черновики этапов видны всем как «запланированные» (дорога сезона на главной)
drop policy "read" on public.stages;
create policy "read" on public.stages for select using (true);

-- ═════ 0007_regulation.sql ═════
-- Регламент SDS v2.0 (RU + EN). Дальше правится в Админке → Настройки.
update public.app_settings set
  regulation_version = '2.0',
  regulation_ru = $ru$
## 1. Общие положения

**1.1.** Sad Drift Series (SDS) — серия турниров по дрифту, состоящая из отдельных этапов. Настоящий регламент действует на протяжении всего чемпионата.

**1.2.** Участник обязуется знать и соблюдать данный регламент. Незнание правил не освобождает от ответственности.

**1.3.** Участие в чемпионате означает автоматическое согласие со всеми пунктами настоящего регламента.

**1.4.** Главный судья и маршалы определяются организаторами отдельно на каждый этап.

**1.5.** Главный судья имеет право пересматривать повторы и выносить окончательный вердикт.

**1.6.** За нарушение регламента могут быть вынесены наказания:

- **Предупреждение** — за незначительные нарушения.
- **Дисквалификация с этапа** — за грубые нарушения или повторные предупреждения.
- **Бан на все турниры SDS** — за систематические нарушения, читерство, неспортивное поведение или нарушение кодекса поведения.

Решение о наказании принимается организаторами и главным судьёй этапа с учётом тяжести и обстоятельств нарушения.

## 2. Формат соревнований

### 2.1. Квалификация (одиночные заезды)

Каждый пилот получает 3 заезда:

- **1-й заезд** — прогревочный. В зачёт не идёт, нужен для разогрева и проверки связи.
- **2-й и 3-й заезды** — результативные. Засчитывается лучший результат.

Цель — набрать максимум баллов (до 100). По итогам квалификации строится сетка ТОП-32.

### 2.2. Плей-офф (парные дуэли, ТОП-32)

- Сетка строится на основе результатов квалификации.
- Лидером в паре становится пилот с большим количеством баллов за квалификацию.
- Проходит два заезда. После первого пилоты меняются местами: лидер становится чейзером и наоборот.
- Решение о победе выносят судьи (голосованием / консенсусом).
- Если после двух заездов победитель не определён, назначается перезаезд — **OMT** (One More Time).
- Максимум — 2 OMT. Если и после второго OMT решения нет, побеждает пилот с большим количеством баллов за квалификацию.

## 3. Система оценки

### 3.1. Квалификация

Оцениваются 3 критерия, максимальная сумма — 100 баллов. Веса критериев задают организаторы на каждый этап (в сумме — 100).

| Критерий | Что оценивается |
|---|---|
| Траектория | Прохождение клиппинг-поинтов (вершин), касание внутренней бровкой |
| Угол | Максимально возможный угол заноса без потери скорости |
| Стиль | Чистота исполнения, плавность, зрелищность |

### 3.2. Парные дуэли

**Лидер** оценивается по тем же критериям, что и в квалификации: траектория, угол, стиль.

**Чейзер** оценивается по отдельным критериям:

- **Близость** — дистанция до машины лидера.
- **Угол за лидером** — способность держать угол, повторяя траекторию.
- **Синхронность** — совпадение по времени входа в занос, скорости и траектории.

## 4. Правила парных дуэлей

### Лидер (первый автомобиль)

- **Обязанность:** показывать чистую траекторию, двигаться предсказуемо.
- **Запрещено:** резко тормозить, «сушить» (выпрямлять руль), менять траекторию в последний момент, чтобы скинуть чейзера.
- **Штраф:** если лидер «сбрасывает» соперника — заезд пересматривается, лидер получает предупреждение.

### Чейзер (второй автомобиль)

- **Обязанность:** максимально плотно прижиматься к бамперу лидера, повторяя его траекторию.
- **Запрещено:** касаться машины лидера. Если контакт произошёл из-за грубой ошибки чейзера — заезд присуждается лидеру.
- **Бонус:** дополнительные баллы за «Зону стенки» (Close Wall).

## 5. Нештатные ситуации

### 5.1. Дисконнект (потеря соединения / вылет из игры)

- **В квалификации:** пилоту даётся перезаезд. Он отправляется в конец очереди и проезжает оставшуюся попытку (или обе, если не успел начать) после всех участников.
- **В парных дуэлях:** назначается полный перезаезд дуэли.

> Если дисконнект произошёл по вине игрока (специально выключил интернет, вышел из лобби) — перезаезд **не предоставляется**, фиксируется техническое поражение.

### 5.2. Задержка подключения

Если игрок вылетел и не успевает перезайти к старту своей дуэли, даётся **5 минут** на переподключение. По истечении времени — техническое поражение.

При пинге выше **150 мс** судья может попросить игрока покинуть сервер.

## 6. Штрафы и нарушения

Система штрафов может меняться от этапа к этапу и объявляется организаторами перед стартом каждого этапа.

| Нарушение | Последствие |
|---|---|
| Разворот — спин (полная потеря управления) | Оценка за заезд — 0 |
| Авария, контакт | Решение выносят судьи по ситуации |

## 7. Протесты

- Протест на решение судей можно подать **только в парных дуэлях** и **только проигравшему** пилоту.
- Срок — **5 минут** после решения судей, через личный кабинет на сайте.
- Обязательно приложить ссылку на видео-доказательство и описать, что судьи не увидели.
- Не больше **2 протестов** за этап.
- По протесту организатор может отклонить его, отдать победу или назначить перезаезд. Решение организатора окончательное.

## 8. Кодекс поведения

**8.1.** Участники обязаны вести себя уважительно и адекватно как на этапах, так и в сообществе SDS в целом.

**8.2.** Запрещено:

- оскорбления участников, судей, организаторов и зрителей;
- токсичное поведение, провокации, разжигание конфликтов;
- нецензурная лексика в адрес других участников;
- любые формы дискриминации.

**8.3.** За нарушение кодекса поведения — перманентный бан без права восстановления.

## 9. Визуальное оформление автомобилей (ливреи)

**9.1.** Запрещено использовать ливреи, содержащие:

- изображения вульгарного или порнографического характера;
- нецензурную лексику и оскорбительные надписи;
- политическую или религиозную пропаганду, разжигающую ненависть.

Нарушение карается снятием с турнира.

**9.2.** Обязательные элементы оклейки:

- наклейка с символикой SDS — на каждом автомобиле;
- стартовый номер — на заднем стекле, в верхнем правом углу (относительно взгляда вперёд).

Пример правильной оклейки — в канале #пример-ливреи.

## 10. Технические требования к автомобилям

**10.1. Вес.** Минимальный вес — 1050 кг.

**10.2. Колёса и шины.**

| Вес автомобиля | Задние колёса | Передние колёса |
|---|---|---|
| 1050–1200 кг | 265/35 R19 | Не ограничено |
| 1200 кг и выше | 285/35 R19 | Не ограничено |

**10.3. Мощность** — не ограничена.

**10.4. Настройки.** Автоматическая смена резины должна быть **отключена**.

**10.5. Модификации.** Запрещены все моды, читы, плагины и любые сторонние вмешательства в игру. Разрешён только стандартный контент игры.

## 11. Контакты

- Организатор SDS: **@sadlerk**
- Главный судья и маршалы этапа объявляются отдельно перед каждым этапом.
$ru$,
  regulation_en = $en$
## 1. General provisions

**1.1.** Sad Drift Series (SDS) is a series of drift tournaments made up of separate rounds. This rulebook applies throughout the championship.

**1.2.** Every participant must know and follow this rulebook. Not knowing the rules does not excuse a violation.

**1.3.** Taking part in the championship means automatic agreement with every clause of this rulebook.

**1.4.** The chief judge and marshals are appointed by the organizers separately for each round.

**1.5.** The chief judge may review replays and makes the final call.

**1.6.** Breaking the rules may lead to:

- **Warning** — for minor violations.
- **Disqualification from the round** — for serious violations or repeated warnings.
- **Ban from all SDS events** — for systematic violations, cheating, unsporting behaviour or breaking the code of conduct.

Penalties are decided by the organizers and the round's chief judge based on the severity and circumstances.

## 2. Competition format

### 2.1. Qualifying (solo runs)

Each driver gets 3 runs:

- **Run 1** — warm-up. Not scored; used to warm up and check the connection.
- **Runs 2 and 3** — scored. The best result counts.

The goal is to score as many points as possible (up to 100). Qualifying results set the TOP-32 bracket.

### 2.2. Play-off (tandem battles, TOP-32)

- The bracket is built from the qualifying results.
- The driver with the higher qualifying score leads the pair.
- Two runs are held; after the first, the drivers swap roles (leader becomes chaser and vice versa).
- The judges decide the winner (by vote / consensus).
- If there is no winner after two runs, a re-run is called — **OMT** (One More Time).
- Maximum 2 OMTs. If there is still no decision after the second OMT, the driver with the higher qualifying score wins.

## 3. Judging

### 3.1. Qualifying

Three criteria are judged, 100 points in total. The organizers set the criteria weights for each round (summing to 100).

| Criterion | What is judged |
|---|---|
| Line | Hitting clipping points, touching the inner kerb |
| Angle | The biggest possible drift angle without losing speed |
| Style | Clean execution, smoothness, show |

### 3.2. Tandem battles

The **leader** is judged on the same criteria as in qualifying: line, angle, style.

The **chaser** is judged on separate criteria:

- **Proximity** — distance to the leader's car.
- **Angle behind the leader** — holding angle while following the leader's line.
- **Sync** — matching the leader's entry timing, speed and line.

## 4. Tandem battle rules

### Leader (first car)

- **Must:** show a clean line and drive predictably.
- **Must not:** brake hard, straighten the car ("dry" the steering), or change line at the last moment to shake off the chaser.
- **Penalty:** if the leader shakes off the opponent, the run is reviewed and the leader gets a warning.

### Chaser (second car)

- **Must:** stay as close to the leader's bumper as possible, following their line.
- **Must not:** touch the leader's car. If contact is caused by a clear chaser mistake, the run goes to the leader.
- **Bonus:** extra points for the Close Wall zone.

## 5. Incidents

### 5.1. Disconnect (lost connection / game crash)

- **In qualifying:** the driver gets a re-run. They go to the end of the queue and drive the remaining attempt (or both, if they hadn't started) after everyone else.
- **In tandem battles:** the whole battle is re-run.

> If the disconnect is the driver's own fault (internet switched off on purpose, leaving the lobby), there is **no** re-run — it counts as a technical defeat.

### 5.2. Reconnection delay

If a driver drops and can't rejoin before their battle starts, they get **5 minutes** to reconnect. After that it's a technical defeat.

With a ping above **150 ms**, the judge may ask the driver to leave the server.

## 6. Penalties and violations

The penalty system may change between rounds and is announced by the organizers before each round.

| Violation | Consequence |
|---|---|
| Spin (complete loss of control) | 0 points for the run |
| Crash, contact | Decided by the judges case by case |

## 7. Protests

- A protest against a judges' decision can be filed **only in tandem battles** and **only by the losing** driver.
- Deadline — **5 minutes** after the decision, via the driver's account on the website.
- A link to video evidence and a description of what the judges missed are required.
- No more than **2 protests** per round.
- The organizer may reject the protest, award the win, or call a re-run. The organizer's decision is final.

## 8. Code of conduct

**8.1.** Participants must behave respectfully both during rounds and in the SDS community as a whole.

**8.2.** Prohibited:

- insulting participants, judges, organizers or viewers;
- toxic behaviour, provocation, stirring up conflicts;
- profanity directed at other participants;
- any form of discrimination.

**8.3.** Breaking the code of conduct results in a permanent ban with no right to appeal.

## 9. Car liveries

**9.1.** Liveries must not contain:

- vulgar or pornographic images;
- profanity or offensive text;
- political or religious propaganda inciting hatred.

Breaking this rule means removal from the tournament.

**9.2.** Required livery elements:

- the SDS sticker — on every car;
- the race number — on the rear window, top right corner (looking forward).

An example of a correct livery is in the #livery-example channel.

## 10. Technical requirements

**10.1. Weight.** Minimum weight — 1050 kg.

**10.2. Wheels and tyres.**

| Car weight | Rear wheels | Front wheels |
|---|---|---|
| 1050–1200 kg | 265/35 R19 | Unrestricted |
| 1200 kg and above | 285/35 R19 | Unrestricted |

**10.3. Power** — unrestricted.

**10.4. Settings.** Automatic tyre change must be **turned off**.

**10.5. Modifications.** All mods, cheats, plugins and any third-party interference with the game are prohibited. Only standard game content is allowed.

## 11. Contacts

- SDS organizer: **@sadlerk**
- The chief judge and marshals are announced separately before each round.
$en$
where id = 1;

-- ═════ 0008_discord.sql ═════
-- Чтобы протест не ушёл в Discord дважды
alter table public.protests add column notified_at timestamptz;

-- ═════ 0009_number_lock.sql ═════
-- Стартовый номер пилот выбирает один раз за сезон; менять дальше может только админ
alter table public.profiles add column number_season_id bigint references public.seasons on delete set null;

create or replace function public.guard_profile() returns trigger
language plpgsql set search_path = '' as $$
declare
  v_season bigint;
begin
  if current_user not in ('authenticated', 'anon') or public.is_admin() then
    return new;
  end if;
  if new.role is distinct from old.role
     or new.steam_id is distinct from old.steam_id
     or new.nickname is distinct from old.nickname
     or new.avatar_url is distinct from old.avatar_url then
    raise exception 'Можно менять только номер, ливрею и описание';
  end if;
  new.number_season_id := old.number_season_id; -- пилот сам это поле не трогает
  if new.start_number is distinct from old.start_number then
    select id into v_season from public.seasons where status = 'active';
    -- null = null тоже «тот же сезон»: номер, выбранный вне сезона, до старта сезона не меняется
    if old.start_number is not null and old.number_season_id is not distinct from v_season then
      raise exception 'Номер уже выбран в этом сезоне — сменить его может администратор';
    end if;
    new.number_season_id := v_season;
  end if;
  return new;
end $$;

-- ═════ 0010_legacy_stats.sql ═════
-- Статистика пилота до появления сайта (для карточки и «паутинки»). Вписывает только организатор.
-- { runs, angle, style, line, overall, wins }: angle/style/line — средний % от максимума, overall — 0–100
alter table public.profiles add column legacy jsonb;

create or replace function public.guard_profile() returns trigger
language plpgsql set search_path = '' as $$
declare
  v_season bigint;
begin
  if current_user not in ('authenticated', 'anon') or public.is_admin() then
    return new;
  end if;
  if new.role is distinct from old.role
     or new.steam_id is distinct from old.steam_id
     or new.nickname is distinct from old.nickname
     or new.avatar_url is distinct from old.avatar_url
     or new.legacy is distinct from old.legacy then
    raise exception 'Можно менять только номер, ливрею и описание';
  end if;
  new.number_season_id := old.number_season_id; -- пилот сам это поле не трогает
  if new.start_number is distinct from old.start_number then
    select id into v_season from public.seasons where status = 'active';
    -- null = null тоже «тот же сезон»: номер, выбранный вне сезона, до старта сезона не меняется
    if old.start_number is not null and old.number_season_id is not distinct from v_season then
      raise exception 'Номер уже выбран в этом сезоне — сменить его может администратор';
    end if;
    new.number_season_id := v_season;
  end if;
  return new;
end $$;

-- ═════ 0011_number_until_signup.sql ═════
-- Номер остаётся за пилотом между сезонами. Пилот меняет его свободно, пока не записался
-- ни на один этап активного сезона; после первой записи — только организатор (до конца сезона).
-- Заменяет правило 0009 «один выбор за сезон».
create or replace function public.guard_profile() returns trigger
language plpgsql set search_path = '' as $$
begin
  if current_user not in ('authenticated', 'anon') or public.is_admin() then
    return new;
  end if;
  if new.role is distinct from old.role
     or new.steam_id is distinct from old.steam_id
     or new.nickname is distinct from old.nickname
     or new.avatar_url is distinct from old.avatar_url
     or new.legacy is distinct from old.legacy then
    raise exception 'Можно менять только номер, ливрею и описание';
  end if;
  -- снятая заявка тоже считается: иначе «записался → снялся → сменил номер» между этапами
  if new.start_number is distinct from old.start_number and exists (
    select 1 from public.registrations r
    join public.stages s on s.id = r.stage_id
    join public.seasons se on se.id = s.season_id
    where r.profile_id = new.id and se.status = 'active'
  ) then
    raise exception 'Вы уже записались на этап этого сезона — номер сменит только администратор';
  end if;
  return new;
end $$;

alter table public.profiles drop column number_season_id;

-- ═════ 0012_team_logo_policy.sql ═════
-- Исправление 0001: в подзапросе по teams «name» означало название команды, а не путь файла,
-- поэтому капитан не мог загрузить логотип (проходил только admin). Путь — явно objects.name.
drop policy "team logo" on storage.objects;
create policy "team logo" on storage.objects for all to authenticated
  using (bucket_id = 'team-logos' and (public.is_admin() or exists (
    select 1 from public.teams t where t.id::text = (storage.foldername(objects.name))[1] and t.captain_id = (select auth.uid()))))
  with check (bucket_id = 'team-logos' and (public.is_admin() or exists (
    select 1 from public.teams t where t.id::text = (storage.foldername(objects.name))[1] and t.captain_id = (select auth.uid()))));

-- ═════ 0013_team_accept.sql ═════
-- Принятие в команду без организатора:
-- заявку пилота (invited = false) принимает капитан, приглашение капитана (invited = true) — сам пилот.
alter table public.team_members add column invited boolean not null default false;

-- Кто создал строку: если не сам пилот — это приглашение. Ставит база, не клиент.
create or replace function public.captain_joins() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  new.invited := new.profile_id is distinct from auth.uid();
  if exists (select 1 from public.teams where id = new.team_id and captain_id = new.profile_id) then
    new.status := 'approved';
    new.invited := false;
  end if;
  return new;
end $$;

-- Не-организатор при принятии меняет только статус
create function public.guard_member_update() returns trigger
language plpgsql set search_path = '' as $$
begin
  if public.is_admin() then
    return new;
  end if;
  if new.team_id is distinct from old.team_id or new.season_id is distinct from old.season_id
     or new.profile_id is distinct from old.profile_id or new.invited is distinct from old.invited then
    raise exception 'Можно только принять заявку или приглашение';
  end if;
  return new;
end $$;
create trigger team_members_guard_update before update on public.team_members
  for each row execute function public.guard_member_update();

create policy "accept" on public.team_members for update
  using (
    status = 'pending' and (
      (invited and profile_id = (select auth.uid()))
      or (not invited and exists (select 1 from public.teams t where t.id = team_id and t.captain_id = (select auth.uid())))
    )
  )
  with check (
    status = 'approved' and (
      (invited and profile_id = (select auth.uid()))
      or (not invited and exists (select 1 from public.teams t where t.id = team_id and t.captain_id = (select auth.uid())))
    )
  );

-- ═════ 0014_run_fail.sql ═════
-- Причина нулевой попытки квалификации: спин, авария, выпрямление (проехал на прямых), вылет (4 колеса за трассой).
-- spin = true по-прежнему означает «попытка = 0» (на нём держится total), fail уточняет, что случилось.
alter table public.qual_runs
  add column if not exists fail text check (fail in ('spin', 'crash', 'straight', 'offtrack'));

update public.qual_runs set fail = 'spin' where spin and fail is null;

-- ═════ 0015_battle_contact.sql ═════
-- Дуэль проиграна из-за контакта: пилот врезался в соперника, который ехал впереди (ачивка «Божественное касание»)
alter type public.battle_result add value if not exists 'contact';
