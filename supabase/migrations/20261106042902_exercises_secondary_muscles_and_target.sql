alter table public.exercises
  add column if not exists secondary_muscles text[] not null default '{}',
  add column if not exists target text;
