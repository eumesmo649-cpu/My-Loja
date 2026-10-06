import type { SupabaseClient } from '@supabase/supabase-js'
import type { AppData, Customer, PaymentMethod, Transaction, TransactionType } from '@/types'
import { isDemoId } from './seed'

/**
 * Sincronização local -> Supabase (opcional).
 *
 * Estratégia simples e segura para uma loja com 1 conta e poucos aparelhos:
 *  1. Tudo é gravado primeiro no aparelho (nunca se perde venda por falta de internet).
 *  2. Registros alterados ficam numa lista de "pendentes".
 *  3. Quando há internet e login, os pendentes sobem (upsert) e depois baixamos o que
 *     mudou na nuvem desde a última vez (cursor `synced_at`, definido pelo servidor).
 *  4. Conflito: vence a alteração com `updated_at` mais recente (por registro).
 * Exclusões são lógicas (`deleted_at`), então também sincronizam.
 */

interface CustomerRow {
  id: string
  name: string
  phone: string | null
  created_at: string
  updated_at: string
  deleted_at: string | null
  synced_at?: string
}

interface TransactionRow {
  id: string
  type: TransactionType
  amount_cents: number
  payment_method: PaymentMethod
  customer_id: string | null
  supplier: string | null
  note: string | null
  created_at: string
  updated_at: string
  deleted_at: string | null
  synced_at?: string
}

const customerToRow = (c: Customer): CustomerRow => ({
  id: c.id,
  name: c.name,
  phone: c.phone ?? null,
  created_at: c.createdAt,
  updated_at: c.updatedAt,
  deleted_at: c.deletedAt ?? null,
})

const customerFromRow = (r: CustomerRow): Customer => ({
  id: r.id,
  name: r.name,
  phone: r.phone ?? undefined,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
  deletedAt: r.deleted_at,
})

const transactionToRow = (t: Transaction): TransactionRow => ({
  id: t.id,
  type: t.type,
  amount_cents: t.amountCents,
  payment_method: t.paymentMethod,
  customer_id: t.customerId ?? null,
  supplier: t.supplier ?? null,
  note: t.note ?? null,
  created_at: t.createdAt,
  updated_at: t.updatedAt,
  deleted_at: t.deletedAt ?? null,
})

const transactionFromRow = (r: TransactionRow): Transaction => ({
  id: r.id,
  type: r.type,
  amountCents: Number(r.amount_cents),
  paymentMethod: r.payment_method,
  customerId: r.customer_id,
  supplier: r.supplier ?? undefined,
  note: r.note ?? undefined,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
  deletedAt: r.deleted_at,
})

const BATCH = 200

async function upsertInBatches<T extends { id: string }>(
  client: SupabaseClient,
  table: 'customers' | 'transactions',
  rows: T[],
) {
  for (let i = 0; i < rows.length; i += BATCH) {
    const { error } = await client.from(table).upsert(rows.slice(i, i + BATCH), { onConflict: 'id' })
    if (error) throw new Error(error.message)
  }
}

export interface PushResult {
  /** id -> updatedAt que foi enviado (para só limpar o "pendente" se nada mudou depois) */
  customers: Map<string, string>
  transactions: Map<string, string>
}

export async function pushPending(client: SupabaseClient, data: AppData): Promise<PushResult> {
  const pCustomers = new Set(data.pending.customers)
  const pTransactions = new Set(data.pending.transactions)

  const customers = data.customers.filter((c) => pCustomers.has(c.id) && !isDemoId(c.id))
  const transactions = data.transactions.filter(
    (t) => pTransactions.has(t.id) && !isDemoId(t.id) && !(t.customerId && isDemoId(t.customerId)),
  )

  // Clientes primeiro (chave estrangeira das movimentações).
  await upsertInBatches(client, 'customers', customers.map(customerToRow))
  await upsertInBatches(client, 'transactions', transactions.map(transactionToRow))

  return {
    customers: new Map(customers.map((c) => [c.id, c.updatedAt])),
    transactions: new Map(transactions.map((t) => [t.id, t.updatedAt])),
  }
}

export interface PullResult {
  customers: Customer[]
  transactions: Transaction[]
  cursor: string | null
}

const PAGE = 1000

export async function pullChanges(client: SupabaseClient, since: string | null): Promise<PullResult> {
  let cursor = since
  const customers: Customer[] = []
  const transactions: Transaction[] = []

  for (const table of ['customers', 'transactions'] as const) {
    let from = 0
    for (;;) {
      let q = client.from(table).select('*').order('synced_at', { ascending: true }).range(from, from + PAGE - 1)
      if (since) q = q.gt('synced_at', since)
      const { data, error } = await q
      if (error) throw new Error(error.message)
      const rows = (data ?? []) as (CustomerRow | TransactionRow)[]
      for (const r of rows) {
        if (r.synced_at && (!cursor || r.synced_at > cursor)) cursor = r.synced_at
        if (table === 'customers') customers.push(customerFromRow(r as CustomerRow))
        else transactions.push(transactionFromRow(r as TransactionRow))
      }
      if (rows.length < PAGE) break
      from += PAGE
    }
  }
  return { customers, transactions, cursor }
}

/** Mescla registros da nuvem: vence o `updatedAt` mais recente; registros novos entram direto. */
export function mergeRemote(data: AppData, remote: PullResult): AppData {
  const customers = new Map(data.customers.map((c) => [c.id, c]))
  for (const r of remote.customers) {
    const local = customers.get(r.id)
    if (!local || r.updatedAt > local.updatedAt) customers.set(r.id, r)
  }
  const transactions = new Map(data.transactions.map((t) => [t.id, t]))
  for (const r of remote.transactions) {
    const local = transactions.get(r.id)
    if (!local || r.updatedAt > local.updatedAt) transactions.set(r.id, r)
  }
  return {
    ...data,
    customers: [...customers.values()],
    transactions: [...transactions.values()],
    lastPullAt: remote.cursor ?? data.lastPullAt,
  }
}

/** Marca tudo (exceto demo) como pendente: usado no primeiro login, para subir o que já existe no aparelho. */
export function markAllPending(data: AppData): AppData {
  return {
    ...data,
    pending: {
      customers: data.customers.filter((c) => !isDemoId(c.id)).map((c) => c.id),
      transactions: data.transactions.filter((t) => !isDemoId(t.id)).map((t) => t.id),
    },
    lastPullAt: null,
  }
}

/** Remove da lista de pendentes apenas o que foi enviado e não mudou desde o envio. */
export function clearPushed(data: AppData, pushed: PushResult): AppData {
  const cByid = new Map(data.customers.map((c) => [c.id, c.updatedAt]))
  const tById = new Map(data.transactions.map((t) => [t.id, t.updatedAt]))
  return {
    ...data,
    pending: {
      customers: data.pending.customers.filter((id) => !(pushed.customers.get(id) && pushed.customers.get(id) === cByid.get(id))),
      transactions: data.pending.transactions.filter(
        (id) => !(pushed.transactions.get(id) && pushed.transactions.get(id) === tById.get(id)),
      ),
    },
  }
}

export function friendlySyncError(e: unknown): string {
  const msg = e instanceof Error ? e.message : String(e)
  if (/failed to fetch|network|load failed/i.test(msg)) return 'Sem conexão com a internet. Seus dados estão salvos no aparelho.'
  if (/invalid login/i.test(msg)) return 'E-mail ou senha incorretos.'
  if (/already registered/i.test(msg)) return 'Este e-mail já tem cadastro. Use "Entrar".'
  if (/password/i.test(msg) && /6/.test(msg)) return 'A senha precisa ter pelo menos 6 caracteres.'
  if (/email.*confirm|not confirmed/i.test(msg)) return 'Confirme seu e-mail (veja a caixa de entrada) e tente entrar de novo.'
  return msg
}
