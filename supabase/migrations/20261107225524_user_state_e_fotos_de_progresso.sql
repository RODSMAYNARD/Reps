create table if not exists public.user_state (
  user_id uuid primary key default auth.uid() references auth.users(id) on delete cascade,
  trainer jsonb,
  wprefs jsonb,
  updated_at timestamptz not null default now()
);
alter table public.user_state enable row level security;
create policy user_state_own on public.user_state for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create trigger user_state_set_updated_at before update on public.user_state for each row execute function public.set_updated_at();

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('progress-photos', 'progress-photos', false, 8388608, array['image/jpeg','image/png','image/webp'])
on conflict (id) do nothing;
create policy progress_photos_own_select on storage.objects for select to authenticated
  using (bucket_id = 'progress-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy progress_photos_own_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'progress-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy progress_photos_own_update on storage.objects for update to authenticated
  using (bucket_id = 'progress-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy progress_photos_own_delete on storage.objects for delete to authenticated
  using (bucket_id = 'progress-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);
