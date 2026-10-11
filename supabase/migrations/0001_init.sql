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
