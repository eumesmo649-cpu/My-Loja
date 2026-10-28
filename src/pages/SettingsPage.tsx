import { useRef, useState } from 'react'
import { Cloud, Download, ShieldCheck, Smartphone, Sparkles, Trash2, Upload, UserX } from 'lucide-react'
import { useStore } from '@/store/StoreContext'
import { useUI } from '@/store/UIContext'
import { usePwaInstall } from '@/hooks/usePwaInstall'
import { formatDayFull, formatTime } from '@/lib/dates'
import { Button } from '@/components/ui/Button'
import { Card, SectionTitle } from '@/components/ui/Card'
import { TextField } from '@/components/ui/TextField'
import { PageHeader } from '@/components/layout/PageHeader'
import { StoreProfileCard } from '@/components/settings/StoreProfileCard'
import { LockCard } from '@/components/settings/LockCard'
import { downloadBackup } from '@/lib/backup'
import { getThemePref, setThemePref, type ThemePref } from '@/lib/theme'
import { Segmented } from '@/components/ui/Segmented'

export function SettingsPage() {
  const store = useStore()
  const { toast, confirm } = useUI()
  const pwa = usePwaInstall()
  const fileRef = useRef<HTMLInputElement>(null)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [authBusy, setAuthBusy] = useState(false)
  const [authError, setAuthError] = useState<string>()

  const download = () => {
    downloadBackup(store.backupJson())
    toast({ title: 'Cópia de segurança salva' })
  }

  const onImport = async (file: File | undefined) => {
    if (!file) return
    try {
      const text = await file.text()
      const ok = await confirm({
        title: 'Importar cópia de segurança?',
        message: 'Os dados atuais deste aparelho serão substituídos pelos do arquivo.',
        confirmLabel: 'Importar',
        tone: 'danger',
      })
      if (!ok) return
      store.importBackup(text)
      toast({ title: 'Dados importados' })
    } catch {
      toast({ kind: 'error', title: 'Arquivo inválido', description: 'Escolha uma cópia de segurança do MyLoja (.json).' })
    } finally {
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  const erase = async () => {
    const ok = await confirm({
      title: 'Apagar tudo neste aparelho?',
      message: 'Vendas, clientes e compras salvos aqui serão removidos. Faça uma cópia de segurança antes. Isso não pode ser desfeito.',
      confirmLabel: 'Apagar tudo',
      tone: 'danger',
    })
    if (!ok) return
    store.eraseEverything()
    toast({ kind: 'info', title: 'Dados apagados' })
  }

  const auth = async (mode: 'in' | 'up') => {
    setAuthError(undefined)
    if (!email.includes('@') || password.length < 6) {
      setAuthError('Informe um e-mail válido e uma senha com pelo menos 6 caracteres.')
      return
    }
    if (store.customers.length + store.transactions.length > 0) {
      const ok = await confirm({
        title: 'Enviar os dados deste aparelho?',
        message: 'Os dados que já existem aqui serão enviados para esta conta e ficarão ligados a ela.',
        confirmLabel: 'Continuar',
      })
      if (!ok) return
    }
    setAuthBusy(true)
    try {
      if (mode === 'in') await store.signIn(email, password)
      else {
        const r = await store.signUp(email, password)
        if (r.needsConfirmation) toast({ kind: 'info', title: 'Confirme seu e-mail', description: 'Enviamos um link. Depois, volte e toque em Entrar.' })
      }
      setPassword('')
    } catch (e) {
      setAuthError(e instanceof Error ? e.message : 'Não foi possível entrar.')
    } finally {
      setAuthBusy(false)
    }
  }

  const signOut = async () => {
    const ok = await confirm({
      title: 'Sair da conta?',
      message: 'Os dados serão apagados DESTE aparelho (continuam salvos na nuvem) e o bloqueio por PIN é removido. Entre de novo para recuperá-los.',
      confirmLabel: 'Sair',
      tone: 'danger',
    })
    if (!ok) return
    try {
      await store.signOut()
    } catch (e) {
      if (!(e instanceof Error) || e.message !== 'UNSYNCED') return toast({ kind: 'error', title: 'Não foi possível sair' })
      const force = await confirm({
        title: 'Há alterações sem enviar',
        message: 'Algumas alterações ainda não chegaram à nuvem (talvez sem internet). Se sair agora, elas serão perdidas. Baixe uma cópia antes, se quiser.',
        confirmLabel: 'Sair e perder',
        tone: 'danger',
      })
      if (force) await store.signOut({ force: true })
    }
  }

  const deleteAccount = async () => {
    const typed = window.prompt('Isto apaga sua conta e TODOS os dados na nuvem e neste aparelho, para sempre.\n\nPara confirmar, digite EXCLUIR:')
    if (typed?.trim().toUpperCase() !== 'EXCLUIR') return
    try {
      await store.deleteAccount()
      toast({ kind: 'info', title: 'Conta e dados excluídos' })
    } catch (e) {
      toast({ kind: 'error', title: e instanceof Error ? e.message : 'Não foi possível excluir a conta' })
    }
  }

  const [theme, setTheme] = useState<ThemePref>(getThemePref())

  const { sync } = store

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title="Ajustes" subtitle="Sua loja, bloqueio, cópia de segurança e nuvem" />

      <div className="flex flex-col gap-6">
        <StoreProfileCard />

        <LockCard />

        <Card className="p-5">
          <SectionTitle>Aparência</SectionTitle>
          <Segmented
            ariaLabel="Tema"
            variant="tabs"
            options={[{ value: 'system', label: 'Automático' }, { value: 'light', label: 'Claro' }, { value: 'dark', label: 'Escuro' }]}
            value={theme}
            onChange={(v) => { setTheme(v); setThemePref(v) }}
          />
          <p className="mt-3 text-sm text-muted">Automático segue o modo do seu celular. Vale só neste aparelho.</p>
        </Card>

        <Card className="p-5">
          <SectionTitle>Instalar no celular</SectionTitle>
          {pwa.installed ? (
            <p className="text-[15px] text-muted">O MyLoja já está instalado neste aparelho.</p>
          ) : pwa.canInstall ? (
            <>
              <p className="mb-4 text-[15px] text-muted">Instale para abrir direto da tela inicial, como um aplicativo.</p>
              <Button icon={<Smartphone className="h-5 w-5" aria-hidden />} onClick={() => void pwa.install()}>Instalar MyLoja</Button>
            </>
          ) : pwa.isIos ? (
            <p className="text-[15px] leading-relaxed text-muted">No iPhone: abra no Safari, toque em <strong>Compartilhar</strong> e depois em <strong>Adicionar à Tela de Início</strong>.</p>
          ) : (
            <p className="text-[15px] leading-relaxed text-muted">No Android (Chrome): menu <strong>⋮</strong> → <strong>Instalar app</strong> (ou <strong>Adicionar à tela inicial</strong>).</p>
          )}
        </Card>

        <Card className="p-5">
          <SectionTitle>Nuvem (Supabase)</SectionTitle>
          {!sync.configured ? (
            <p className="text-[15px] leading-relaxed text-muted">
              A sincronização está desligada. Os dados ficam salvos somente neste aparelho. Para ativar, configure as variáveis do Supabase (veja o README).
            </p>
          ) : sync.email ? (
            <div className="flex flex-col gap-3 text-[15px]">
              <p><span className="text-muted">Conta:</span> <strong>{sync.email}</strong></p>
              <p className="text-muted">
                {store.pendingCount > 0 ? `${store.pendingCount} alterações aguardando envio.` : 'Tudo enviado.'}
                {sync.lastSyncAt && ` Última sincronização: ${formatDayFull(sync.lastSyncAt)} ${formatTime(sync.lastSyncAt)}.`}
              </p>
              {sync.error && <p role="alert" className="font-medium text-danger-600">{sync.error}</p>}
              <div className="flex gap-2">
                <Button variant="secondary" size="sm" icon={<Cloud className="h-4 w-4" aria-hidden />} loading={sync.status === 'syncing'} onClick={() => void store.syncNow()}>Sincronizar agora</Button>
                <Button variant="ghost" size="sm" onClick={() => void signOut()}>Sair</Button>
              </div>
            </div>
          ) : (
            <form className="flex flex-col gap-3" onSubmit={(e) => { e.preventDefault(); void auth('in') }} noValidate>
              <p className="text-[15px] text-muted">Entre para guardar os dados na nuvem e usar em mais de um aparelho.</p>
              <TextField label="E-mail" type="email" autoComplete="email" value={email} onChange={setEmail} />
              <TextField label="Senha" type="password" autoComplete="current-password" value={password} onChange={setPassword} error={authError} />
              <div className="flex gap-2">
                <Button type="submit" loading={authBusy}>Entrar</Button>
                <Button variant="secondary" loading={authBusy} onClick={() => void auth('up')}>Criar conta</Button>
              </div>
            </form>
          )}
        </Card>

        <Card className="p-5">
          <SectionTitle>Cópia de segurança</SectionTitle>
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" icon={<Download className="h-5 w-5" aria-hidden />} onClick={download}>Baixar cópia</Button>
            <Button variant="secondary" icon={<Upload className="h-5 w-5" aria-hidden />} onClick={() => fileRef.current?.click()}>Importar cópia</Button>
            <input ref={fileRef} type="file" accept="application/json,.json" className="sr-only" aria-label="Arquivo de cópia de segurança" onChange={(e) => void onImport(e.target.files?.[0])} />
          </div>
        </Card>

        {/* Dados de exemplo: remova este bloco e src/data/seed.ts antes do uso real, se preferir. */}
        <Card className="p-5">
          <SectionTitle>Dados de exemplo</SectionTitle>
          <p className="mb-4 text-[15px] text-muted">
            Para testar o app com vendas, clientes e fichas fictícios. Os dados reais nunca são tocados ao remover os de exemplo.
          </p>
          {store.hasDemo ? (
            <Button
              variant="secondary"
              icon={<Trash2 className="h-5 w-5" aria-hidden />}
              onClick={async () => {
                const ok = await confirm({ title: 'Remover dados de exemplo?', message: 'Só os lançamentos fictícios serão removidos.', confirmLabel: 'Remover', tone: 'danger' })
                if (ok) { store.clearDemo(); toast({ title: 'Dados de exemplo removidos' }) }
              }}
            >
              Remover dados de exemplo
            </Button>
          ) : (
            <Button variant="secondary" icon={<Sparkles className="h-5 w-5" aria-hidden />} onClick={() => { store.loadDemo(); toast({ kind: 'info', title: 'Dados de exemplo carregados' }) }}>
              Carregar dados de exemplo
            </Button>
          )}
        </Card>

        <Card className="p-5">
          <SectionTitle>Mais</SectionTitle>
          <div className="flex flex-wrap gap-2">
            <a href="#/lixeira" className="inline-flex min-h-11 items-center gap-2 rounded-2xl bg-sand px-4 font-semibold"><Trash2 className="h-5 w-5" aria-hidden /> Lixeira</a>
            <a href="#/privacidade" className="inline-flex min-h-11 items-center gap-2 rounded-2xl bg-sand px-4 font-semibold"><ShieldCheck className="h-5 w-5" aria-hidden /> Aviso de privacidade</a>
          </div>
          <p className="mt-4 text-xs text-faint">MyLoja versão {__APP_VERSION__}</p>
        </Card>

        <Card className="border-danger-100 p-5">
          <SectionTitle>Zona de perigo</SectionTitle>
          <div className="flex flex-wrap gap-2">
            <Button variant="danger" icon={<Trash2 className="h-5 w-5" aria-hidden />} onClick={() => void erase()}>Apagar tudo deste aparelho</Button>
            {sync.email && (
              <Button variant="danger" icon={<UserX className="h-5 w-5" aria-hidden />} onClick={() => void deleteAccount()}>Excluir minha conta e meus dados</Button>
            )}
          </div>
        </Card>
      </div>
    </div>
  )
}
