import type { AppData, Customer, PaymentMethod, Transaction } from '@/types'
import { balancesByCustomer } from '@/domain/balances'

/**
 * DADOS DE DEMONSTRAÇÃO
 * ---------------------
 * Tudo que é gerado aqui usa IDs com o prefixo DEMO_PREFIX, o que permite remover
 * os dados de exemplo a qualquer momento (Configurações > Remover dados de exemplo)
 * sem tocar nos lançamentos reais. Registros demo NUNCA são enviados ao Supabase.
 *
 * Para eliminar o recurso do projeto, basta apagar este arquivo e o bloco
 * "Dados de exemplo" em src/pages/SettingsPage.tsx.
 */

export const DEMO_PREFIX = '00000000-0000-4000-8000-'

export const isDemoId = (id: string): boolean => id.startsWith(DEMO_PREFIX)

const demoId = (n: number): string => `${DEMO_PREFIX}${String(n).padStart(12, '0')}`

/** Gerador pseudo-aleatório determinístico (os dados de exemplo são sempre os mesmos). */
function rng(seed: number) {
  let s = seed >>> 0
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0
    return s / 0x100000000
  }
}

const CUSTOMER_NAMES: [string, string?][] = [
  ['Maria Souza', '(84) 99111-2233'],
  ['Ana Paula'],
  ['Carla Mendes', '(84) 98822-1100'],
  ['Juliana Lima'],
  ['Fernanda Alves', '(84) 99933-4455'],
  ['Patrícia Rocha'],
  ['Luciana Costa'],
  ['Beatriz Nunes', '(84) 98744-7788'],
]
const SUPPLIERS = ['Atacado Moda Center', 'Confecções Silva', 'Malhas do Nordeste', 'Brás Fashion']

const METHOD_WEIGHTS: [PaymentMethod, number][] = [
  ['PIX', 0.34],
  ['CASH', 0.14],
  ['DEBIT', 0.16],
  ['CREDIT', 0.16],
  ['FICHA', 0.2],
]

export function buildDemoData(now: Date = new Date()): Pick<AppData, 'customers' | 'transactions'> {
  const rand = rng(20261005)
  let counter = 1
  const nextId = () => demoId(counter++)

  const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
  const customers: Customer[] = CUSTOMER_NAMES.map(([name, phone], i) => {
    const iso = new Date(startToday - (150 - i) * 86400000).toISOString()
    return { id: nextId(), name, phone, createdAt: iso, updatedAt: iso, deletedAt: null }
  })

  const transactions: Transaction[] = []
  const push = (
    type: Transaction['type'],
    amountCents: number,
    paymentMethod: PaymentMethod,
    atMs: number,
    extra: Partial<Transaction> = {},
  ) => {
    const iso = new Date(atMs).toISOString()
    transactions.push({
      id: nextId(),
      type,
      amountCents,
      paymentMethod,
      createdAt: iso,
      updatedAt: iso,
      deletedAt: null,
      ...extra,
    })
  }

  const pickMethod = (): PaymentMethod => {
    let r = rand()
    for (const [m, w] of METHOD_WEIGHTS) {
      if (r < w) return m
      r -= w
    }
    return 'PIX'
  }
  const amount = (): number => {
    const reais = 25 + Math.floor(rand() * 60) * 5 // 25..320
    return rand() < 0.3 ? reais * 100 - 10 : reais * 100 // às vezes termina em ,90
  }
  const balances = new Map<string, number>()

  const DAYS = 150
  for (let back = DAYS; back >= 1; back--) {
    const day = new Date(startToday - back * 86400000)
    if (day.getDay() === 0) continue // domingo fechado
    const salesToday = 2 + Math.floor(rand() * 4)
    for (let i = 0; i < salesToday; i++) {
      const at = day.getTime() + (9 + Math.floor(rand() * 9)) * 3600000 + Math.floor(rand() * 60) * 60000
      const method = pickMethod()
      const cents = amount()
      if (method === 'FICHA') {
        const c = customers[Math.floor(rand() * customers.length)]
        balances.set(c.id, (balances.get(c.id) ?? 0) + cents)
        push('SALE', cents, 'FICHA', at, { customerId: c.id })
      } else {
        push('SALE', cents, method, at)
      }
    }
    // prestações: de vez em quando um cliente com saldo paga parte
    if (rand() < 0.28) {
      const owing = customers.filter((c) => (balances.get(c.id) ?? 0) > 0)
      if (owing.length) {
        const c = owing[Math.floor(rand() * owing.length)]
        const bal = balances.get(c.id) ?? 0
        const pay = rand() < 0.3 ? bal : Math.max(1000, Math.round((bal * (0.3 + rand() * 0.4)) / 500) * 500)
        const cents = Math.min(bal, pay)
        balances.set(c.id, bal - cents)
        const method = (['PIX', 'CASH', 'DEBIT'] as PaymentMethod[])[Math.floor(rand() * 3)]
        push('PAYMENT', cents, method, day.getTime() + 15 * 3600000 + Math.floor(rand() * 120) * 60000, {
          customerId: c.id,
        })
      }
    }
    // compras de reposição
    if (rand() < 0.11) {
      const cents = (300 + Math.floor(rand() * 25) * 50) * 100
      const method = (['PIX', 'CASH', 'CREDIT'] as PaymentMethod[])[Math.floor(rand() * 3)]
      push('PURCHASE', cents, method, day.getTime() + 8 * 3600000 + Math.floor(rand() * 60) * 60000, {
        supplier: SUPPLIERS[Math.floor(rand() * SUPPLIERS.length)],
        note: rand() < 0.4 ? 'Reposição de coleção' : undefined,
      })
    }
  }

  // Movimentações de HOJE (espalhadas entre 00:01 e agora, para o Início ter conteúdo)
  const elapsed = Math.max(now.getTime() - startToday, 3600000)
  const at = (f: number) => startToday + Math.floor(elapsed * f)
  push('SALE', 8000, 'PIX', at(0.12))
  push('SALE', 9800, 'CASH', at(0.28))
  push('SALE', 5000, 'DEBIT', at(0.42))
  push('SALE', 10000, 'CREDIT', at(0.57))
  const ficha = customers[0]
  push('SALE', 10000, 'FICHA', at(0.7), { customerId: ficha.id })
  balances.set(ficha.id, (balances.get(ficha.id) ?? 0) + 10000)
  push('SALE', 6500, 'PIX', at(0.82))
  const owing = [...balancesByCustomer(transactions).entries()].find(([id, b]) => b > 5000 && id !== ficha.id)
  if (owing) push('PAYMENT', 5000, 'PIX', at(0.9), { customerId: owing[0] })
  push('PURCHASE', 12000, 'CASH', at(0.2), { supplier: SUPPLIERS[0], note: 'Sacolas e etiquetas' })

  return { customers, transactions }
}

/** Mescla os dados de exemplo aos dados atuais (sem duplicar se já estiverem presentes). */
export function withDemoData(data: AppData, now: Date = new Date()): AppData {
  if (data.customers.some((c) => isDemoId(c.id))) return data
  const demo = buildDemoData(now)
  return {
    ...data,
    customers: [...data.customers, ...demo.customers],
    transactions: [...data.transactions, ...demo.transactions],
  }
}

/** Remove SOMENTE os dados de exemplo; lançamentos reais permanecem. */
export function withoutDemoData(data: AppData): AppData {
  return {
    ...data,
    customers: data.customers.filter((c) => !isDemoId(c.id)),
    transactions: data.transactions.filter((t) => !isDemoId(t.id) && !(t.customerId && isDemoId(t.customerId))),
    pending: {
      customers: data.pending.customers.filter((id) => !isDemoId(id)),
      transactions: data.pending.transactions.filter((id) => !isDemoId(id)),
    },
  }
}

export const hasDemoData = (data: AppData): boolean =>
  data.customers.some((c) => isDemoId(c.id)) || data.transactions.some((t) => isDemoId(t.id))
