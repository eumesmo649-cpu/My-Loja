import { useRef, useState } from 'react'
import { Cloud, Download, Smartphone, Sparkles, Trash2, Upload } from 'lucide-react'
import { useStore } from '@/store/StoreContext'
import { useUI } from '@/store/UIContext'
import { usePwaInstall } from '@/hooks/usePwaInstall'
import { formatDayFull, formatTime } from '@/lib/dates'
import { Button } from '@/components/ui/Button'
import { Card, SectionTitle } from '@/components/ui/Card'
import { TextField } from '@/components/ui/TextField'
import { PageHeader } from '@/components/layout/PageHeader'

export function SettingsPage() {
  const store = useStore()
  const { toast, confirm } = useUI()
  const pwa = usePwaInstall()
  const fileRef = useRef<HTMLInputElement>(null)
  const [name, setName] = useState(store.settings.ownerName)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [authBusy, setAuthBusy] = useState(false)
  const [authError, setAuthError] = useState<string>()

  const saveName = () => {
    store.setOwnerName(name)
    toast({ title: 'Nome salvo' })
  }

  const download = () => {
    const blob = new Blob([store.backupJson()], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `myloja-backup-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
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

  const { sync } = store

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title="Ajustes" subtitle="Seu nome, instalação, cópia de segurança e nuvem" />

      <div className="flex flex-col gap-6">
        <Card className="p-5">
          <SectionTitle>Seu nome</SectionTitle>
          <TextField label="Como devemos te chamar?" value={name} onChange={setName} placeholder="Ex.: Maria" maxLength={40} />
          <Button className="mt-4" onClick={saveName}>Salvar</Button>
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
                <Button variant="ghost" size="sm" onClick={() => void store.signOut()}>Sair</Button>
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

        <Card className="border-danger-100 p-5">
          <SectionTitle>Zona de perigo</SectionTitle>
          <Button variant="danger" icon={<Trash2 className="h-5 w-5" aria-hidden />} onClick={() => void erase()}>Apagar tudo deste aparelho</Button>
        </Card>
      </div>
    </div>
  )
}
