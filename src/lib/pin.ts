/**
 * PIN do bloqueio: nunca é guardado. Guardamos só um hash PBKDF2-SHA256 com sal aleatório.
 * (É uma trava de uso contra quem pega o aparelho aberto; não criptografa os dados.)
 */

export const PIN_ITERATIONS = 150_000
export const PIN_LENGTHS = [4, 6] as const

const enc = new TextEncoder()

export function toBase64(bytes: Uint8Array): string {
  let bin = ''
  bytes.forEach((b) => (bin += String.fromCharCode(b)))
  return btoa(bin)
}

export function fromBase64(text: string): Uint8Array {
  const bin = atob(text)
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

export const isValidPin = (pin: string, length: number) => pin.length === length && /^\d+$/.test(pin)

async function derive(pin: string, salt: Uint8Array, iterations: number): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey('raw', enc.encode(pin), 'PBKDF2', false, ['deriveBits'])
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt: salt as BufferSource, iterations },
    key,
    256,
  )
  return new Uint8Array(bits)
}

export async function hashPin(pin: string): Promise<{ salt: string; hash: string; iterations: number; length: number }> {
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const hash = await derive(pin, salt, PIN_ITERATIONS)
  return { salt: toBase64(salt), hash: toBase64(hash), iterations: PIN_ITERATIONS, length: pin.length }
}

/** Compara em tempo constante. */
export async function verifyPin(pin: string, stored: { salt: string; hash: string; iterations: number }): Promise<boolean> {
  const got = await derive(pin, fromBase64(stored.salt), stored.iterations)
  const want = fromBase64(stored.hash)
  if (got.length !== want.length) return false
  let diff = 0
  for (let i = 0; i < got.length; i++) diff |= got[i] ^ want[i]
  return diff === 0
}

/** Espera depois de erros seguidos: 5 erros = 30 s, 10 = 1 min, 15 = 5 min, 20+ = 15 min. */
export function lockoutSeconds(fails: number): number {
  if (fails < 5) return 0
  if (fails < 10) return 30
  if (fails < 15) return 60
  if (fails < 20) return 300
  return 900
}
