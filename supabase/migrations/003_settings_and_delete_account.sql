-- =====================================================================
-- MyLoja — configurações da loja na nuvem + "Excluir minha conta".
-- Rode UMA vez em: Supabase > SQL Editor > New query > Run.
-- É seguro rodar de novo. (Já está incluído no schema.sql.)
-- =====================================================================

create table if not exists public.store_settings (
  user_id          uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  owner_name       text   not null default '' check (char_length(owner_name) <= 40),
  store_name       text   not null default '' check (char_length(store_name) <= 40),
  logo             text   check (logo is null or char_length(logo) <= 400000),  -- imagem pequena (data URL)
  profit_margin_bp jsonb  not null default '{}'::jsonb,
  closings         jsonb  not null default '{}'::jsonb,
  updated_at       timestamptz not null default now()
);

alter table public.store_settings enable row level security;

drop policy if exists "store_settings: dono lê"     on public.store_settings;
drop policy if exists "store_settings: dono insere" on public.store_settings;
drop policy if exists "store_settings: dono altera" on public.store_settings;
drop policy if exists "store_settings: dono apaga"  on public.store_settings;

create policy "store_settings: dono lê"     on public.store_settings for select to authenticated
  using (user_id = (select auth.uid()));
create policy "store_settings: dono insere" on public.store_settings for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy "store_settings: dono altera" on public.store_settings for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "store_settings: dono apaga"  on public.store_settings for delete to authenticated
  using (user_id = (select auth.uid()));

-- Excluir de vez a própria conta e todos os dados (usada em Ajustes > Zona de perigo).
create or replace function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'Não autenticado';
  end if;
  delete from public.transactions   where user_id = uid;
  delete from public.customers      where user_id = uid;
  delete from public.store_settings where user_id = uid;
  delete from auth.users            where id = uid;
end;
$$;

revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;
