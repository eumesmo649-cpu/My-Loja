import { describe, expect, it } from 'vitest'
import * as repo from './repository'
import { emptyData } from './storage'
import { hashPin, isValidPin, lockoutSeconds, verifyPin } from '@/lib/pin'

const DAY = 86400000

describe('lixeira', () => {
  const base = () => {
    let d = emptyData()
    const added = repo.addTransaction(d, { type: 'EXPENSE', amountCents: 1000, paymentMethod: 'CASH', note: 'sacolas' } as never)
    d = added.data
    return { d, id: added.transaction.id }
  }

  it('excluir manda para a lixeira e restaurar traz de volta', () => {
    const { d, id } = base()
    const del = repo.deleteTransaction(d, id)
    expect(repo.trashContents(del).transactions).toHaveLength(1)
    const back = repo.restoreTransaction(del, id)
    expect(repo.trashContents(back).transactions).toHaveLength(0)
  })

  it('apagar de vez remove e registra para a nuvem', () => {
    const { d, id } = base()
    const gone = repo.purgeTransactions(repo.deleteTransaction(d, id), [id])
    expect(gone.transactions).toHaveLength(0)
    expect(gone.purge?.transactions).toContain(id)
  })

  it('não apaga de vez o que não está na lixeira', () => {
    const { d, id } = base()
    expect(repo.purgeTransactions(d, [id]).transactions).toHaveLength(1)
  })

  it('limpa sozinho depois de 30 dias, e só o que passou do prazo', () => {
    const { d, id } = base()
    const t0 = new Date('2026-01-01T12:00:00Z')
    const del = repo.deleteTransaction(d, id, t0)
    expect(repo.purgeExpired(del, new Date(t0.getTime() + 29 * DAY)).transactions).toHaveLength(1)
    expect(repo.purgeExpired(del, new Date(t0.getTime() + 31 * DAY)).transactions).toHaveLength(0)
  })

  it('cliente com lançamentos não é apagado de vez', () => {
    let d = emptyData()
    const c = repo.addCustomer(d, { name: 'Maria Souza' })
    d = c.data
    d = repo.addTransaction(d, { type: 'SALE', amountCents: 5000, paymentMethod: 'FICHA', customerId: c.customer.id } as never).data
    d = repo.purgeCustomers({ ...d, customers: d.customers.map((x) => ({ ...x, deletedAt: new Date().toISOString() })) }, [c.customer.id])
    expect(d.customers).toHaveLength(1)
  })
})

describe('PIN', () => {
  it('valida tamanho e só números', () => {
    expect(isValidPin('1234', 4)).toBe(true)
    expect(isValidPin('12a4', 4)).toBe(false)
    expect(isValidPin('123', 4)).toBe(false)
  })
  it('hash confere o PIN certo e recusa o errado, sem guardar o PIN', async () => {
    const h = await hashPin('4821')
    expect(JSON.stringify(h)).not.toContain('4821')
    expect(await verifyPin('4821', h)).toBe(true)
    expect(await verifyPin('4822', h)).toBe(false)
  })
  it('espera cresce com os erros', () => {
    expect(lockoutSeconds(4)).toBe(0)
    expect(lockoutSeconds(5)).toBe(30)
    expect(lockoutSeconds(20)).toBe(900)
  })
})
