import { Cloud, CloudOff, CloudUpload } from 'lucide-react'
import { useStore } from '@/store/StoreContext'
import { paths } from '@/hooks/useRoute'
import { cn } from '@/lib/cn'

/** Indicador discreto da sincronização (só aparece quando o Supabase está configurado e há login). */
export function SyncBadge() {
  const { sync, pendingCount } = useStore()
  if (!sync.configured || !sync.email) return null

  const state =
    sync.status === 'error' ? 'error' : sync.status === 'offline' ? 'offline' : sync.status === 'syncing' || pendingCount > 0 ? 'syncing' : 'ok'

  const config = {
    ok: { Icon: Cloud, text: 'Sincronizado', tone: 'text-sage-600' },
    syncing: { Icon: CloudUpload, text: pendingCount > 0 ? `${pendingCount} a enviar` : 'Sincronizando', tone: 'text-muted' },
    offline: { Icon: CloudOff, text: pendingCount > 0 ? `${pendingCount} aguardando internet` : 'Sem internet', tone: 'text-clay-600' },
    error: { Icon: CloudOff, text: 'Erro ao sincronizar', tone: 'text-danger-600' },
  }[state]

  return (
    <a
      href={paths.settings}
      className={cn('flex min-h-10 items-center gap-1.5 rounded-full px-2.5 text-[13px] font-semibold hover:bg-sand', config.tone)}
      aria-label={`Sincronização: ${config.text}`}
    >
      <config.Icon className="h-4 w-4" aria-hidden />
      <span className="hidden sm:inline">{config.text}</span>
    </a>
  )
}
