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
import { clearLockConfig } from '@/data/lockStorage'
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
import {
  applySettingsResult,
  clearPurged,
  clearPushed,
  friendlySyncError,
  markAllPending,
  mergeRemote,
  pullChanges,
  pushPending,
  pushPurge,
  settingsHaveContent,
  syncSettings,
} from '@/data/sync'
import { balancesByCustomer, totalReceivable } from '@/domain/balances'
import { sortNewestFirst } from '@/domain/summary'

export type SyncStatus = 'off' | 'signedOut' | 'idle' | 'syncing' | 'offline' | 'error'

export interface SyncState {
  configured: boolean
  status: SyncStatus
  email: string | null
  userId: string | null
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
  /** Itens excluídos (lixeira), do mais recente para o mais antigo. */
  trash: { transactions: Transaction[]; customers: Customer[] }

  addTransaction: (input: TransactionInput) => Transaction
  editTransaction: (id: string, patch: repo.TransactionPatch) => Transaction
  removeTransaction: (id: string) => void
  restoreTransaction: (id: string) => void
  createCustomer: (input: { name: string; phone?: string }) => Customer
  editCustomer: (id: string, input: { name: string; phone?: string }) => Customer
  removeCustomer: (id: string) => void
  restoreCustomer: (id: string) => void
  /** Define (ou, com null, remove) o percentual de lucro estimado de um mês ('2026-10'), em centésimos de % */
  setProfitMargin: (monthKey: string, bp: number | null) => void
  setOwnerName: (name: string) => void
  /** Nome e logo da loja (logo = data URL já reduzida; null remove). */
  setStoreProfile: (patch: { storeName?: string; logoDataUrl?: string | null }) => void
  /** Apaga de vez (lixeira). Clientes com lançamentos continuam na lixeira. */
  purgeTransaction: (id: string) => void
  purgeCustomer: (id: string) => void
  emptyTrash: () => void
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
  /** Sai da conta e apaga os dados deste aparelho. Sem `force`, recusa (erro 'UNSYNCED') se algo não foi enviado. */
  signOut: (opts?: { force?: boolean }) => Promise<void>
  /** Confere a senha da conta atual (usado para recuperar o acesso quando o PIN é esquecido). */
  verifyPassword: (password: string) => Promise<boolean>
  /** Exclui a conta e TODOS os dados na nuvem e neste aparelho. */
  deleteAccount: () => Promise<void>
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
    userId: null,
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
  const trash = useMemo(() => repo.trashContents(data), [data])

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

  const editCustomer = useCallback(
    (id: string, input: { name: string; phone?: string }) => {
      const { data: next, customer } = repo.updateCustomer(dataRef.current, id, input)
      commit(() => next)
      return customer
    },
    [commit],
  )

  const removeCustomer = useCallback((id: string) => {
    const next = repo.deleteCustomer(dataRef.current, id)
    commit(() => next)
  }, [commit])

  const restoreCustomer = useCallback((id: string) => {
    const next = repo.restoreCustomer(dataRef.current, id)
    commit(() => next)
  }, [commit])

  const setProfitMargin = useCallback(
    (monthKey: string, bp: number | null) =>
      commit((d) => {
        const margins = { ...d.settings.profitMarginBp }
        if (bp === null) delete margins[monthKey]
        else margins[monthKey] = bp
        return repo.updateSyncedSettings(d, { profitMarginBp: margins })
      }),
    [commit],
  )

  const setOwnerName = useCallback(
    (name: string) => commit((d) => repo.updateSyncedSettings(d, { ownerName: name.trim().slice(0, 40) })),
    [commit],
  )

  const setStoreProfile = useCallback(
    (patch: { storeName?: string; logoDataUrl?: string | null }) =>
      commit((d) =>
        repo.updateSyncedSettings(d, {
          ...(patch.storeName !== undefined ? { storeName: patch.storeName.trim().slice(0, 40) } : {}),
          ...(patch.logoDataUrl !== undefined ? { logoDataUrl: patch.logoDataUrl ?? undefined } : {}),
        }),
      ),
    [commit],
  )

  const purgeTransaction = useCallback((id: string) => commit((d) => repo.purgeTransactions(d, [id])), [commit])
  const purgeCustomer = useCallback((id: string) => commit((d) => repo.purgeCustomers(d, [id])), [commit])
  const emptyTrash = useCallback(
    () =>
      commit((d) => {
        const t = repo.trashContents(d)
        const afterTx = repo.purgeTransactions(d, t.transactions.map((x) => x.id))
        return repo.purgeCustomers(afterTx, t.customers.map((x) => x.id))
      }),
    [commit],
  )

  const closeDay = useCallback(
    (day: string, record: Omit<ClosingRecord, 'closedAt'>) =>
      commit((d) =>
        repo.updateSyncedSettings(d, {
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
        return repo.updateSyncedSettings(d, { closings })
      }),
    [commit],
  )

  const loadDemo = useCallback(() => commit((d) => withDemoData(d)), [commit])
  const clearDemo = useCallback(() => commit((d) => withoutDemoData(d)), [commit])
  const backupJson = useCallback(() => exportBackup(dataRef.current), [])

  const importBackup = useCallback(
    (json: string) => {
      const imported = parseBackup(json)
      // dados importados passam a pertencer à conta atual e sobem (inclusive as configurações)
      const now = new Date().toISOString()
      commit(() => ({
        ...imported,
        ownerUserId: userIdRef.current,
        settings: { ...imported.settings, updatedAt: now },
        pending: { ...imported.pending, settings: true },
      }))
    },
    [commit],
  )

  const eraseEverything = useCallback(() => {
    commit((d) => ({ ...emptyData(), ownerUserId: d.ownerUserId ?? null }))
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
  const userRef = useRef<string | null>(null) // e-mail (indica "logado")
  const userIdRef = useRef<string | null>(null)
  const inflightRef = useRef<Promise<void> | null>(null)
  const rerunRef = useRef(false)

  /** Exclui da lixeira o que passou de 30 dias (só mexe nos dados se houver algo a limpar). */
  const cleanExpiredTrash = useCallback(() => {
    const next = repo.purgeExpired(dataRef.current)
    if (next !== dataRef.current) commit(() => next)
  }, [commit])

  useEffect(() => {
    if (status === 'ready') cleanExpiredTrash()
  }, [status, cleanExpiredTrash])

  const doSync = useCallback(async () => {
    setSync((s) => ({ ...s, status: 'syncing', error: null }))
    try {
      const client = await getSupabase()
      const uid = userIdRef.current
      if (!uid) return
      const pushed = await pushPending(client, dataRef.current)
      commit((d) => clearPushed(d, pushed))
      const purge = dataRef.current.purge
      if (purge && purge.customers.length + purge.transactions.length > 0) {
        const done = await pushPurge(client, dataRef.current)
        commit((d) => clearPurged(d, done))
      }
      const settingsResult = await syncSettings(client, dataRef.current, uid)
      if (settingsResult.kind !== 'none') commit((d) => applySettingsResult(d, settingsResult))
      const remote = await pullChanges(client, dataRef.current.lastPullAt)
      commit((d) => mergeRemote(d, remote))
      cleanExpiredTrash()
      setSync((s) => ({ ...s, status: 'idle', lastSyncAt: new Date().toISOString(), error: null }))
    } catch (e) {
      const offline = !navigator.onLine || /conex|failed to fetch|network/i.test(String(e))
      setSync((s) => ({ ...s, status: offline ? 'offline' : 'error', error: friendlySyncError(e) }))
    }
  }, [commit, cleanExpiredTrash])

  const runSync = useCallback(
    function run(): Promise<void> {
      if (!isSupabaseConfigured || !userRef.current) return Promise.resolve()
      if (!navigator.onLine) {
        setSync((s) => ({ ...s, status: 'offline' }))
        return Promise.resolve()
      }
      if (inflightRef.current) {
        rerunRef.current = true
        return inflightRef.current
      }
      const p = doSync().finally(() => {
        inflightRef.current = null
        if (rerunRef.current) {
          rerunRef.current = false
          void run()
        }
      })
      inflightRef.current = p
      return p
    },
    [doSync],
  )

  /**
   * Garante que os dados deste aparelho pertencem à conta que entrou.
   * - mesma conta: segue.
   * - aparelho sem dono: adota (e o que já existe aqui sobe para a conta).
   * - outra conta: se não há nada pendente, limpa o aparelho (os dados antigos estão na nuvem);
   *   se há alterações não enviadas, recusa para não perder nem misturar dados.
   */
  const bindUser = useCallback(
    (userId: string): 'ok' | 'conflict' => {
      const d = dataRef.current
      if (d.ownerUserId === userId) return 'ok'
      if (d.ownerUserId) {
        const hasPending =
          d.pending.customers.length + d.pending.transactions.length > 0 ||
          (d.purge?.customers.length ?? 0) + (d.purge?.transactions.length ?? 0) > 0 ||
          d.pending.settings === true
        if (hasPending) return 'conflict'
        commit(() => ({ ...emptyData(), ownerUserId: userId }))
        return 'ok'
      }
      commit((cur) => {
        let next: AppData = { ...cur, ownerUserId: userId }
        if (!next.lastPullAt) next = markAllPending(next)
        // configurações antigas (anteriores à sincronização) passam a valer como as mais recentes deste aparelho
        if (!next.settings.updatedAt && settingsHaveContent(next.settings)) {
          next = { ...next, settings: { ...next.settings, updatedAt: new Date().toISOString() }, pending: { ...next.pending, settings: true } }
        }
        return next
      })
      return 'ok'
    },
    [commit],
  )

  const CONFLICT_MESSAGE =
    'Este aparelho ainda tem alterações de outra conta que não foram enviadas. Entre com a conta original para enviá-las, ou apague os dados deste aparelho (Ajustes → Zona de perigo).'

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
        const user = sessionData.session?.user
        const email = user?.email ?? null
        if (user && bindUser(user.id) === 'conflict') {
          await client.auth.signOut()
          setSync((s) => ({ ...s, email: null, userId: null, status: 'signedOut', error: CONFLICT_MESSAGE }))
          return
        }
        userRef.current = email
        userIdRef.current = user?.id ?? null
        setSync((s) => ({ ...s, email, userId: user?.id ?? null, status: email ? 'idle' : 'signedOut' }))
        if (email) void runSync()
        const { data: sub } = client.auth.onAuthStateChange((_event, session) => {
          const mail = session?.user.email ?? null
          userRef.current = mail
          userIdRef.current = session?.user.id ?? null
          setSync((s) => ({
            ...s,
            email: mail,
            userId: session?.user.id ?? null,
            status: mail ? (s.status === 'signedOut' ? 'idle' : s.status) : 'signedOut',
          }))
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
  }, [status, runSync, bindUser])

  // sobe pendentes pouco depois de qualquer alteração
  const hasPendingSettings = data.pending.settings === true
  const purgeCount = (data.purge?.customers.length ?? 0) + (data.purge?.transactions.length ?? 0)
  useEffect(() => {
    if (!sync.email || (pendingCount === 0 && !hasPendingSettings && purgeCount === 0)) return
    const t = window.setTimeout(() => void runSync(), 1500)
    return () => window.clearTimeout(t)
  }, [pendingCount, hasPendingSettings, purgeCount, sync.email, runSync])

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
    async (user: { id: string; email?: string | null }, fallbackEmail: string) => {
      if (bindUser(user.id) === 'conflict') {
        try {
          const client = await getSupabase()
          await client.auth.signOut()
        } catch {
          /* ignora */
        }
        throw new Error(CONFLICT_MESSAGE)
      }
      const email = user.email ?? fallbackEmail
      userRef.current = email
      userIdRef.current = user.id
      setSync((s) => ({ ...s, email, userId: user.id, status: 'idle', error: null }))
      void runSync()
    },
    [bindUser, runSync],
  )

  const signIn = useCallback(
    async (email: string, password: string) => {
      let user: { id: string; email?: string | null } | undefined
      try {
        const client = await getSupabase()
        const { data: res, error } = await client.auth.signInWithPassword({ email: email.trim(), password })
        if (error) throw new Error(error.message)
        user = res.user ?? undefined
        if (!user) throw new Error('Não foi possível entrar.')
      } catch (e) {
        throw new Error(friendlySyncError(e))
      }
      await afterAuth(user, email)
    },
    [afterAuth],
  )

  const signUp = useCallback(
    async (email: string, password: string) => {
      let result: { user?: { id: string; email?: string | null } | null; hasSession: boolean }
      try {
        const client = await getSupabase()
        const { data: res, error } = await client.auth.signUp({ email: email.trim(), password })
        if (error) throw new Error(error.message)
        result = { user: res.user, hasSession: Boolean(res.session) }
      } catch (e) {
        throw new Error(friendlySyncError(e))
      }
      if (result.hasSession && result.user) {
        await afterAuth(result.user, email)
        return { needsConfirmation: false }
      }
      return { needsConfirmation: true }
    },
    [afterAuth],
  )

  /** Apaga tudo que é desta conta neste aparelho (dados, bloqueio) e volta ao estado de "recém instalado". */
  const wipeDevice = useCallback(() => {
    userRef.current = null
    userIdRef.current = null
    clearLockConfig()
    window.dispatchEvent(new Event('myloja:wipe'))
    commit(() => emptyData())
    setSync((s) => ({ ...s, email: null, userId: null, status: 'signedOut', error: null, lastSyncAt: null }))
  }, [commit])

  const signOut = useCallback(
    async (opts?: { force?: boolean }) => {
      if (!opts?.force) {
        // tenta enviar o que falta antes de apagar os dados do aparelho
        await runSync()
        await runSync()
        const d = dataRef.current
        const left =
          d.pending.customers.length +
          d.pending.transactions.length +
          (d.purge?.customers.length ?? 0) +
          (d.purge?.transactions.length ?? 0) +
          (d.pending.settings ? 1 : 0)
        if (left > 0) throw new Error('UNSYNCED')
      }
      try {
        const client = await getSupabase()
        await client.auth.signOut()
      } catch {
        /* sem internet: a sessão local é descartada mesmo assim */
      } finally {
        wipeDevice()
      }
    },
    [runSync, wipeDevice],
  )

  const verifyPassword = useCallback(async (password: string) => {
    const email = userRef.current
    if (!email) return false
    try {
      const client = await getSupabase()
      const { error } = await client.auth.signInWithPassword({ email, password })
      return !error
    } catch {
      throw new Error('Sem conexão com a internet. Conecte-se para confirmar a senha.')
    }
  }, [])

  const deleteAccount = useCallback(async () => {
    try {
      const client = await getSupabase()
      const { error } = await client.rpc('delete_my_account')
      if (error) throw new Error(error.message)
      try {
        await client.auth.signOut()
      } catch {
        /* a conta já não existe mais */
      }
    } catch (e) {
      throw new Error(friendlySyncError(e))
    }
    wipeDevice()
  }, [wipeDevice])

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
      trash,
      addTransaction,
      editTransaction,
      removeTransaction,
      restoreTransaction,
      createCustomer,
      editCustomer,
      removeCustomer,
      restoreCustomer,
      setProfitMargin,
      setOwnerName,
      setStoreProfile,
      purgeTransaction,
      purgeCustomer,
      emptyTrash,
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
      verifyPassword,
      deleteAccount,
    }),
    [
      status, loadError, saveError, transactions, customers, data.settings, balances, receivableCents,
      pendingCount, hasDemo, trash, addTransaction, editTransaction, removeTransaction, restoreTransaction,
      createCustomer, editCustomer, removeCustomer, restoreCustomer, setProfitMargin, setOwnerName, setStoreProfile, purgeTransaction, purgeCustomer, emptyTrash, closeDay, reopenDay, loadDemo, clearDemo, backupJson, importBackup,
      eraseEverything, startFresh, load, sync, runSync, signIn, signUp, signOut, verifyPassword, deleteAccount,
    ],
  )

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>
}
