/**
 * Configuração do bloqueio do app (PIN + biometria). Fica SÓ neste aparelho (localStorage) e nunca vai
 * para a nuvem. O PIN nunca é guardado: só um "hash" PBKDF2 com sal aleatório.
 */

const KEY = 'myloja:lock:v1'

export interface LockConfig {
  enabled: boolean
  pin?: { salt: string; hash: string; iterations: number; length: number }
  /** Segundos fora do app até bloquear de novo (0 = bloqueia assim que sair/apagar a tela). */
  timeoutSec: number
  biometric?: { credentialId: string }
  /** Tentativas erradas seguidas e até quando a tela fica travada (ms desde 1970). */
  fails: number
  lockedUntil: number
}

export const defaultLockConfig = (): LockConfig => ({ enabled: false, timeoutSec: 0, fails: 0, lockedUntil: 0 })

export function loadLockConfig(): LockConfig {
  try {
    const raw = window.localStorage.getItem(KEY)
    if (!raw) return defaultLockConfig()
    const p = JSON.parse(raw) as Partial<LockConfig>
    const pinOk = p.pin && typeof p.pin.salt === 'string' && typeof p.pin.hash === 'string'
    return {
      enabled: Boolean(p.enabled && pinOk),
      pin: pinOk ? p.pin : undefined,
      timeoutSec: typeof p.timeoutSec === 'number' && p.timeoutSec >= 0 ? p.timeoutSec : 0,
      biometric: p.biometric && typeof p.biometric.credentialId === 'string' ? p.biometric : undefined,
      fails: typeof p.fails === 'number' ? p.fails : 0,
      lockedUntil: typeof p.lockedUntil === 'number' ? p.lockedUntil : 0,
    }
  } catch {
    return defaultLockConfig()
  }
}

export function saveLockConfig(config: LockConfig): void {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(config))
  } catch {
    /* sem espaço: o bloqueio vale só nesta sessão */
  }
}

export function clearLockConfig(): void {
  try {
    window.localStorage.removeItem(KEY)
  } catch {
    /* ignora */
  }
}
