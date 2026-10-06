import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import type { AppData, ClosingRecord, Customer, Transaction, TransactionInput } from '@/types'
import {
  emptyData,
  exportBackup,
  loadData,
  parseBackup,
  requestPersistentStorage,
  resetStoredData,
  saveData,
  StorageError,
} from '@/data/storage'
import * as repo from '@/data/repository'
import { hasDemoData, withDemoData, withoutDemoData } from '@/data/seed'
import { getSupabase, isSupabaseConfigured } from '@/data/supabase'
import { clearPushed, friendlySyncError, markAllPending, mergeRemote, pullChanges, pushPending } from '@/data/sync'
import { balancesByCustomer, totalReceivable } from '@/domain/balances'
import { sortNewestFirst } from '@/domain/summary'

export type SyncStatus = 'off' | 'signedOut' | 'idle' | 'syncing' | 'offline' | 'error'

export interface SyncState {
  configured: boolean
  status: SyncStatus
  email: string | null
  lastSyncAt: string | null
  error: string | null
}

interface StoreValue {
  status: 'loading' | 'ready' | 'error'
  loadError: StorageError | null
  /** Mensagem quando o aparelho não conseguiu gravar (ex.: sem espaço). */
  saveError: string | null

  /** Somente registros ativos (sem os excluídos), do mais novo ao mais antigo. */
  transactions: Transaction[]
  customers: Customer[]
  settings: AppData['settings']
  /** customerId -> saldo devedor em centavos */
  balances: Map<string, number>
  receivableCents: number
  pendingCount: number
  hasDemo: boolean

  addTransaction: (input: TransactionInput) => Transaction
  editTransaction: (id: string, patch: repo.TransactionPatch) => Transaction
  removeTransaction: (id: string) => void
  restoreTransaction: (id: string) => void
  createCustomer: (input: { name: string; phone?: string }) => Customer
  setOwnerName: (name: string) => void
  closeDay: (day: string, record: Omit<ClosingRecord, 'closedAt'>) => void
  reopenDay: (day: string) => void

  loadDemo: () => void
  clearDemo: () => void
  backupJson: () => string
  importBackup: (json: string) => void
  eraseEverything: () => void
  startFresh: () => void
  retryLoad: () => void

  sync: SyncState
  syncNow: () => Promise<void>
  signIn: (email: string, password: string) => Promise<void>
  signUp: (email: string, password: string) => Promise<{ needsConfirmation: boolean }>
  signOut: () => Promise<void>
}

const StoreContext = createContext<StoreValue | null>(null)

export function useStore(): StoreValue {
  const ctx = useContext(StoreContext)
  if (!ctx) throw new Error('useStore precisa estar dentro de <StoreProvider>')
  return ctx
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<AppData>(emptyData)
  const dataRef = useRef<AppData>(data)
  const [status, setStatus] = useState<StoreValue['status']>('loading')
  const [loadError, setLoadError] = useState<StorageError | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [sync, setSync] = useState<SyncState>({
    configured: isSupabaseConfigured,
    status: isSupabaseConfigured ? 'signedOut' : 'off',
    email: null,
    lastSyncAt: null,
    error: null,
  })

  /** Única porta de escrita: atualiza memória, tela e disco (nessa ordem). */
  const commit = useCallback((updater: (d: AppData) => AppData): AppData => {
    const next = updater(dataRef.current)
    dataRef.current = next
    setData(next)
    try {
      saveData(next)
      setSaveError(null)
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : 'Não foi possível salvar os dados.')
    }
    return next
  }, [])

  // ---------- carga inicial ----------
  const load = useCallback(() => {
    try {
      const loaded = loadData()
      dataRef.current = loaded
      setData(loaded)
      setLoadError(null)
      setStatus('ready')
      void requestPersistentStorage()
    } catch (e) {
      setLoadError(e instanceof StorageError ? e : new StorageError('Erro ao abrir os dados.', 'unavailable'))
      setStatus('error')
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  // ---------- derivados ----------
  const transactions = useMemo(() => sortNewestFirst(data.transactions.filter((t) => !t.deletedAt)), [data.transactions])
  const customers = useMemo(
    () => data.customers.filter((c) => !c.deletedAt).sort((a, b) => a.name.localeCompare(b.name, 'pt-BR')),
    [data.customers],
  )
  const balances = useMemo(() => balancesByCustomer(data.transactions), [data.transactions])
  const receivableCents = useMemo(() => totalReceivable(data.transactions), [data.transactions])
  const pendingCount = data.pending.customers.length + data.pending.transactions.length
  const hasDemo = useMemo(() => hasDemoData(data), [data])

  // ---------- ações ----------
  const addTransaction = useCallback(
    (input: TransactionInput) => {
      const { data: next, transaction } = repo.addTransaction(dataRef.current, input)
      commit(() => next)
      return transaction
    },
    [commit],
  )

  const editTransaction = useCallback(
    (id: string, patch: repo.TransactionPatch) => {
      const { data: next, transaction } = repo.updateTransaction(dataRef.current, id, patch)
      commit(() => next)
      return transaction
    },
    [commit],
  )

  const removeTransaction = useCallback((id: string) => commit((d) => repo.deleteTransaction(d, id)), [commit])
  const restoreTransaction = useCallback((id: string) => commit((d) => repo.restoreTransaction(d, id)), [commit])

  const createCustomer = useCallback(
    (input: { name: string; phone?: string }) => {
      const { data: next, customer } = repo.addCustomer(dataRef.current, input)
      commit(() => next)
      return customer
    },
    [commit],
  )

  const setOwnerName = useCallback(
    (name: string) => commit((d) => repo.updateSettings(d, { ownerName: name.trim().slice(0, 40) })),
    [commit],
  )

  const closeDay = useCallback(
    (day: string, record: Omit<ClosingRecord, 'closedAt'>) =>
      commit((d) =>
        repo.updateSettings(d, {
          closings: { ...d.settings.closings, [day]: { ...record, closedAt: new Date().toISOString() } },
        }),
      ),
    [commit],
  )

  const reopenDay = useCallback(
    (day: string) =>
      commit((d) => {
        const closings = { ...d.settings.closings }
        delete closings[day]
        return repo.updateSettings(d, { closings })
      }),
    [commit],
  )

  const loadDemo = useCallback(() => commit((d) => withDemoData(d)), [commit])
  const clearDemo = useCallback(() => commit((d) => withoutDemoData(d)), [commit])
  const backupJson = useCallback(() => exportBackup(dataRef.current), [])

  const importBackup = useCallback(
    (json: string) => {
      const imported = parseBackup(json)
      commit(() => imported)
    },
    [commit],
  )

  const eraseEverything = useCallback(() => {
    commit(() => emptyData())
  }, [commit])

  const startFresh = useCallback(() => {
    try {
      resetStoredData()
    } catch {
      /* ignora */
    }
    dataRef.current = emptyData()
    setData(dataRef.current)
    setLoadError(null)
    setStatus('ready')
  }, [])

  // ---------- sincronização (opcional) ----------
  const userRef = useRef<string | null>(null)
  const syncingRef = useRef(false)
  const rerunRef = useRef(false)

  const runSync = useCallback(async () => {
    if (!isSupabaseConfigured || !userRef.current) return
    if (!navigator.onLine) {
      setSync((s) => ({ ...s, status: 'offline' }))
      return
    }
    if (syncingRef.current) {
      rerunRef.current = true
      return
    }
    syncingRef.current = true
    setSync((s) => ({ ...s, status: 'syncing', error: null }))
    try {
      const client = await getSupabase()
      const pushed = await pushPending(client, dataRef.current)
      commit((d) => clearPushed(d, pushed))
      const remote = await pullChanges(client, dataRef.current.lastPullAt)
      commit((d) => mergeRemote(d, remote))
      setSync((s) => ({ ...s, status: 'idle', lastSyncAt: new Date().toISOString(), error: null }))
    } catch (e) {
      const offline = !navigator.onLine || /conex|failed to fetch|network/i.test(String(e))
      setSync((s) => ({ ...s, status: offline ? 'offline' : 'error', error: friendlySyncError(e) }))
    } finally {
      syncingRef.current = false
      if (rerunRef.current) {
        rerunRef.current = false
        void runSync()
      }
    }
  }, [commit])

  // restaura sessão existente
  useEffect(() => {
    if (!isSupabaseConfigured || status !== 'ready') return
    let unsub: (() => void) | undefined
    let cancelled = false
    void (async () => {
      try {
        const client = await getSupabase()
        const { data: sessionData } = await client.auth.getSession()
        if (cancelled) return
        const email = sessionData.session?.user.email ?? null
        userRef.current = email
        setSync((s) => ({ ...s, email, status: email ? 'idle' : 'signedOut' }))
        if (email) void runSync()
        const { data: sub } = client.auth.onAuthStateChange((_event, session) => {
          const mail = session?.user.email ?? null
          userRef.current = mail
          setSync((s) => ({ ...s, email: mail, status: mail ? (s.status === 'signedOut' ? 'idle' : s.status) : 'signedOut' }))
        })
        unsub = () => sub.subscription.unsubscribe()
      } catch (e) {
        setSync((s) => ({ ...s, status: 'error', error: friendlySyncError(e) }))
      }
    })()
    return () => {
      cancelled = true
      unsub?.()
    }
  }, [status, runSync])

  // sobe pendentes pouco depois de qualquer alteração
  useEffect(() => {
    if (!sync.email || pendingCount === 0) return
    const t = window.setTimeout(() => void runSync(), 1500)
    return () => window.clearTimeout(t)
  }, [pendingCount, sync.email, runSync])

  // volta a sincronizar quando a internet volta ou o app reabre
  useEffect(() => {
    if (!isSupabaseConfigured) return
    const go = () => void runSync()
    const onVisible = () => document.visibilityState === 'visible' && go()
    window.addEventListener('online', go)
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      window.removeEventListener('online', go)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [runSync])

  const afterAuth = useCallback(
    (email: string) => {
      userRef.current = email
      setSync((s) => ({ ...s, email, status: 'idle', error: null }))
      // primeiro login neste aparelho: sobe tudo que já existe localmente
      commit((d) => (d.lastPullAt ? d : markAllPending(d)))
      void runSync()
    },
    [commit, runSync],
  )

  const signIn = useCallback(
    async (email: string, password: string) => {
      try {
        const client = await getSupabase()
        const { data: res, error } = await client.auth.signInWithPassword({ email: email.trim(), password })
        if (error) throw new Error(error.message)
        afterAuth(res.user?.email ?? email)
      } catch (e) {
        throw new Error(friendlySyncError(e))
      }
    },
    [afterAuth],
  )

  const signUp = useCallback(
    async (email: string, password: string) => {
      try {
        const client = await getSupabase()
        const { data: res, error } = await client.auth.signUp({ email: email.trim(), password })
        if (error) throw new Error(error.message)
        if (res.session) {
          afterAuth(res.user?.email ?? email)
          return { needsConfirmation: false }
        }
        return { needsConfirmation: true }
      } catch (e) {
        throw new Error(friendlySyncError(e))
      }
    },
    [afterAuth],
  )

  const signOut = useCallback(async () => {
    try {
      const client = await getSupabase()
      await client.auth.signOut()
    } finally {
      userRef.current = null
      setSync((s) => ({ ...s, email: null, status: 'signedOut', error: null }))
    }
  }, [])

  const value = useMemo<StoreValue>(
    () => ({
      status,
      loadError,
      saveError,
      transactions,
      customers,
      settings: data.settings,
      balances,
      receivableCents,
      pendingCount,
      hasDemo,
      addTransaction,
      editTransaction,
      removeTransaction,
      restoreTransaction,
      createCustomer,
      setOwnerName,
      closeDay,
      reopenDay,
      loadDemo,
      clearDemo,
      backupJson,
      importBackup,
      eraseEverything,
      startFresh,
      retryLoad: load,
      sync,
      syncNow: runSync,
      signIn,
      signUp,
      signOut,
    }),
    [
      status, loadError, saveError, transactions, customers, data.settings, balances, receivableCents,
      pendingCount, hasDemo, addTransaction, editTransaction, removeTransaction, restoreTransaction,
      createCustomer, setOwnerName, closeDay, reopenDay, loadDemo, clearDemo, backupJson, importBackup,
      eraseEverything, startFresh, load, sync, runSync, signIn, signUp, signOut,
    ],
  )

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>
}
