alter table public.workout_sets drop constraint if exists workout_sets_reps_check;
alter table public.workout_sets alter column reps set default 0;
