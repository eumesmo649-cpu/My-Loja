-- =====================================================================
-- MyLoja — migração 001: despesas (novo tipo de lançamento)
-- Rode UMA vez em Supabase > SQL Editor SE você já tinha rodado o schema.sql
-- antes desta versão. Quem está começando agora usa só o schema.sql (já inclui isto).
-- =====================================================================

alter table public.transactions drop constraint if exists transactions_type_check;
alter table public.transactions
  add constraint transactions_type_check check (type in ('SALE', 'PAYMENT', 'PURCHASE', 'EXPENSE'));

alter table public.transactions drop constraint if exists expense_not_ficha;
alter table public.transactions
  add constraint expense_not_ficha
  check (type <> 'EXPENSE' or (payment_method <> 'FICHA' and customer_id is null));

alter table public.transactions drop constraint if exists expense_needs_description;
alter table public.transactions
  add constraint expense_needs_description
  check (type <> 'EXPENSE' or char_length(btrim(coalesce(note, ''))) > 0);
