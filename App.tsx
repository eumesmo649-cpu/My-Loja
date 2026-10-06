import { useRoute } from '@/hooks/useRoute'
import { useStore } from '@/store/StoreContext'
import { AppShell } from '@/components/layout/AppShell'
import { Button } from '@/components/ui/Button'
import { ErrorState } from '@/components/ui/EmptyState'
import { HomePage } from '@/pages/HomePage'
import { HistoryPage } from '@/pages/HistoryPage'
import { ReportsPage } from '@/pages/ReportsPage'
import { CustomersPage } from '@/pages/CustomersPage'
import { CustomerDetailPage } from '@/pages/CustomerDetailPage'
import { ClosingPage } from '@/pages/ClosingPage'
import { SettingsPage } from '@/pages/SettingsPage'

function Routes() {
  const route = useRoute()
  switch (route.name) {
    case 'history':
      return <HistoryPage />
    case 'reports':
      return <ReportsPage />
    case 'customers':
      return <CustomersPage />
    case 'customer':
      return <CustomerDetailPage id={route.id} />
    case 'closing':
      return <ClosingPage />
    case 'settings':
      return <SettingsPage />
    default:
      return <HomePage />
  }
}

export default function App() {
  const { status, loadError, retryLoad, startFresh } = useStore()

  if (status === 'loading') {
    return (
      <div className="grid min-h-dvh place-items-center text-2xl font-extrabold text-brand-600" role="status" aria-label="Carregando">
        MyLoja
      </div>
    )
  }

  if (status === 'error') {
    return (
      <div className="mx-auto grid min-h-dvh max-w-md place-items-center px-4">
        <ErrorState
          title="Não foi possível abrir os dados"
          description={loadError?.message}
          action={
            <div className="flex flex-col gap-2">
              <Button onClick={retryLoad}>Tentar de novo</Button>
              {loadError?.kind === 'corrupt' && (
                <Button variant="secondary" onClick={startFresh}>
                  Começar do zero (a cópia guardada é mantida)
                </Button>
              )}
            </div>
          }
        />
      </div>
    )
  }

  return (
    <AppShell>
      <Routes />
    </AppShell>
  )
}
