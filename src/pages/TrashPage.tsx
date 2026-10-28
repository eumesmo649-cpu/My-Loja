import { ArchiveRestore, Trash2, UserRound } from 'lucide-react'
import { useStore } from '@/store/StoreContext'
import { useUI } from '@/store/UIContext'
import { TRASH_DAYS } from '@/data/repository'
import { formatBRL } from '@/lib/money'
import { formatDayShort } from '@/lib/dates'
import { TYPE_LABEL } from '@/domain/methods'
import { Button } from '@/components/ui/Button'
import { Card, SectionTitle } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/EmptyState'
import { PageHeader } from '@/components/layout/PageHeader'
import { TYPE_ICON, transactionSubtitle } from '@/components/TransactionItem'

function daysLeft(deletedAt?: string | null): number {
  if (!deletedAt) return TRASH_DAYS
  const left = TRASH_DAYS - Math.floor((Date.now() - new Date(deletedAt).getTime()) / 86400000)
  return Math.max(0, left)
}
const leftLabel = (n: number) => (n <= 0 ? 'some hoje' : n === 1 ? 'some em 1 dia' : `some em ${n} dias`)

export function TrashPage() {
  const store = useStore()
  const { toast, confirm } = useUI()
  const { transactions, customers } = store.trash
  const empty = transactions.length + customers.length === 0
  const nameOf = (id?: string | null) => (id ? [...store.customers, ...customers].find((c) => c.id === id)?.name : undefined)

  const hasHistory = (id: string) => store.transactions.some((t) => t.customerId === id) || transactions.some((t) => t.customerId === id)

  const purgeTx = async (id: string) => {
    if (!(await confirm({ title: 'Apagar de vez?', message: 'Este lançamento será removido para sempre.', confirmLabel: 'Apagar de vez', tone: 'danger' }))) return
    store.purgeTransaction(id)
    toast({ title: 'Apagado de vez' })
  }
  const purgeCust = async (id: string) => {
    if (hasHistory(id)) {
      toast({ kind: 'info', title: 'Este cliente tem lançamentos', description: 'Apague primeiro os lançamentos dele (ou restaure o cliente).' })
      return
    }
    if (!(await confirm({ title: 'Apagar cliente de vez?', message: 'Ele será removido para sempre.', confirmLabel: 'Apagar de vez', tone: 'danger' }))) return
    store.purgeCustomer(id)
    toast({ title: 'Apagado de vez' })
  }
  const emptyAll = async () => {
    if (!(await confirm({ title: 'Esvaziar a lixeira?', message: 'Tudo o que está aqui será removido para sempre. Clientes que ainda têm lançamentos ativos continuam guardados.', confirmLabel: 'Esvaziar', tone: 'danger' }))) return
    store.emptyTrash()
    toast({ title: 'Lixeira esvaziada' })
  }

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader
        title="Lixeira"
        subtitle={`O que você exclui fica aqui por ${TRASH_DAYS} dias e depois some sozinho.`}
        action={!empty ? <Button variant="secondary" size="sm" icon={<Trash2 className="h-4 w-4" aria-hidden />} onClick={() => void emptyAll()}>Esvaziar</Button> : undefined}
      />

      {empty ? (
        <Card>
          <EmptyState icon={Trash2} title="Lixeira vazia" description="Vendas, compras, despesas e clientes excluídos aparecem aqui, e dá para restaurar." />
        </Card>
      ) : (
        <div className="flex flex-col gap-6">
          {transactions.length > 0 && (
            <section>
              <SectionTitle>Lançamentos</SectionTitle>
              <Card className="divide-y divide-line overflow-hidden">
                {transactions.map((tx) => {
                  const Icon = TYPE_ICON[tx.type]
                  return (
                    <div key={tx.id} className="flex flex-wrap items-center gap-3 px-4 py-3.5">
                      <Icon className="h-5 w-5 shrink-0 text-muted" aria-hidden />
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-semibold">{TYPE_LABEL[tx.type]} · {formatBRL(tx.amountCents)}</p>
                        <p className="truncate text-sm text-muted">
                          {transactionSubtitle(tx, nameOf(tx.customerId))} · {formatDayShort(tx.createdAt)}
                        </p>
                        <p className="text-xs text-faint">{leftLabel(daysLeft(tx.deletedAt))}</p>
                      </div>
                      <div className="flex gap-1.5">
                        <Button variant="secondary" size="sm" icon={<ArchiveRestore className="h-4 w-4" aria-hidden />} onClick={() => { store.restoreTransaction(tx.id); toast({ title: 'Restaurado' }) }}>Restaurar</Button>
                        <Button variant="ghost" size="sm" aria-label="Apagar de vez" onClick={() => void purgeTx(tx.id)}><Trash2 className="h-4 w-4" aria-hidden /></Button>
                      </div>
                    </div>
                  )
                })}
              </Card>
            </section>
          )}

          {customers.length > 0 && (
            <section>
              <SectionTitle>Clientes</SectionTitle>
              <Card className="divide-y divide-line overflow-hidden">
                {customers.map((c) => (
                  <div key={c.id} className="flex flex-wrap items-center gap-3 px-4 py-3.5">
                    <UserRound className="h-5 w-5 shrink-0 text-muted" aria-hidden />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold">{c.name}</p>
                      <p className="text-xs text-faint">{leftLabel(daysLeft(c.deletedAt))}</p>
                    </div>
                    <div className="flex gap-1.5">
                      <Button variant="secondary" size="sm" icon={<ArchiveRestore className="h-4 w-4" aria-hidden />} onClick={() => { try { store.restoreCustomer(c.id); toast({ title: 'Cliente restaurado' }) } catch (e) { toast({ kind: 'error', title: e instanceof Error ? e.message : 'Não foi possível restaurar' }) } }}>Restaurar</Button>
                      <Button variant="ghost" size="sm" aria-label="Apagar de vez" onClick={() => void purgeCust(c.id)}><Trash2 className="h-4 w-4" aria-hidden /></Button>
                    </div>
                  </div>
                ))}
              </Card>
            </section>
          )}
        </div>
      )}
    </div>
  )
}
