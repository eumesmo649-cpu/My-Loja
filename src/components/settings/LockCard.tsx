import { useEffect, useState } from 'react'
import { Fingerprint, Lock } from 'lucide-react'
import { LOCK_TIMEOUTS, useLock } from '@/store/LockContext'
import { useStore } from '@/store/StoreContext'
import { useUI } from '@/store/UIContext'
import { isBiometricAvailable } from '@/lib/biometric'
import { isValidPin } from '@/lib/pin'
import { Button } from '@/components/ui/Button'
import { Card, SectionTitle } from '@/components/ui/Card'
import { Segmented } from '@/components/ui/Segmented'
import { TextField } from '@/components/ui/TextField'

type Flow = 'idle' | 'create' | 'change' | 'disable'

const digitsOnly = (v: string) => v.replace(/\D/g, '').slice(0, 6)

export function LockCard() {
  const lock = useLock()
  const store = useStore()
  const { toast } = useUI()
  const [flow, setFlow] = useState<Flow>('idle')
  const [len, setLen] = useState<4 | 6>(4)
  const [current, setCurrent] = useState('')
  const [pin, setPin] = useState('')
  const [again, setAgain] = useState('')
  const [error, setError] = useState<string>()
  const [busy, setBusy] = useState(false)
  const [bioOk, setBioOk] = useState(false)

  useEffect(() => {
    void isBiometricAvailable().then(setBioOk)
  }, [])

  const close = () => {
    setFlow('idle')
    setCurrent('')
    setPin('')
    setAgain('')
    setError(undefined)
  }

  const submit = async () => {
    setError(undefined)
    setBusy(true)
    try {
      if (flow === 'disable') {
        if (!(await lock.checkPin(current))) return setError('PIN atual incorreto.')
        lock.disable()
        toast({ kind: 'info', title: 'Bloqueio desativado' })
        return close()
      }
      if (flow === 'change' && !(await lock.checkPin(current))) return setError('PIN atual incorreto.')
      if (flow === 'create' || flow === 'change') {
        if (!isValidPin(pin, len)) return setError(`O PIN deve ter ${len} números.`)
        if (pin !== again) return setError('Os dois PINs não são iguais.')
        if (flow === 'create') await lock.setupPin(pin)
        else if (!(await lock.changePin(current, pin))) return setError('PIN atual incorreto.')
        toast({ title: flow === 'create' ? 'Bloqueio ativado' : 'PIN alterado' })
        close()
      }
    } finally {
      setBusy(false)
    }
  }

  const toggleBio = async () => {
    try {
      if (lock.biometricEnabled) lock.disableBiometric()
      else await lock.enableBiometric(store.settings.storeName || 'MyLoja')
    } catch (e) {
      toast({ kind: 'error', title: e instanceof Error ? e.message : 'Não foi possível ativar a biometria' })
    }
  }

  const activeLen = len

  return (
    <Card className="p-5">
      <SectionTitle>Bloqueio do app</SectionTitle>
      {flow === 'idle' ? (
        lock.enabled ? (
          <div className="flex flex-col gap-4">
            <p className="text-[15px] text-muted">O app pede o PIN ao abrir e quando fica fora da tela.</p>
            <div>
              <p className="mb-2 text-sm font-semibold text-muted">Bloquear de novo</p>
              <Segmented
                ariaLabel="Quando bloquear"
                options={LOCK_TIMEOUTS.map((t) => ({ value: t.value, label: t.label }))}
                value={String(lock.timeoutSec)}
                onChange={(v) => lock.setTimeoutSec(Number(v))}
              />
            </div>
            {bioOk && (
              <Button variant="secondary" icon={<Fingerprint className="h-5 w-5" aria-hidden />} onClick={() => void toggleBio()}>
                {lock.biometricEnabled ? 'Desativar biometria' : 'Usar biometria'}
              </Button>
            )}
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" size="sm" icon={<Lock className="h-4 w-4" aria-hidden />} onClick={() => lock.lockNow()}>Bloquear agora</Button>
              <Button variant="ghost" size="sm" onClick={() => setFlow('change')}>Trocar PIN</Button>
              <Button variant="ghost" size="sm" onClick={() => setFlow('disable')}>Desativar</Button>
            </div>
          </div>
        ) : (
          <>
            <p className="mb-4 text-[15px] leading-relaxed text-muted">
              Crie um PIN para que ninguém abra suas vendas e clientes se pegar seu celular. Dificulta o acesso casual; não é criptografia, então mantenha o aparelho com senha também.
            </p>
            <Button icon={<Lock className="h-5 w-5" aria-hidden />} onClick={() => setFlow('create')}>Criar PIN</Button>
          </>
        )
      ) : (
        <form className="flex flex-col gap-3" onSubmit={(e) => { e.preventDefault(); void submit() }} noValidate>
          {(flow === 'create' || flow === 'change') && (
            <Segmented ariaLabel="Tamanho do PIN" variant="tabs" options={[{ value: '4', label: '4 dígitos' }, { value: '6', label: '6 dígitos' }]} value={String(len)} onChange={(v) => setLen(v === '6' ? 6 : 4)} />
          )}
          {(flow === 'change' || flow === 'disable') && (
            <TextField label="PIN atual" type="password" inputMode="numeric" autoComplete="off" value={current} onChange={(v) => setCurrent(digitsOnly(v))} />
          )}
          {flow !== 'disable' && (
            <>
              <TextField label={`Novo PIN (${activeLen} números)`} type="password" inputMode="numeric" autoComplete="off" value={pin} onChange={(v) => setPin(digitsOnly(v))} />
              <TextField label="Repita o PIN" type="password" inputMode="numeric" autoComplete="off" value={again} onChange={(v) => setAgain(digitsOnly(v))} />
            </>
          )}
          {error && <p role="alert" className="text-sm font-medium text-danger-600">{error}</p>}
          <div className="flex gap-2">
            <Button type="submit" loading={busy} variant={flow === 'disable' ? 'danger' : 'primary'}>{flow === 'disable' ? 'Desativar bloqueio' : 'Salvar PIN'}</Button>
            <Button variant="ghost" onClick={close}>Cancelar</Button>
          </div>
        </form>
      )}
    </Card>
  )
}
