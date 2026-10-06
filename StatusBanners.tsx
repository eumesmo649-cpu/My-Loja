import { TriangleAlert, WifiOff } from 'lucide-react'
import { useOnlineStatus } from '@/hooks/useMediaQuery'
import { useStore } from '@/store/StoreContext'

/** Avisos globais discretos: sem internet e falha ao gravar no aparelho. */
export function StatusBanners() {
  const online = useOnlineStatus()
  const { saveError } = useStore()
  return (
    <>
      {saveError && (
        <div role="alert" className="flex items-start gap-2.5 bg-danger-50 px-4 py-3 text-[14px] font-medium text-danger-700">
          <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <span>
            <strong>Atenção:</strong> {saveError}
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
