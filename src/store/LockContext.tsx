import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import {
  clearLockConfig,
  defaultLockConfig,
  loadLockConfig,
  saveLockConfig,
  type LockConfig,
} from '@/data/lockStorage'
import { hashPin, isValidPin, lockoutSeconds, verifyPin } from '@/lib/pin'
import { registerBiometric, verifyBiometric } from '@/lib/biometric'

/** Bloqueio do app (PIN + biometria opcional). Tudo local: nada disso vai para a nuvem. */

export type UnlockResult =
  | { ok: true }
  | { ok: false; reason: 'wrong'; attemptsLeft: number }
  | { ok: false; reason: 'wait'; waitSec: number }

interface LockValue {
  enabled: boolean
  locked: boolean
  pinLength: number
  timeoutSec: number
  biometricEnabled: boolean
  /** segundos de espera restantes após muitos erros (0 = pode tentar) */
  waitSec: number
  setupPin: (pin: string) => Promise<void>
  changePin: (current: string, next: string) => Promise<boolean>
  /** Confere o PIN sem destravar (para desativar o bloqueio). */
  checkPin: (pin: string) => Promise<boolean>
  disable: () => void
  tryUnlock: (pin: string) => Promise<UnlockResult>
  unlockWithBiometric: () => Promise<boolean>
  lockNow: () => void
  setTimeoutSec: (sec: number) => void
  enableBiometric: (label: string) => Promise<void>
  disableBiometric: () => void
  /** Remove o bloqueio e destrava (depois de confirmar a senha da conta). */
  forceUnlock: () => void
}

const LockContext = createContext<LockValue | null>(null)

export function useLock(): LockValue {
  const ctx = useContext(LockContext)
  if (!ctx) throw new Error('useLock precisa estar dentro de <LockProvider>')
  return ctx
}

export const LOCK_TIMEOUTS: { value: string; label: string; sec: number }[] = [
  { value: '0', label: 'Ao sair do app', sec: 0 },
  { value: '60', label: '1 minuto', sec: 60 },
  { value: '300', label: '5 minutos', sec: 300 },
  { value: '900', label: '15 minutos', sec: 900 },
]

export function LockProvider({ children }: { children: ReactNode }) {
  const [config, setConfig] = useState<LockConfig>(() => loadLockConfig())
  const configRef = useRef(config)
  const [locked, setLocked] = useState<boolean>(() => loadLockConfig().enabled)
  const [now, setNow] = useState(() => Date.now())
  const hiddenAtRef = useRef<number | null>(null)

  const update = useCallback((patch: Partial<LockConfig>) => {
    const next = { ...configRef.current, ...patch }
    configRef.current = next
    setConfig(next)
    saveLockConfig(next)
  }, [])

  // Bloqueia ao sair do app / apagar a tela (conforme o tempo escolhido) e ao voltar depois desse tempo.
  useEffect(() => {
    const onChange = () => {
      const c = configRef.current
      if (!c.enabled) return
      if (document.visibilityState === 'hidden') {
        hiddenAtRef.current = Date.now()
        if (c.timeoutSec === 0) setLocked(true)
      } else if (hiddenAtRef.current !== null) {
        const away = Date.now() - hiddenAtRef.current
        hiddenAtRef.current = null
        if (away >= c.timeoutSec * 1000) setLocked(true)
      }
    }
    document.addEventListener('visibilitychange', onChange)
    window.addEventListener('pagehide', onChange)
    return () => {
      document.removeEventListener('visibilitychange', onChange)
      window.removeEventListener('pagehide', onChange)
    }
  }, [])

  // contagem regressiva da espera após muitos erros
  const waitSec = Math.max(0, Math.ceil((config.lockedUntil - now) / 1000))
  useEffect(() => {
    if (config.lockedUntil <= Date.now()) return
    const t = window.setInterval(() => setNow(Date.now()), 500)
    return () => window.clearInterval(t)
  }, [config.lockedUntil])

  const setupPin = useCallback(
    async (pin: string) => {
      if (!isValidPin(pin, pin.length) || ![4, 6].includes(pin.length)) throw new Error('Use um PIN de 4 ou 6 números.')
      const stored = await hashPin(pin)
      update({ enabled: true, pin: stored, fails: 0, lockedUntil: 0 })
      setLocked(false)
    },
    [update],
  )

  const checkPin = useCallback(async (pin: string) => {
    const c = configRef.current
    return Boolean(c.pin && (await verifyPin(pin, c.pin)))
  }, [])

  const changePin = useCallback(
    async (current: string, next: string) => {
      if (!(await checkPin(current))) return false
      update({ pin: await hashPin(next) })
      return true
    },
    [checkPin, update],
  )

  const disable = useCallback(() => {
    clearLockConfig()
    const fresh = defaultLockConfig()
    configRef.current = fresh
    setConfig(fresh)
    setLocked(false)
  }, [])

  const tryUnlock = useCallback(
    async (pin: string): Promise<UnlockResult> => {
      const c = configRef.current
      const left = Math.ceil((c.lockedUntil - Date.now()) / 1000)
      if (left > 0) return { ok: false, reason: 'wait', waitSec: left }
      if (c.pin && (await verifyPin(pin, c.pin))) {
        update({ fails: 0, lockedUntil: 0 })
        setLocked(false)
        return { ok: true }
      }
      const fails = c.fails + 1
      const wait = lockoutSeconds(fails)
      update({ fails, lockedUntil: wait > 0 ? Date.now() + wait * 1000 : 0 })
      setNow(Date.now())
      if (wait > 0) return { ok: false, reason: 'wait', waitSec: wait }
      return { ok: false, reason: 'wrong', attemptsLeft: 5 - (fails % 5) }
    },
    [update],
  )

  const unlockWithBiometric = useCallback(async () => {
    const id = configRef.current.biometric?.credentialId
    if (!id) return false
    const ok = await verifyBiometric(id)
    if (ok) {
      update({ fails: 0, lockedUntil: 0 })
      setLocked(false)
    }
    return ok
  }, [update])

  const lockNow = useCallback(() => {
    if (configRef.current.enabled) setLocked(true)
  }, [])

  const setTimeoutSec = useCallback((sec: number) => update({ timeoutSec: sec }), [update])

  const enableBiometric = useCallback(
    async (label: string) => {
      const credentialId = await registerBiometric(label)
      update({ biometric: { credentialId } })
    },
    [update],
  )
  const disableBiometric = useCallback(() => update({ biometric: undefined }), [update])

  // o aparelho foi limpo (sair da conta / excluir conta): remove o bloqueio também
  useEffect(() => {
    const onWipe = () => disable()
    window.addEventListener('myloja:wipe', onWipe)
    return () => window.removeEventListener('myloja:wipe', onWipe)
  }, [disable])

  const value = useMemo<LockValue>(
    () => ({
      enabled: config.enabled,
      locked: config.enabled && locked,
      pinLength: config.pin?.length ?? 4,
      timeoutSec: config.timeoutSec,
      biometricEnabled: Boolean(config.biometric),
      waitSec,
      setupPin,
      changePin,
      checkPin,
      disable,
      tryUnlock,
      unlockWithBiometric,
      lockNow,
      setTimeoutSec,
      enableBiometric,
      disableBiometric,
      forceUnlock: disable,
    }),
    [config, locked, waitSec, setupPin, changePin, checkPin, disable, tryUnlock, unlockWithBiometric, lockNow, setTimeoutSec, enableBiometric, disableBiometric],
  )

  return <LockContext.Provider value={value}>{children}</LockContext.Provider>
}
