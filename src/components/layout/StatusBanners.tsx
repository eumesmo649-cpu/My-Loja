import { useEffect, useState } from 'react'
import { DatabaseBackup, RefreshCw, TriangleAlert, WifiOff } from 'lucide-react'
import { registerSW } from 'virtual:pwa-register'
import { useOnlineStatus } from '@/hooks/useMediaQuery'
import { useStore } from '@/store/StoreContext'
import { downloadBackup, shouldRemindBackup, snoozeBackupReminder } from '@/lib/backup'

/** Avisos globais discretos: sem internet, falha ao gravar, nova versão e lembrete de cópia de segurança. */
export function StatusBanners() {
  const online = useOnlineStatus()
  const { saveError, backupJson, transactions, status } = useStore()
  const [updateSW, setUpdateSW] = useState<((reload?: boolean) => Promise<void>) | null>(null)
  const [remind, setRemind] = useState(false)

  useEffect(() => {
    const fn = registerSW({
      onNeedRefresh: () => setUpdateSW(() => fn),
      onRegisteredSW: (_url, reg) => {
        // procura versão nova ao abrir e a cada hora com o app aberto
        if (reg) window.setInterval(() => void reg.update().catch(() => {}), 60 * 60 * 1000)
      },
    })
  }, [])

  const hasData = status === 'ready' && transactions.some((t) => !t.id.startsWith('00000000-0000-4000-8000-'))
  useEffect(() => {
    setRemind(shouldRemindBackup(hasData))
  }, [hasData])

  return (
    <>
      {updateSW && (
        <div role="status" className="flex items-center justify-between gap-3 bg-brand-50 px-4 py-2.5 text-[14px] font-medium text-brand-800">
          <span className="flex items-center gap-2.5"><RefreshCw className="h-4 w-4 shrink-0" aria-hidden /> Há uma versão nova do app.</span>
          <button type="button" className="min-h-9 rounded-lg px-3 font-bold underline" onClick={() => void updateSW(true)}>Atualizar</button>
        </div>
      )}
      {saveError && (
        <div role="alert" className="flex items-start gap-2.5 bg-danger-50 px-4 py-3 text-[14px] font-medium text-danger-700">
          <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <span>
            <strong>Atenção:</strong> {saveError}
          </span>
        </div>
      )}
      {remind && (
        <div role="status" className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 bg-clay-50 px-4 py-2.5 text-[14px] font-medium text-clay-700">
          <span className="flex items-center gap-2.5"><DatabaseBackup className="h-4 w-4 shrink-0" aria-hidden /> Faz mais de uma semana desde a última cópia de segurança.</span>
          <span className="flex gap-1">
            <button type="button" className="min-h-9 rounded-lg px-3 font-bold underline" onClick={() => { downloadBackup(backupJson()); setRemind(false) }}>Baixar agora</button>
            <button type="button" className="min-h-9 rounded-lg px-3" onClick={() => { snoozeBackupReminder(1); setRemind(false) }}>Depois</button>
          </span>
        </div>
      )}
      {!online && (
        <div role="status" className="flex items-center gap-2.5 bg-clay-50 px-4 py-2.5 text-[14px] font-medium text-clay-700">
          <WifiOff className="h-4 w-4 shrink-0" aria-hidden />
          Sem internet. Pode continuar registrando: tudo fica salvo no aparelho.
        </div>
      )}
    </>
  )
}
