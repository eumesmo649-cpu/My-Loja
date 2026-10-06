import type { AppData, Customer, Settings, Transaction } from '@/types'

/**
 * Camada de persistência LOCAL (localStorage). É a fonte de verdade no aparelho:
 * toda venda é gravada aqui na hora, mesmo sem internet. A sincronização com o
 * Supabase (opcional) acontece depois, a partir da lista de "pendentes".
 */

const KEY = 'myloja:data:v1'

export class StorageError extends Error {
  constructor(
    message: string,
    public readonly kind: 'corrupt' | 'unavailable' | 'quota',
  ) {
    super(message)
    this.name = 'StorageError'
  }
}

export function defaultSettings(): Settings {
  return { ownerName: '', lastMethod: 'PIX', closings: {} }
}

export function emptyData(): AppData {
  return {
    version: 1,
    customers: [],
    transactions: [],
    settings: defaultSettings(),
    pending: { customers: [], transactions: [] },
    lastPullAt: null,
  }
}

/** Garante formato válido (com valores padrão) para dados lidos do disco ou de um backup. */
export function normalizeData(raw: unknown): AppData {
  if (!raw || typeof raw !== 'object') throw new Error('Formato inválido')
  const r = raw as Partial<AppData>
  if (!Array.isArray(r.customers) || !Array.isArray(r.transactions)) {
    throw new Error('Formato inválido')
  }
  const customers = (r.customers as Customer[]).filter((c) => c && typeof c.id === 'string' && typeof c.name === 'string')
  const transactions = (r.transactions as Transaction[]).filter(
    (t) =>
      t &&
      typeof t.id === 'string' &&
      (t.type === 'SALE' || t.type === 'PAYMENT' || t.type === 'PURCHASE') &&
      Number.isInteger(t.amountCents) &&
      t.amountCents > 0 &&
      typeof t.createdAt === 'string' &&
      !Number.isNaN(new Date(t.createdAt).getTime()),
  )
  return {
    version: 1,
    customers,
    transactions,
    settings: { ...defaultSettings(), ...(r.settings ?? {}) },
    pending: {
      customers: Array.isArray(r.pending?.customers) ? r.pending!.customers : [],
      transactions: Array.isArray(r.pending?.transactions) ? r.pending!.transactions : [],
    },
    lastPullAt: typeof r.lastPullAt === 'string' ? r.lastPullAt : null,
  }
}

function getStorage(): Storage {
  try {
    const s = window.localStorage
    const probe = '__myloja_probe__'
    s.setItem(probe, '1')
    s.removeItem(probe)
    return s
  } catch {
    throw new StorageError(
      'Não foi possível acessar o armazenamento do navegador. Verifique se está em uma aba anônima ou com o armazenamento bloqueado.',
      'unavailable',
    )
  }
}

export function loadData(): AppData {
  const storage = getStorage()
  const raw = storage.getItem(KEY)
  if (!raw) return emptyData()
  try {
    return normalizeData(JSON.parse(raw))
  } catch {
    // Guarda uma cópia do que existia antes de qualquer correção.
    try {
      storage.setItem(`${KEY}:corrupt:${Date.now()}`, raw)
    } catch {
      /* sem espaço: segue sem a cópia */
    }
    throw new StorageError(
      'Os dados salvos neste aparelho estão ilegíveis. Uma cópia de segurança foi guardada.',
      'corrupt',
    )
  }
}

export function saveData(data: AppData): void {
  const storage = getStorage()
  try {
    storage.setItem(KEY, JSON.stringify(data))
  } catch (e) {
    const quota = e instanceof DOMException && (e.name === 'QuotaExceededError' || e.code === 22)
    throw new StorageError(
      quota
        ? 'O aparelho está sem espaço para salvar. Libere espaço e tente novamente.'
        : 'Não foi possível salvar os dados neste aparelho.',
      quota ? 'quota' : 'unavailable',
    )
  }
}

export function resetStoredData(): void {
  getStorage().removeItem(KEY)
}

/** Pede ao navegador para não apagar os dados do app quando faltar espaço. */
export async function requestPersistentStorage(): Promise<void> {
  try {
    if (navigator.storage?.persist) await navigator.storage.persist()
  } catch {
    /* melhor esforço */
  }
}

export function exportBackup(data: AppData): string {
  const { customers, transactions, settings } = data
  return JSON.stringify(
    { app: 'MyLoja', exportedAt: new Date().toISOString(), version: 1, customers, transactions, settings },
    null,
    2,
  )
}

export function parseBackup(json: string): AppData {
  const parsed = JSON.parse(json)
  const data = normalizeData(parsed)
  // Dados importados precisam subir para a nuvem (se configurada).
  data.pending = {
    customers: data.customers.map((c) => c.id),
    transactions: data.transactions.map((t) => t.id),
  }
  data.lastPullAt = null
  return data
}
