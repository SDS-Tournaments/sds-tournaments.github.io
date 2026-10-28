-- Общий пульт судей: каждый судья со своего устройства ставит свой критерий / голос, главный сохраняет.
-- Черновики отдельно от qual_runs / battle_votes — на стрим попадает только сохранённое главным.

-- Баллы и голоса до сохранения. target: 'q:<profile_id>:<attempt>' (квала) или 'b:<battle_id>:<try>' (дуэль)
create table if not exists public.judge_marks (
  stage_id bigint not null references public.stages on delete cascade,
  target text not null,
  crit public.judge_slot not null,
  score numeric(5, 2) check (score >= 0),
  vote public.vote_kind,
  judge uuid references public.profiles on delete set null,
  updated_at timestamptz not null default now(),
  primary key (stage_id, target, crit)
);

-- Кого сейчас оценивают — общий выбор для всех пультов (null — первый по очереди)
create table if not exists public.judge_live (
  stage_id bigint primary key references public.stages on delete cascade,
  target text,
  updated_at timestamptz not null default now()
);

alter table public.judge_marks enable row level security;
alter table public.judge_live enable row level security;
revoke all on public.judge_marks, public.judge_live from anon;
grant select, insert, update, delete on public.judge_marks, public.judge_live to authenticated;
drop policy if exists "staff" on public.judge_marks;
drop policy if exists "staff" on public.judge_live;
create policy "staff" on public.judge_marks for all using (public.is_staff()) with check (public.is_staff());
create policy "staff" on public.judge_live for all using (public.is_staff()) with check (public.is_staff());

alter publication supabase_realtime add table public.judge_marks, public.judge_live;
