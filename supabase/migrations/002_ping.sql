-- =====================================================================
-- MyLoja — função "ping" para manter o projeto gratuito ativo.
-- Rode UMA vez em: Supabase > SQL Editor > New query > Run.
-- Ela só devolve a hora do servidor: não lê nem altera nenhum dado.
-- (Já está incluída no schema.sql; este arquivo é para quem criou o banco antes.)
-- =====================================================================

create or replace function public.ping()
returns timestamptz
language sql
stable
set search_path = ''
as $$
  select now();
$$;

grant execute on function public.ping() to anon, authenticated;
