-- 1) Índices das chaves estrangeiras que faltavam
create index if not exists workout_sets_user_id_idx on public.workout_sets (user_id);
create index if not exists feedback_user_id_idx on public.feedback (user_id);

-- 2) Restrições de valores válidos
alter table public.exercises add constraint exercises_kind_check
  check (kind in ('weight_reps','reps','duration','weighted_bodyweight','assisted_bodyweight'));
alter table public.workout_sets add constraint workout_sets_set_type_check
  check (set_type in ('normal','warmup','failure','drop'));
alter table public.workout_sets add constraint workout_sets_reps_check check (reps >= 0);
alter table public.workouts add constraint workouts_visibility_check
  check (visibility in ('everyone','followers','private'));
alter table public.workouts add constraint workouts_duration_check check (duration_sec >= 0);
alter table public.profiles add constraint profiles_theme_check
  check (theme in ('light','dark','system'));
alter table public.profiles add constraint profiles_sex_check
  check (sex is null or sex in ('male','female'));

-- 3) updated_at com gatilho
create or replace function public.set_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin new.updated_at = now(); return new; end $$;

alter table public.workouts  add column if not exists updated_at timestamptz not null default now();
alter table public.routines  add column if not exists updated_at timestamptz not null default now();
alter table public.exercises add column if not exists updated_at timestamptz not null default now();
alter table public.profiles  add column if not exists updated_at timestamptz not null default now();

create trigger workouts_set_updated_at  before update on public.workouts  for each row execute function public.set_updated_at();
create trigger routines_set_updated_at  before update on public.routines  for each row execute function public.set_updated_at();
create trigger exercises_set_updated_at before update on public.exercises for each row execute function public.set_updated_at();
create trigger profiles_set_updated_at  before update on public.profiles  for each row execute function public.set_updated_at();

-- 4) username único (ignora maiúsculas; vazio não conta)
create unique index if not exists profiles_username_uniq on public.profiles (lower(username)) where username <> '';

-- 5) distância e duração por série (tipos Distance & Duration / Weight & Distance)
alter table public.workout_sets add column if not exists distance_m numeric check (distance_m >= 0);
alter table public.workout_sets add column if not exists duration_sec integer check (duration_sec >= 0);
