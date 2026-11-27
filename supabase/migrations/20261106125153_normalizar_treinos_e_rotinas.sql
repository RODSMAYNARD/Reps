-- ===== Tabelas novas =====
create table public.workout_exercises (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  workout_id uuid not null references public.workouts(id) on delete cascade,
  exercise_id uuid not null references public.exercises(id) on delete cascade,
  position integer not null check (position >= 0),
  notes text not null default '',
  rest_sec integer not null default 0 check (rest_sec >= 0),
  superset integer,
  created_at timestamptz not null default now(),
  unique (workout_id, position)
);
create index workout_exercises_user_id_idx on public.workout_exercises (user_id);
create index workout_exercises_exercise_id_idx on public.workout_exercises (exercise_id);

alter table public.workout_sets add column workout_exercise_id uuid references public.workout_exercises(id) on delete cascade;
create index workout_sets_workout_exercise_id_idx on public.workout_sets (workout_exercise_id);

create table public.routine_exercises (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  routine_id uuid not null references public.routines(id) on delete cascade,
  exercise_id uuid not null references public.exercises(id) on delete cascade,
  position integer not null check (position >= 0),
  notes text not null default '',
  rest_sec integer not null default 0 check (rest_sec >= 0),
  superset integer,
  created_at timestamptz not null default now(),
  unique (routine_id, position)
);
create index routine_exercises_user_id_idx on public.routine_exercises (user_id);
create index routine_exercises_exercise_id_idx on public.routine_exercises (exercise_id);

create table public.routine_sets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  routine_exercise_id uuid not null references public.routine_exercises(id) on delete cascade,
  position integer not null check (position >= 0),
  set_type text not null default 'normal' check (set_type in ('normal','warmup','failure','drop')),
  weight numeric check (weight >= 0),
  reps integer check (reps >= 0),
  duration_sec integer check (duration_sec >= 0),
  distance_m numeric check (distance_m >= 0),
  unique (routine_exercise_id, position)
);
create index routine_sets_user_id_idx on public.routine_sets (user_id);

-- Campos do treino que estavam soltos no JSON meta
alter table public.workouts add column routine_id uuid references public.routines(id) on delete set null;
alter table public.workouts add column location text;
alter table public.workouts add column from_trainer boolean not null default false;
create index workouts_routine_id_idx on public.workouts (routine_id);

-- ===== RLS: dono da linha E dono do pai =====
alter table public.workout_exercises enable row level security;
alter table public.routine_exercises enable row level security;
alter table public.routine_sets enable row level security;

create policy "own workout exercises" on public.workout_exercises for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id and exists (select 1 from public.workouts w where w.id = workout_id and w.user_id = (select auth.uid())));
create policy "own routine exercises" on public.routine_exercises for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id and exists (select 1 from public.routines r where r.id = routine_id and r.user_id = (select auth.uid())));
create policy "own routine sets" on public.routine_sets for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id and exists (select 1 from public.routine_exercises re where re.id = routine_exercise_id and re.user_id = (select auth.uid())));
drop policy "own sets" on public.workout_sets;
create policy "own sets" on public.workout_sets for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id and exists (select 1 from public.workouts w where w.id = workout_id and w.user_id = (select auth.uid())));

-- ===== Rotina: as tabelas filhas são preenchidas a partir da gravação da rotina (mesma transação) =====
create or replace function public.sync_routine_children(p_routine_id uuid, p_exercises jsonb)
returns void language plpgsql security invoker set search_path = '' as $$
declare e jsonb; i int := 0; s jsonb; j int; reid uuid; uid uuid;
begin
  select user_id into uid from public.routines where id = p_routine_id;
  delete from public.routine_exercises where routine_id = p_routine_id;
  for e in select value from jsonb_array_elements(coalesce(p_exercises, '[]'::jsonb)) loop
    if not exists (select 1 from public.exercises x where x.id::text = e->>'exerciseId') then continue; end if;
    insert into public.routine_exercises (user_id, routine_id, exercise_id, position, notes, rest_sec, superset)
    values (uid, p_routine_id, (e->>'exerciseId')::uuid, i, coalesce(e->>'notes', ''), coalesce(round((e->>'restSec')::numeric)::int, 0), (e->>'superset')::int)
    returning id into reid;
    i := i + 1; j := 0;
    for s in select value from jsonb_array_elements(coalesce(e->'sets', '[]'::jsonb)) loop
      insert into public.routine_sets (user_id, routine_exercise_id, position, set_type, weight, reps)
      values (uid, reid, j, coalesce(s->>'type', 'normal'), (s->>'kg')::numeric, round((s->>'reps')::numeric)::int);
      j := j + 1;
    end loop;
  end loop;
end $$;

create or replace function public.routines_sync_children() returns trigger
language plpgsql security invoker set search_path = '' as $$
begin perform public.sync_routine_children(new.id, new.exercises); return null; end $$;
create trigger routines_sync_children after insert or update of exercises on public.routines
  for each row execute function public.routines_sync_children();

-- ===== Treino: gravação atômica numa chamada só =====
create or replace function public.save_workout(p_workout jsonb, p_entries jsonb)
returns uuid language plpgsql security invoker set search_path = '' as $$
declare wid uuid := (p_workout->>'id')::uuid; uid uuid := auth.uid(); e jsonb; i int := 0; s jsonb; weid uuid; pos int := 0; rid uuid;
begin
  if uid is null then raise exception 'not authenticated'; end if;
  perform set_config('reps.rpc', 'on', true);
  rid := nullif(p_workout->>'routine_id', '')::uuid;
  if rid is not null and not exists (select 1 from public.routines r where r.id = rid) then rid := null; end if;
  insert into public.workouts (id, user_id, performed_at, title, description, duration_sec, visibility, meta, routine_id, location, from_trainer)
  values (wid, uid, (p_workout->>'performed_at')::timestamptz, coalesce(nullif(p_workout->>'title', ''), 'Workout'), coalesce(p_workout->>'description', ''),
          coalesce((p_workout->>'duration_sec')::int, 0), coalesce(p_workout->>'visibility', 'everyone'), coalesce(p_workout->'meta', '{}'::jsonb),
          rid, nullif(p_workout->>'location', ''), coalesce((p_workout->>'from_trainer')::boolean, false))
  on conflict (id) do update set performed_at = excluded.performed_at, title = excluded.title, description = excluded.description,
    duration_sec = excluded.duration_sec, visibility = excluded.visibility, meta = excluded.meta,
    routine_id = excluded.routine_id, location = excluded.location, from_trainer = excluded.from_trainer
  where public.workouts.user_id = uid;
  if not found then raise exception 'workout not found'; end if;
  delete from public.workout_sets where workout_id = wid;
  delete from public.workout_exercises where workout_id = wid;
  for e in select value from jsonb_array_elements(coalesce(p_entries, '[]'::jsonb)) loop
    insert into public.workout_exercises (user_id, workout_id, exercise_id, position, notes, rest_sec, superset)
    values (uid, wid, (e->>'exercise_id')::uuid, i, coalesce(e->>'notes', ''), coalesce(round((e->>'rest_sec')::numeric)::int, 0), (e->>'superset')::int)
    returning id into weid;
    i := i + 1;
    for s in select value from jsonb_array_elements(coalesce(e->'sets', '[]'::jsonb)) loop
      insert into public.workout_sets (user_id, workout_id, workout_exercise_id, exercise_id, position, set_type, weight, reps, duration_sec, distance_m)
      values (uid, wid, weid, (e->>'exercise_id')::uuid, pos, coalesce(s->>'set_type', 'normal'), coalesce((s->>'weight')::numeric, 0),
              coalesce(round((s->>'reps')::numeric)::int, 0), (s->>'duration_sec')::int, (s->>'distance_m')::numeric);
      pos := pos + 1;
    end loop;
  end loop;
  return wid;
end $$;
revoke execute on function public.save_workout(jsonb, jsonb) from public, anon;
grant execute on function public.save_workout(jsonb, jsonb) to authenticated;
revoke execute on function public.sync_routine_children(uuid, jsonb) from public, anon, authenticated;

-- ===== Compatibilidade com o app antigo (grava workouts.meta + workout_sets sem workout_exercise_id) =====
create or replace function public.workouts_legacy_meta() returns trigger
language plpgsql security invoker set search_path = '' as $$
declare rid uuid;
begin
  if coalesce(current_setting('reps.rpc', true), '') = 'on' then return new; end if;
  new.location := nullif(new.meta->>'location', '');
  new.from_trainer := coalesce((new.meta->>'trainer')::boolean, false);
  rid := nullif(new.meta->>'routineId', '')::uuid;
  if rid is not null and not exists (select 1 from public.routines r where r.id = rid) then rid := null; end if;
  new.routine_id := rid;
  return new;
end $$;
create trigger workouts_legacy_meta before insert or update of meta on public.workouts
  for each row execute function public.workouts_legacy_meta();

create or replace function public.workouts_legacy_reset() returns trigger
language plpgsql security invoker set search_path = '' as $$
begin
  if coalesce(current_setting('reps.rpc', true), '') <> 'on' then
    delete from public.workout_exercises where workout_id = new.id;
  end if;
  return null;
end $$;
create trigger workouts_legacy_reset after update of meta on public.workouts
  for each row execute function public.workouts_legacy_reset();

create or replace function public.workout_sets_attach_legacy() returns trigger
language plpgsql security invoker set search_path = '' as $$
declare weid uuid; m jsonb; k text := new.exercise_id::text;
begin
  if new.workout_exercise_id is not null then return new; end if;
  select id into weid from public.workout_exercises where workout_id = new.workout_id and exercise_id = new.exercise_id order by position limit 1;
  if weid is null then
    select meta into m from public.workouts where id = new.workout_id;
    insert into public.workout_exercises (user_id, workout_id, exercise_id, position, notes, rest_sec, superset)
    values (new.user_id, new.workout_id, new.exercise_id,
            (select coalesce(max(position) + 1, 0) from public.workout_exercises where workout_id = new.workout_id),
            coalesce(m->'notes'->>k, ''), coalesce(round((m->'rest'->>k)::numeric)::int, 0), (m->'superset'->>k)::int)
    returning id into weid;
  end if;
  new.workout_exercise_id := weid;
  return new;
end $$;
create trigger workout_sets_attach_legacy before insert on public.workout_sets
  for each row execute function public.workout_sets_attach_legacy();

-- ===== Migração dos dados existentes =====
insert into public.workout_exercises (user_id, workout_id, exercise_id, position, notes, rest_sec, superset)
select ws.user_id, ws.workout_id, ws.exercise_id,
       (row_number() over (partition by ws.workout_id order by min(ws.position)) - 1)::int,
       coalesce(w.meta->'notes'->>ws.exercise_id::text, ''),
       coalesce(round((w.meta->'rest'->>ws.exercise_id::text)::numeric)::int, 0),
       (w.meta->'superset'->>ws.exercise_id::text)::int
from public.workout_sets ws join public.workouts w on w.id = ws.workout_id
group by ws.user_id, ws.workout_id, ws.exercise_id, w.meta;

update public.workout_sets ws set workout_exercise_id = we.id
from public.workout_exercises we where we.workout_id = ws.workout_id and we.exercise_id = ws.exercise_id;

alter table public.workout_sets alter column workout_exercise_id set not null;

update public.workouts set meta = meta;  -- preenche routine_id/location/from_trainer pelo gatilho (e recria filhos abaixo)
