import { useCallback, useEffect, useRef, useState } from 'react'
import { Delete, Fingerprint, LockKeyhole } from 'lucide-react'
import { useLock } from '@/store/LockContext'
import { useStore } from '@/store/StoreContext'
import { cn } from '@/lib/cn'
import { Button } from '@/components/ui/Button'
import { TextField } from '@/components/ui/TextField'
import { StoreMark } from '@/components/layout/Brand'

/** Tela de bloqueio: logo e nome da loja + teclado numérico (PIN) + biometria. */
export function LockScreen() {
  const lock = useLock()
  const { settings, sync, verifyPassword, eraseEverything } = useStore()
  const [digits, setDigits] = useState('')
  const [message, setMessage] = useState<string>()
  const [shake, setShake] = useState(false)
  const [busy, setBusy] = useState(false)
  const [mode, setMode] = useState<'pin' | 'forgot'>('pin')
  const busyRef = useRef(false)

  const len = lock.pinLength
  const storeName = settings.storeName || 'MyLoja'

  const reset = useCallback(() => {
    setDigits('')
    setMessage(undefined)
    setMode('pin')
  }, [])

  // ao bloquear de novo, volta ao teclado limpo
  useEffect(() => {
    if (lock.locked) reset()
  }, [lock.locked, reset])

  const submit = useCallback(
    async (pin: string) => {
      if (busyRef.current) return
      busyRef.current = true
      setBusy(true)
      try {
        const r = await lock.tryUnlock(pin)
        if (r.ok) return
        setShake(true)
        window.setTimeout(() => setShake(false), 400)
        setDigits('')
        setMessage(
          r.reason === 'wait'
            ? `Muitas tentativas. Aguarde ${r.waitSec} s.`
            : `PIN incorreto. ${r.attemptsLeft === 1 ? 'Resta 1 tentativa' : `Restam ${r.attemptsLeft} tentativas`} antes de uma pausa.`,
        )
      } finally {
        busyRef.current = false
        setBusy(false)
      }
    },
    [lock],
  )

  const press = useCallback(
    (d: string) => {
      if (busyRef.current || lock.waitSec > 0) return
      setMessage(undefined)
      setDigits((cur) => {
        if (cur.length >= len) return cur
        const next = cur + d
        if (next.length === len) void submit(next)
        return next
      })
    },
    [len, lock.waitSec, submit],
  )

  const back = useCallback(() => {
    if (busyRef.current) return
    setDigits((cur) => cur.slice(0, -1))
  }, [])

  const bio = useCallback(async () => {
    if (!lock.biometricEnabled) return
    const ok = await lock.unlockWithBiometric()
    if (!ok) setMessage('Não foi possível usar a biometria. Digite o PIN.')
  }, [lock])

  // teclado físico
  useEffect(() => {
    if (!lock.locked || mode !== 'pin') return
    const onKey = (e: KeyboardEvent) => {
      if (/^\d$/.test(e.key)) press(e.key)
      else if (e.key === 'Backspace') back()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [lock.locked, mode, press, back])

  // pede a biometria assim que a tela aparece (se estiver ativada)
  useEffect(() => {
    if (!lock.locked || !lock.biometricEnabled || mode !== 'pin') return
    const t = window.setTimeout(() => {
      if (document.visibilityState === 'visible') void lock.unlockWithBiometric()
    }, 350)
    return () => window.clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lock.locked])

  if (!lock.locked) return null

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="App bloqueado"
      className="fixed inset-0 z-[100] flex flex-col items-center overflow-y-auto bg-paper px-6"
      style={{ paddingTop: 'max(env(safe-area-inset-top), 24px)', paddingBottom: 'max(env(safe-area-inset-bottom), 24px)' }}
    >
      <div className="my-auto flex w-full max-w-xs flex-col items-center py-4">
        <StoreMark logo={settings.logoDataUrl} name={storeName} size="xl" />
        <h1 className="mt-4 max-w-full truncate text-2xl font-extrabold tracking-tight">{storeName}</h1>
        <p className="mt-1 text-[15px] text-muted">
          {mode === 'forgot' ? 'Recuperar acesso' : settings.ownerName ? `Olá, ${settings.ownerName}` : 'App bloqueado'}
        </p>

        {mode === 'pin' ? (
          <>
            <div
              className={cn('mt-7 flex h-6 items-center gap-3.5', shake && 'animate-shake')}
              role="status"
              aria-label={`${digits.length} de ${len} dígitos`}
            >
              {Array.from({ length: len }, (_, i) => (
                <span
                  key={i}
                  className={cn('h-3.5 w-3.5 rounded-full border-2 transition-colors', i < digits.length ? 'border-brand-600 bg-brand-600' : 'border-faint')}
                />
              ))}
            </div>
            <p role="alert" className="mt-3 min-h-10 text-center text-sm font-medium text-danger-600">
              {lock.waitSec > 0 ? `Muitas tentativas. Aguarde ${lock.waitSec} s.` : message}
            </p>

            <div className="mt-1 grid w-full grid-cols-3 gap-3">
              {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((d) => (
                <KeyButton key={d} onClick={() => press(d)} disabled={busy || lock.waitSec > 0}>
                  {d}
                </KeyButton>
              ))}
              {lock.biometricEnabled ? (
                <KeyButton onClick={() => void bio()} label="Usar biometria" subtle>
                  <Fingerprint className="h-7 w-7" aria-hidden />
                </KeyButton>
              ) : (
                <span aria-hidden />
              )}
              <KeyButton onClick={() => press('0')} disabled={busy || lock.waitSec > 0}>
                0
              </KeyButton>
              <KeyButton onClick={back} label="Apagar dígito" subtle>
                <Delete className="h-6 w-6" aria-hidden />
              </KeyButton>
            </div>

            <button
              type="button"
              onClick={() => {
                setMode('forgot')
                setMessage(undefined)
              }}
              className="mt-6 min-h-11 rounded-xl px-4 text-[15px] font-semibold text-brand-700 hover:bg-brand-50"
            >
              Esqueci meu PIN
            </button>
          </>
        ) : (
          <ForgotPin
            hasAccount={Boolean(sync.email)}
            email={sync.email}
            onBack={reset}
            verifyPassword={verifyPassword}
            onRecovered={() => lock.forceUnlock()}
            onErase={() => {
              eraseEverything()
              lock.forceUnlock()
            }}
          />
        )}
        <p className="mt-6 flex items-center gap-1.5 text-xs text-faint">
          <LockKeyhole className="h-3.5 w-3.5" aria-hidden /> Seus dados continuam salvos
        </p>
      </div>
    </div>
  )
}

function KeyButton({
  children,
  onClick,
  disabled,
  label,
  subtle,
}: {
  children: React.ReactNode
  onClick: () => void
  disabled?: boolean
  label?: string
  subtle?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className={cn(
        'grid h-[68px] place-items-center rounded-full text-[28px] font-semibold transition-colors active:scale-95 disabled:opacity-50',
        subtle ? 'text-muted hover:bg-sand' : 'bg-card text-ink shadow-card ring-1 ring-line hover:bg-sand active:bg-sand',
      )}
    >
      {children}
    </button>
  )
}

function ForgotPin({
  hasAccount,
  email,
  onBack,
  verifyPassword,
  onRecovered,
  onErase,
}: {
  hasAccount: boolean
  email: string | null
  onBack: () => void
  verifyPassword: (p: string) => Promise<boolean>
  onRecovered: () => void
  onErase: () => void
}) {
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string>()
  const [busy, setBusy] = useState(false)
  const [sure, setSure] = useState(false)

  const confirmPassword = async () => {
    setError(undefined)
    if (!password) {
      setError('Digite a senha da sua conta.')
      return
    }
    setBusy(true)
    try {
      if (await verifyPassword(password)) onRecovered()
      else setError('Senha incorreta.')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Não foi possível confirmar a senha.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mt-6 flex w-full flex-col gap-3">
      {hasAccount ? (
        <form
          className="flex flex-col gap-3"
          onSubmit={(e) => {
            e.preventDefault()
            void confirmPassword()
          }}
        >
          <p className="text-[15px] leading-relaxed text-muted">
            Confirme a senha da conta <strong className="break-all">{email}</strong>. O bloqueio será removido e você cria um novo PIN em Ajustes.
          </p>
          <TextField label="Senha da conta" type="password" autoComplete="current-password" value={password} onChange={setPassword} error={error} />
          <Button type="submit" size="lg" loading={busy}>
            Confirmar senha
          </Button>
        </form>
      ) : (
        <div className="flex flex-col gap-3">
          <p className="text-[15px] leading-relaxed text-muted">
            Sem conta na nuvem não existe como recuperar o PIN. Você pode apagar os dados deste aparelho e remover o bloqueio. Se tiver uma cópia de segurança, importe depois em Ajustes.
          </p>
          {sure ? (
            <>
              <p role="alert" className="text-sm font-semibold text-danger-600">Isso apaga vendas, clientes e compras salvos neste aparelho. Não pode ser desfeito.</p>
              <Button variant="danger" size="lg" onClick={onErase}>Apagar tudo e remover bloqueio</Button>
              <Button variant="ghost" onClick={() => setSure(false)}>Cancelar</Button>
            </>
          ) : (
            <Button variant="secondary" size="lg" onClick={() => setSure(true)}>Apagar dados deste aparelho</Button>
          )}
        </div>
      )}
      <Button variant="ghost" onClick={onBack}>
        Voltar ao teclado
      </Button>
    </div>
  )
}
