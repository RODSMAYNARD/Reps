-- Limite diário de mensagens do Coach com IA (2026-11-23).
-- Uma linha por usuário e dia. O app só LÊ a própria contagem; quem grava é a Edge Function `coach` (service role),
-- reservando a vaga ANTES de chamar a IA (coach_usage_bump) e devolvendo se a chamada falhar (coach_usage_refund).
create table if not exists public.coach_usage (
  user_id uuid not null references auth.users(id) on delete cascade,
  day date not null,
  count int not null default 0 check (count >= 0),
  primary key (user_id, day)
);
alter table public.coach_usage enable row level security;
drop policy if exists coach_usage_select_own on public.coach_usage;
create policy coach_usage_select_own on public.coach_usage for select to authenticated using ((select auth.uid()) = user_id);

-- Reserva uma mensagem: devolve a nova contagem, ou null se o limite do dia já foi atingido.
create or replace function public.coach_usage_bump(p_user uuid, p_day date, p_limit int)
returns int language plpgsql security definer set search_path = public as $$
declare n int;
begin
  insert into public.coach_usage as u (user_id, day, count) values (p_user, p_day, 1)
  on conflict (user_id, day) do update set count = u.count + 1 where u.count < p_limit
  returning u.count into n;
  return n;
end $$;

-- Devolve a vaga quando a IA não respondeu (sem chave, erro, recusa).
create or replace function public.coach_usage_refund(p_user uuid, p_day date)
returns void language sql security definer set search_path = public as $$
  update public.coach_usage set count = greatest(0, count - 1) where user_id = p_user and day = p_day;
$$;

revoke all on function public.coach_usage_bump(uuid, date, int) from public, anon, authenticated;
revoke all on function public.coach_usage_refund(uuid, date) from public, anon, authenticated;
grant execute on function public.coach_usage_bump(uuid, date, int) to service_role;
grant execute on function public.coach_usage_refund(uuid, date) to service_role;
