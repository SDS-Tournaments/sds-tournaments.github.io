-- Прогнозы зрителей во время этапа: квалификация — сколько наберёт пилот на трассе (<80 / 80+ / 85+ / 90+ / 95+ / 100),
-- парные — кто победит в дуэли. Голосуют все, без входа: голос привязан к случайному id браузера (voter), один на заезд/дуэль.
-- Голосование закрывается само: оценка заезда сохранена / по дуэли есть победитель.
create table if not exists public.predictions (
  id bigint generated always as identity primary key,
  stage_id bigint not null references public.stages on delete cascade,
  profile_id uuid references public.profiles on delete cascade, -- квалификация: пилот
  attempt smallint check (attempt in (1, 2)),                    -- квалификация: зачётная попытка (прогрев не угадываем)
  battle_id bigint references public.battles on delete cascade,  -- парные: дуэль
  pick text not null,
  voter text not null check (char_length(voter) between 8 and 64),
  created_at timestamptz not null default now(),
  check (
    (battle_id is null and profile_id is not null and attempt is not null and pick in ('lt80', '80', '85', '90', '95', '100'))
    or (battle_id is not null and profile_id is null and attempt is null and pick in ('leader', 'chaser'))
  )
);
create unique index if not exists predictions_run_voter on public.predictions (stage_id, profile_id, attempt, voter) where battle_id is null;
create unique index if not exists predictions_battle_voter on public.predictions (battle_id, voter) where battle_id is not null;
create index if not exists predictions_stage on public.predictions (stage_id);

alter table public.predictions enable row level security;
grant select, insert on public.predictions to anon, authenticated;
grant delete on public.predictions to authenticated;
drop policy if exists "read" on public.predictions;
drop policy if exists "vote" on public.predictions;
drop policy if exists "staff" on public.predictions;
create policy "read" on public.predictions for select using (true);
create policy "vote" on public.predictions for insert with check (true);
create policy "staff" on public.predictions for delete using (public.is_staff());

-- Голос принимается, только пока заезд/дуэль ещё не оценены
create or replace function public.guard_prediction() returns trigger
language plpgsql security definer set search_path = '' as $$
declare st public.stage_status;
begin
  select status into st from public.stages where id = new.stage_id;
  if new.battle_id is null then
    if st is distinct from 'qualifying'
       or exists (select 1 from public.qual_runs where stage_id = new.stage_id and profile_id = new.profile_id and attempt = new.attempt)
       or not exists (select 1 from public.registrations where stage_id = new.stage_id and profile_id = new.profile_id and status = 'registered') then
      raise exception 'Голосование закрыто';
    end if;
  elsif st is distinct from 'battles' or not exists (
    select 1 from public.battles b
    where b.id = new.battle_id and b.stage_id = new.stage_id and b.winner_id is null and b.leader_id is not null and b.chaser_id is not null
  ) then
    raise exception 'Голосование закрыто';
  end if;
  new.created_at := now();
  return new;
end $$;
drop trigger if exists predictions_guard on public.predictions;
create trigger predictions_guard before insert on public.predictions
  for each row execute function public.guard_prediction();

-- Итоги голосования этапа (сайт и плашки берут готовые числа, а не все голоса)
create or replace function public.prediction_counts(p_stage bigint)
returns table (profile_id uuid, attempt smallint, battle_id bigint, pick text, n bigint)
language sql stable security definer set search_path = '' as $$
  select profile_id, attempt, battle_id, pick, count(*) from public.predictions where stage_id = p_stage group by 1, 2, 3, 4
$$;
grant execute on function public.prediction_counts(bigint) to anon, authenticated;

alter publication supabase_realtime add table public.predictions;
