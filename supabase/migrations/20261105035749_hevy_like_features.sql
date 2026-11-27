create table public.profiles (
  user_id uuid primary key default auth.uid() references auth.users(id) on delete cascade,
  username text not null default '',
  display_name text not null default '',
  bio text not null default '',
  link text not null default '',
  sex text,
  birth_year int,
  weight_kg numeric,
  units jsonb not null default '{"weight":"kg","distance":"km","body":"cm"}',
  theme text not null default 'light',
  is_private boolean not null default false,
  onboarded boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.routines (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  title text not null default '',
  notes text not null default '',
  exercises jsonb not null default '[]',
  created_at timestamptz not null default now()
);

create table public.measurements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  measured_on date not null default current_date,
  values jsonb not null default '{}',
  photo_uri text,
  created_at timestamptz not null default now()
);

create table public.feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  kind text not null,
  body text not null,
  ref text,
  created_at timestamptz not null default now()
);

alter table public.exercises add column equipment text not null default '';
alter table public.exercises add column kind text not null default 'weight_reps';
alter table public.workouts add column title text not null default 'Treino';
alter table public.workouts add column description text not null default '';
alter table public.workouts add column duration_sec int not null default 0;
alter table public.workouts add column visibility text not null default 'everyone';
alter table public.workouts add column meta jsonb not null default '{}';
alter table public.workout_sets add column set_type text not null default 'normal';

create index on public.routines (user_id);
create index on public.measurements (user_id, measured_on desc);

alter table public.profiles enable row level security;
alter table public.routines enable row level security;
alter table public.measurements enable row level security;
alter table public.feedback enable row level security;

create policy "own profile" on public.profiles for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "own routines" on public.routines for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "own measurements" on public.measurements for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "own feedback" on public.feedback for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
