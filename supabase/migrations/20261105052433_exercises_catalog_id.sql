alter table public.exercises add column if not exists catalog_id text;
create unique index if not exists exercises_user_catalog_uniq on public.exercises (user_id, catalog_id) where catalog_id is not null;
