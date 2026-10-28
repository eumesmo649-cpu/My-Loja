import { fromBase64, toBase64 } from './pin'

/**
 * Biometria (digital/rosto) pelo padrão WebAuthn do próprio aparelho.
 * É uma conveniência para destravar o app: a verificação acontece no aparelho, sem servidor.
 */

export async function isBiometricAvailable(): Promise<boolean> {
  try {
    if (!window.isSecureContext || typeof PublicKeyCredential === 'undefined') return false
    return await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable()
  } catch {
    return false
  }
}

const randomBytes = (n: number) => crypto.getRandomValues(new Uint8Array(n))

/** Cadastra a biometria do aparelho. Devolve o id da credencial (para pedir de novo depois). */
export async function registerBiometric(label: string): Promise<string> {
  const cred = (await navigator.credentials.create({
    publicKey: {
      challenge: randomBytes(32),
      rp: { name: 'MyLoja', id: window.location.hostname },
      user: { id: randomBytes(16), name: label || 'myloja', displayName: label || 'MyLoja' },
      pubKeyCredParams: [
        { type: 'public-key', alg: -7 },
        { type: 'public-key', alg: -257 },
      ],
      authenticatorSelection: { authenticatorAttachment: 'platform', userVerification: 'required', residentKey: 'discouraged' },
      timeout: 60_000,
      attestation: 'none',
    },
  })) as PublicKeyCredential | null
  if (!cred) throw new Error('Cadastro cancelado.')
  return toBase64(new Uint8Array(cred.rawId))
}

/** Pede a biometria. Devolve true se a pessoa confirmou. */
export async function verifyBiometric(credentialId: string): Promise<boolean> {
  try {
    const res = await navigator.credentials.get({
      publicKey: {
        challenge: randomBytes(32),
        rpId: window.location.hostname,
        allowCredentials: [{ type: 'public-key', id: fromBase64(credentialId) as BufferSource }],
        userVerification: 'required',
        timeout: 60_000,
      },
    })
    return Boolean(res)
  } catch {
    return false
  }
}
