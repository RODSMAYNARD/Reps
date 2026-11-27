-- Séries do backup; o gatilho de compatibilidade recria workout_exercises a partir do meta
insert into public.workout_sets (id, user_id, workout_id, exercise_id, position, reps, weight, set_type)
select b.id, b.user_id, b.workout_id, b.exercise_id, b.position, b.reps, b.weight, b.set_type
from backup_20261106.workout_sets b
where exists (select 1 from public.workouts w where w.id = b.workout_id)
  and exists (select 1 from public.exercises x where x.id = b.exercise_id)
  and not exists (select 1 from public.workout_sets s where s.id = b.id)
order by b.workout_id, b.position;

-- Campos do treino tirados do meta, sem disparar o reset dos filhos
select set_config('reps.rpc', 'on', true);
update public.workouts w set
  location = nullif(w.meta->>'location', ''),
  from_trainer = coalesce((w.meta->>'trainer')::boolean, false),
  routine_id = (select r.id from public.routines r where r.id::text = w.meta->>'routineId');

-- Rotinas existentes nas tabelas novas
select public.sync_routine_children(id, exercises) from public.routines;
