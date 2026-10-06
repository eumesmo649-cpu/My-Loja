-- =====================================================================
-- MyLoja — esquema do banco (Supabase / PostgreSQL)
-- Rode este arquivo UMA vez em: Supabase > SQL Editor > New query > Run.
-- É seguro rodar de novo (usa "if not exists" / "drop policy if exists").
-- =====================================================================

-- ---------- Tabelas ----------------------------------------------------

create table if not exists public.customers (
  id          uuid primary key,
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name        text not null check (char_length(btrim(name)) between 2 and 80),
  phone       text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  deleted_at  timestamptz,
  synced_at   timestamptz not null default now()   -- definido pelo servidor (cursor de sincronização)
);

create table if not exists public.transactions (
  id              uuid primary key,
  user_id         uuid not null default auth.uid() references auth.users (id) on delete cascade,
  type            text   not null check (type in ('SALE', 'PAYMENT', 'PURCHASE')),
  -- valores SEMPRE em centavos (inteiro): R$ 35,90 = 3590
  amount_cents    bigint not null check (amount_cents > 0 and amount_cents <= 1000000000),
  payment_method  text   not null check (payment_method in ('PIX', 'CASH', 'DEBIT', 'CREDIT', 'FICHA')),
  customer_id     uuid references public.customers (id),
  supplier        text,
  note            text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  deleted_at      timestamptz,
  synced_at       timestamptz not null default now(),

  -- Regras de negócio garantidas também no banco:
  constraint payment_needs_customer
    check (type <> 'PAYMENT' or (customer_id is not null and payment_method <> 'FICHA')),
  constraint ficha_sale_needs_customer
    check (not (type = 'SALE' and payment_method = 'FICHA') or customer_id is not null),
  constraint purchase_not_ficha
    check (type <> 'PURCHASE' or payment_method <> 'FICHA')
);

create index if not exists customers_user_idx     on public.customers (user_id, synced_at);
create index if not exists transactions_user_idx  on public.transactions (user_id, created_at desc);
create index if not exists transactions_sync_idx  on public.transactions (user_id, synced_at);
create index if not exists transactions_cust_idx  on public.transactions (customer_id);

-- ---------- synced_at sempre carimbado pelo servidor --------------------

create or replace function public.set_synced_at()
returns trigger
language plpgsql
as $$
begin
  new.synced_at := now();
  return new;
end;
$$;

drop trigger if exists customers_synced_at on public.customers;
create trigger customers_synced_at
  before insert or update on public.customers
  for each row execute function public.set_synced_at();

drop trigger if exists transactions_synced_at on public.transactions;
create trigger transactions_synced_at
  before insert or update on public.transactions
  for each row execute function public.set_synced_at();

-- ---------- Row Level Security -----------------------------------------
-- Cada usuária só enxerga e altera as PRÓPRIAS linhas.

alter table public.customers    enable row level security;
alter table public.transactions enable row level security;

drop policy if exists "customers: dono lê"      on public.customers;
drop policy if exists "customers: dono insere"  on public.customers;
drop policy if exists "customers: dono altera"  on public.customers;
drop policy if exists "customers: dono apaga"   on public.customers;

create policy "customers: dono lê"     on public.customers for select to authenticated
  using (user_id = (select auth.uid()));
create policy "customers: dono insere" on public.customers for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy "customers: dono altera" on public.customers for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "customers: dono apaga"  on public.customers for delete to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists "transactions: dono lê"      on public.transactions;
drop policy if exists "transactions: dono insere"  on public.transactions;
drop policy if exists "transactions: dono altera"  on public.transactions;
drop policy if exists "transactions: dono apaga"   on public.transactions;

create policy "transactions: dono lê"     on public.transactions for select to authenticated
  using (user_id = (select auth.uid()));
create policy "transactions: dono insere" on public.transactions for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and (customer_id is null or exists (
      select 1 from public.customers c
      where c.id = customer_id and c.user_id = (select auth.uid())
    ))
  );
create policy "transactions: dono altera" on public.transactions for update to authenticated
  using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    and (customer_id is null or exists (
      select 1 from public.customers c
      where c.id = customer_id and c.user_id = (select auth.uid())
    ))
  );
create policy "transactions: dono apaga"  on public.transactions for delete to authenticated
  using (user_id = (select auth.uid()));

-- Sem acesso para usuários anônimos (não logados).
revoke all on public.customers    from anon;
revoke all on public.transactions from anon;
grant select, insert, update, delete on public.customers    to authenticated;
grant select, insert, update, delete on public.transactions to authenticated;

-- ---------- Saldo devedor derivado (conferência / consultas) ------------
-- O app calcula o saldo a partir das transações; esta view serve para conferir no painel.
-- security_invoker = true => a view respeita o RLS de quem consulta.

create or replace view public.customer_balances
with (security_invoker = true) as
select
  c.id   as customer_id,
  c.user_id,
  c.name,
  coalesce(sum(
    case
      when t.type = 'SALE' and t.payment_method = 'FICHA' then t.amount_cents
      when t.type = 'PAYMENT' then -t.amount_cents
      else 0
    end
  ), 0) as balance_cents
from public.customers c
left join public.transactions t
  on t.customer_id = c.id and t.deleted_at is null
where c.deleted_at is null
group by c.id, c.user_id, c.name;

grant select on public.customer_balances to authenticated;
