-- Vídeo do treino (2026-11-23): bucket privado próprio (o progress-photos aceita só imagens até 8 MB).
-- Um vídeo por treino em <uid>/w-<id do treino>.<ext>; caminho em workouts.meta.video. Cada usuário só mexe na própria pasta.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('workout-videos', 'workout-videos', false, 52428800, array['video/mp4', 'video/quicktime', 'video/webm', 'video/3gpp'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

create policy workout_videos_own_select on storage.objects for select to authenticated
  using (bucket_id = 'workout-videos' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy workout_videos_own_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'workout-videos' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy workout_videos_own_update on storage.objects for update to authenticated
  using (bucket_id = 'workout-videos' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy workout_videos_own_delete on storage.objects for delete to authenticated
  using (bucket_id = 'workout-videos' and (storage.foldername(name))[1] = (select auth.uid())::text);
