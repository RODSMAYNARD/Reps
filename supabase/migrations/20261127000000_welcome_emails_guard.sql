-- PENDENTE (2026-11-27): ainda NÃO aplicada no banco, e a função send-email publicada (v4) ainda usa user_state.welcome_sent_at.
-- Aplicar esta migração e só depois publicar supabase/functions/send-email (que já usa welcome_emails).
-- Trava do e-mail de boas-vindas fora do alcance do cliente (send-email usa o service role).
-- Antes: user_state.welcome_sent_at, que o próprio usuário podia zerar (policy FOR ALL + UPDATE/DELETE) e reenviar o e-mail em loop.
create table if not exists public.welcome_emails (
  user_id uuid primary key references auth.users(id) on delete cascade,
  sent_at timestamptz not null default now()
);
alter table public.welcome_emails enable row level security;
-- Sem policy nenhuma: anon/authenticated não leem nem escrevem; o service role ignora RLS.
revoke all on public.welcome_emails from anon, authenticated;

-- Quem já recebeu continua marcado.
insert into public.welcome_emails (user_id, sent_at)
select user_id, welcome_sent_at from public.user_state where welcome_sent_at is not null
on conflict (user_id) do nothing;

-- A coluna antiga não é mais lida pela função; pode ser removida depois (o app nunca leu nem gravou).
-- alter table public.user_state drop column welcome_sent_at;
