alter table public.workout_exercises add column if not exists weight_unit text check (weight_unit in ('kg','lbs'));
alter table public.routine_exercises add column if not exists weight_unit text check (weight_unit in ('kg','lbs'));

create table if not exists public.pinned_notes (
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  scope text not null check (scope in ('exercise','routine')),
  key text not null,
  texts text[] not null default '{}',
  updated_at timestamptz not null default now(),
  primary key (user_id, scope, key)
);
alter table public.pinned_notes enable row level security;
create policy pinned_notes_own on public.pinned_notes for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create trigger pinned_notes_set_updated_at before update on public.pinned_notes for each row execute function public.set_updated_at();

create or replace function public.sync_routine_children(p_routine_id uuid, p_exercises jsonb)
 returns void language plpgsql set search_path to ''
as $function$
declare e jsonb; i int := 0; s jsonb; j int; reid uuid; uid uuid;
begin
  select user_id into uid from public.routines where id = p_routine_id;
  delete from public.routine_exercises where routine_id = p_routine_id;
  for e in select value from jsonb_array_elements(coalesce(p_exercises, '[]'::jsonb)) loop
    if not exists (select 1 from public.exercises x where x.id::text = e->>'exerciseId') then continue; end if;
    insert into public.routine_exercises (user_id, routine_id, exercise_id, position, notes, rest_sec, superset, weight_unit)
    values (uid, p_routine_id, (e->>'exerciseId')::uuid, i, coalesce(e->>'notes', ''), coalesce(round((e->>'restSec')::numeric)::int, 0), (e->>'superset')::int, nullif(e->>'unit', ''))
    returning id into reid;
    i := i + 1; j := 0;
    for s in select value from jsonb_array_elements(coalesce(e->'sets', '[]'::jsonb)) loop
      insert into public.routine_sets (user_id, routine_exercise_id, position, set_type, weight, reps)
      values (uid, reid, j, coalesce(s->>'type', 'normal'), (s->>'kg')::numeric, round((s->>'reps')::numeric)::int);
      j := j + 1;
    end loop;
  end loop;
end $function$;

create or replace function public.save_workout(p_workout jsonb, p_entries jsonb)
 returns uuid language plpgsql set search_path to ''
as $function$
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
    insert into public.workout_exercises (user_id, workout_id, exercise_id, position, notes, rest_sec, superset, weight_unit)
    values (uid, wid, (e->>'exercise_id')::uuid, i, coalesce(e->>'notes', ''), coalesce(round((e->>'rest_sec')::numeric)::int, 0), (e->>'superset')::int, nullif(e->>'weight_unit', ''))
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
end $function$;
