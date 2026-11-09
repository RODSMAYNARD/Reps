-- Libera os tipos de exercício com tempo/distância e faz a rotina guardar tempo e distância das séries.
-- PENDENTE: aplicar no projeto `reps` (o modo automático bloqueou a aplicação; precisa da aprovação do Rodrigo).
-- Aditiva: só amplia o CHECK e acrescenta duas colunas no insert do gatilho da rotina.

alter table public.exercises drop constraint exercises_kind_check;
alter table public.exercises add constraint exercises_kind_check check (kind = any (array[
  'weight_reps', 'reps', 'duration', 'weighted_bodyweight', 'assisted_bodyweight',
  'duration_weight', 'distance_duration', 'weight_distance'
]));

create or replace function public.sync_routine_children(p_routine_id uuid, p_exercises jsonb)
 returns void
 language plpgsql
 set search_path to ''
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
      insert into public.routine_sets (user_id, routine_exercise_id, position, set_type, weight, reps, duration_sec, distance_m)
      values (uid, reid, j, coalesce(s->>'type', 'normal'), (s->>'kg')::numeric, round((s->>'reps')::numeric)::int,
              round((s->>'seconds')::numeric)::int, (s->>'distM')::numeric);
      j := j + 1;
    end loop;
  end loop;
end $function$;
