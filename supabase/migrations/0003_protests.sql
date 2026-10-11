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
