import { describe, expect, it } from 'vitest'
import type { Customer, PaymentMethod, Transaction, TransactionType } from '@/types'
import { centsToInputString, formatBRL, parseMoneyToCents } from '@/lib/money'
import {
  balancesByCustomer,
  customerBalance,
  customerLedger,
  newlyNegativeCustomers,
  totalReceivable,
} from './balances'
import { filterByDay, summarize } from './summary'
import { monthReport, yearReport } from './reports'
import { validateCustomerName, validateExpense, validatePayment, validateSale } from './validation'
import { bpToInput, estimatedProfitCents, formatPercent, lastMarginBefore, parsePercentToBp } from './profit'
import * as repo from '@/data/repository'
import { emptyData } from '@/data/storage'

let seq = 0
function tx(
  type: TransactionType,
  amountCents: number,
  paymentMethod: PaymentMethod,
  at: string,
  extra: Partial<Transaction> = {},
): Transaction {
  seq += 1
  return {
    id: `t${seq}`,
    type,
    amountCents,
    paymentMethod,
    createdAt: new Date(at).toISOString(),
    updatedAt: new Date(at).toISOString(),
    ...extra,
  }
}

describe('dinheiro', () => {
  it('formata em BRL pt-BR', () => {
    expect(formatBRL(3590)).toBe('R$ 35,90')
    expect(formatBRL(184000)).toBe('R$ 1.840,00')
    expect(formatBRL(0)).toBe('R$ 0,00')
  })

  it('converte texto digitado em centavos sem usar float', () => {
    expect(parseMoneyToCents('35')).toBe(3500)
    expect(parseMoneyToCents('35,9')).toBe(3590)
    expect(parseMoneyToCents('35,90')).toBe(3590)
    expect(parseMoneyToCents('35.90')).toBe(3590)
    expect(parseMoneyToCents('1.250,50')).toBe(125050)
    expect(parseMoneyToCents('1.500')).toBe(150000)
    expect(parseMoneyToCents('R$ 12,5')).toBe(1250)
    expect(parseMoneyToCents('0,10')).toBe(10)
    expect(parseMoneyToCents('19,99')).toBe(1999) // 19.99 * 100 em float dá 1998.9999
    expect(parseMoneyToCents('')).toBe(0)
    expect(parseMoneyToCents('abc')).toBeNull()
    expect(parseMoneyToCents('1,234,5')).toBeNull()
    expect(parseMoneyToCents('3,456')).toBeNull()
  })

  it('volta centavos para texto editável', () => {
    expect(centsToInputString(3500)).toBe('35')
    expect(centsToInputString(3590)).toBe('35,90')
    expect(centsToInputString(5)).toBe('0,05')
  })
})

describe('regra fundamental: faturamento x recebido', () => {
  it('venda à vista conta em vendas e em recebido', () => {
    const s = summarize([tx('SALE', 10000, 'PIX', '2026-10-05T10:00:00')])
    expect(s.salesCents).toBe(10000)
    expect(s.receivedCents).toBe(10000)
    expect(s.salesByMethod.PIX).toBe(10000)
    expect(totalReceivable([tx('SALE', 10000, 'PIX', '2026-10-05T10:00:00')])).toBe(0)
  })

  it('venda na ficha conta em vendas e a receber, mas NÃO em recebido', () => {
    const list = [tx('SALE', 10000, 'FICHA', '2026-10-05T10:00:00', { customerId: 'maria' })]
    const s = summarize(list)
    expect(s.salesCents).toBe(10000)
    expect(s.fichaSalesCents).toBe(10000)
    expect(s.receivedCents).toBe(0)
    expect(totalReceivable(list)).toBe(10000)
    expect(customerBalance('maria', list)).toBe(10000)
  })

  it('reproduz o exemplo do dia: vendas 428, recebido 328, ficha 100', () => {
    const list = [
      tx('SALE', 8000, 'PIX', '2026-10-05T09:00:00'),
      tx('SALE', 9800, 'CASH', '2026-10-05T10:00:00'),
      tx('SALE', 5000, 'DEBIT', '2026-10-05T11:00:00'),
      tx('SALE', 10000, 'CREDIT', '2026-10-05T12:00:00'),
      tx('SALE', 10000, 'FICHA', '2026-10-05T13:00:00', { customerId: 'ana' }),
    ]
    const s = summarize(list)
    expect(s.salesCents).toBe(42800)
    expect(s.receivedCents).toBe(32800)
    expect(s.salesCount).toBe(5)
  })

  it('prestação aumenta o recebido, reduz o saldo e não é nova venda', () => {
    const list = [
      tx('SALE', 30000, 'FICHA', '2026-10-05T10:00:00', { customerId: 'maria' }),
      tx('PAYMENT', 5000, 'PIX', '2026-10-10T10:00:00', { customerId: 'maria' }),
    ]
    expect(customerBalance('maria', list)).toBe(25000)
    const s = summarize(list.slice(1))
    expect(s.salesCents).toBe(0)
    expect(s.receivedCents).toBe(5000)
    expect(s.paymentsCents).toBe(5000)
    expect(totalReceivable(list)).toBe(25000)
  })

  it('compra é saída e entra no líquido', () => {
    const s = summarize([
      tx('SALE', 10000, 'PIX', '2026-10-05T10:00:00'),
      tx('PURCHASE', 4000, 'CASH', '2026-10-05T11:00:00', { supplier: 'Atacado' }),
    ])
    expect(s.purchasesCents).toBe(4000)
    expect(s.netCents).toBe(6000)
  })

  it('lançamentos excluídos são ignorados em tudo', () => {
    const list = [
      tx('SALE', 30000, 'FICHA', '2026-10-05T10:00:00', { customerId: 'maria' }),
      tx('SALE', 7000, 'PIX', '2026-10-05T10:30:00', { deletedAt: '2026-10-05T11:00:00.000Z' }),
    ]
    expect(summarize(list).salesCents).toBe(30000)
    expect(totalReceivable(list)).toBe(30000)
  })
})

describe('saldos de clientes', () => {
  it('saldo negativo (pagou a mais) não reduz o total a receber dos outros', () => {
    const list = [
      tx('SALE', 10000, 'FICHA', '2026-10-01T10:00:00', { customerId: 'a' }),
      tx('SALE', 5000, 'FICHA', '2026-10-01T10:00:00', { customerId: 'b' }),
      tx('PAYMENT', 12000, 'PIX', '2026-10-02T10:00:00', { customerId: 'a' }),
    ]
    expect(balancesByCustomer(list).get('a')).toBe(-2000)
    expect(totalReceivable(list)).toBe(5000)
  })

  it('detecta saldo que ficaria negativo ao excluir uma venda com prestações', () => {
    const sale = tx('SALE', 30000, 'FICHA', '2026-10-05T10:00:00', { customerId: 'maria' })
    const pay = tx('PAYMENT', 5000, 'PIX', '2026-10-10T10:00:00', { customerId: 'maria' })
    const before = [sale, pay]
    const after = before.filter((t) => t.id !== sale.id)
    expect(newlyNegativeCustomers(before, after)).toEqual(['maria'])
    expect(newlyNegativeCustomers(before, before)).toEqual([])
  })

  it('extrato do cliente tem saldo corrente (exemplo Maria)', () => {
    const list = [
      tx('SALE', 30000, 'FICHA', '2026-10-05T10:00:00', { customerId: 'maria' }),
      tx('PAYMENT', 5000, 'PIX', '2026-10-10T10:00:00', { customerId: 'maria' }),
    ]
    const ledger = customerLedger('maria', list)
    expect(ledger.map((r) => r.balanceAfterCents)).toEqual([30000, 25000])
  })
})

describe('validações', () => {
  it('bloqueia valor vazio, zero, negativo e inválido', () => {
    expect(validateSale({ amountCents: 0, method: 'PIX' }).amount).toBeTruthy()
    expect(validateSale({ amountCents: -100, method: 'PIX' }).amount).toBeTruthy()
    expect(validateSale({ amountCents: null, method: 'PIX' }).amount).toBeTruthy()
    expect(validateSale({ amountCents: 3500, method: 'PIX' })).toEqual({})
  })

  it('ficha exige cliente', () => {
    expect(validateSale({ amountCents: 3500, method: 'FICHA' }).customer).toBeTruthy()
    expect(validateSale({ amountCents: 3500, method: 'FICHA', customerId: 'x' })).toEqual({})
  })

  it('prestação exige cliente e avisa quando passa do saldo', () => {
    expect(
      validatePayment({ amountCents: 1000, method: 'PIX', customerId: null, balanceCents: 5000 }).errors
        .customer,
    ).toBeTruthy()
    const ok = validatePayment({ amountCents: 5000, method: 'PIX', customerId: 'x', balanceCents: 5000 })
    expect(ok.errors).toEqual({})
    expect(ok.exceedsBalance).toBe(false)
    const over = validatePayment({ amountCents: 5001, method: 'PIX', customerId: 'x', balanceCents: 5000 })
    expect(over.errors).toEqual({})
    expect(over.exceedsBalance).toBe(true)
  })

  it('nome de cliente: obrigatório e sem duplicar (ignora acento e caixa)', () => {
    const customers: Customer[] = [
      { id: '1', name: 'Maria José', createdAt: '', updatedAt: '' },
    ]
    expect(validateCustomerName('', customers)).toBeTruthy()
    expect(validateCustomerName('maria jose', customers)).toBeTruthy()
    expect(validateCustomerName('Ana', customers)).toBeUndefined()
  })
})

describe('relatórios', () => {
  const list = [
    tx('SALE', 10000, 'PIX', '2026-09-10T10:00:00'),
    tx('SALE', 20000, 'FICHA', '2026-10-02T10:00:00', { customerId: 'maria' }),
    tx('SALE', 15000, 'CASH', '2026-10-03T10:00:00'),
    tx('PAYMENT', 5000, 'PIX', '2026-10-20T10:00:00', { customerId: 'maria' }),
    tx('PURCHASE', 8000, 'PIX', '2026-10-04T10:00:00'),
  ]

  it('relatório mensal separa vendido, recebido, ficha e a receber', () => {
    const r = monthReport(list, 2026, 9, new Date(2026, 10, 15))
    expect(r.salesCents).toBe(35000)
    expect(r.salesCount).toBe(2)
    expect(r.receivedCents).toBe(20000) // 15000 espécie + 5000 prestação
    expect(r.fichaSalesCents).toBe(20000)
    expect(r.fichaReceivedCents).toBe(5000)
    expect(r.purchasesCents).toBe(8000)
    expect(r.receivableCents).toBe(15000)
    expect(r.previous?.salesCents).toBe(10000)
    expect(Math.round(r.salesDeltaPct ?? 0)).toBe(250)
    expect(r.daily[1].salesCents).toBe(20000)
  })

  it('mês em andamento compara só o mesmo período do mês anterior', () => {
    const l = [
      tx('SALE', 10000, 'PIX', '2026-09-02T10:00:00'),
      tx('SALE', 90000, 'PIX', '2026-09-25T10:00:00'),
      tx('SALE', 20000, 'PIX', '2026-10-03T10:00:00'),
    ]
    const r = monthReport(l, 2026, 9, new Date(2026, 9, 6))
    expect(r.comparisonIsPartial).toBe(true)
    expect(r.previous?.salesCents).toBe(10000) // só até dia 6 de setembro
    expect(Math.round(r.salesDeltaPct ?? 0)).toBe(100)
  })

  it('sem mês anterior com vendas não há comparação', () => {
    const r = monthReport(list, 2026, 8)
    expect(r.previous).toBeNull()
    expect(r.salesDeltaPct).toBeNull()
  })

  it('a receber do mês é a fotografia do fim do mês', () => {
    // em setembro ainda não havia ficha
    expect(monthReport(list, 2026, 8).receivableCents).toBe(0)
  })

  it('relatório anual: totais, média, melhor e pior mês', () => {
    const r = yearReport(list, 2026, new Date(2026, 9, 5))
    expect(r.salesCents).toBe(45000)
    expect(r.best?.month0).toBe(9)
    expect(r.worst?.month0).toBe(8)
    expect(r.monthsConsidered).toBe(2) // setembro e outubro
    expect(r.averageMonthlySalesCents).toBe(22500)
    expect(r.receivableCents).toBe(15000)
  })

  it('filtra por dia local', () => {
    expect(filterByDay(list, '2026-10-03')).toHaveLength(1)
  })
})

describe('despesas', () => {
  it('despesa é saída própria: não é venda, não é recebido e reduz o saldo do dia', () => {
    const s = summarize([
      tx('SALE', 10000, 'PIX', '2026-10-05T10:00:00'),
      tx('PURCHASE', 3000, 'PIX', '2026-10-05T11:00:00'),
      tx('EXPENSE', 2000, 'CASH', '2026-10-05T12:00:00', { note: 'Energia' }),
    ])
    expect(s.salesCents).toBe(10000)
    expect(s.receivedCents).toBe(10000)
    expect(s.expensesCents).toBe(2000)
    expect(s.expensesCount).toBe(1)
    expect(s.purchasesCents).toBe(3000)
    expect(s.netCents).toBe(5000)
  })

  it('exige descrição, valor e forma de pagamento à vista', () => {
    expect(validateExpense({ amountCents: 5000, method: 'PIX', description: '' }).description).toBeTruthy()
    expect(validateExpense({ amountCents: 5000, method: 'PIX', description: '  ' }).description).toBeTruthy()
    expect(validateExpense({ amountCents: 0, method: 'PIX', description: 'Aluguel' }).amount).toBeTruthy()
    expect(validateExpense({ amountCents: 5000, method: 'FICHA', description: 'Aluguel' }).method).toBeTruthy()
    expect(validateExpense({ amountCents: 5000, method: 'PIX', description: 'Aluguel' })).toEqual({})
  })

  it('repositório guarda a descrição em note e recusa despesa sem descrição', () => {
    const data = emptyData()
    expect(() => repo.addTransaction(data, { type: 'EXPENSE', amountCents: 5000, paymentMethod: 'PIX' })).toThrow()
    expect(() =>
      repo.addTransaction(data, { type: 'EXPENSE', amountCents: 5000, paymentMethod: 'FICHA', note: 'Aluguel' }),
    ).toThrow()
    const { data: next, transaction } = repo.addTransaction(data, {
      type: 'EXPENSE',
      amountCents: 120000,
      paymentMethod: 'PIX',
      note: '  Aluguel de outubro ',
    })
    expect(transaction.note).toBe('Aluguel de outubro')
    expect(transaction.customerId).toBeNull()
    expect(next.pending.transactions).toContain(transaction.id)
    // editar para apagar a descrição também é recusado
    expect(() => repo.updateTransaction(next, transaction.id, { note: '   ' })).toThrow()
  })

  it('aparece nos relatórios mensal e anual', () => {
    const l = [
      tx('SALE', 100000, 'PIX', '2026-10-02T10:00:00'),
      tx('EXPENSE', 20000, 'PIX', '2026-10-03T10:00:00', { note: 'Aluguel' }),
    ]
    expect(monthReport(l, 2026, 9, new Date(2026, 10, 15)).expensesCents).toBe(20000)
    expect(yearReport(l, 2026, new Date(2026, 10, 15)).expensesCents).toBe(20000)
  })
})

describe('lucro estimado por percentual', () => {
  it('lê e mostra percentuais sem float', () => {
    expect(parsePercentToBp('35')).toBe(3500)
    expect(parsePercentToBp('32,5')).toBe(3250)
    expect(parsePercentToBp('32,5%')).toBe(3250)
    expect(parsePercentToBp('')).toBeNull()
    expect(parsePercentToBp('101')).toBe('invalid')
    expect(parsePercentToBp('abc')).toBe('invalid')
    expect(parsePercentToBp('100')).toBe(10000)
    expect(parsePercentToBp('0')).toBe(0)
    expect(formatPercent(3500)).toBe('35%')
    expect(formatPercent(3250)).toBe('32,5%')
    expect(formatPercent(3205)).toBe('32,05%')
    expect(bpToInput(3250)).toBe('32,5')
  })

  it('lucro = vendas × percentual, arredondado ao centavo', () => {
    expect(estimatedProfitCents(100000, 3500)).toBe(35000)
    expect(estimatedProfitCents(33333, 3333)).toBe(11110) // 33333 × 0,3333 = 11109,6…
    expect(estimatedProfitCents(0, 3500)).toBe(0)
  })

  const l = [
    tx('SALE', 100000, 'PIX', '2026-08-10T10:00:00'),
    tx('SALE', 200000, 'PIX', '2026-09-10T10:00:00'),
    tx('EXPENSE', 30000, 'PIX', '2026-09-11T10:00:00', { note: 'Aluguel' }),
    tx('SALE', 300000, 'PIX', '2026-10-02T10:00:00'),
    tx('EXPENSE', 40000, 'PIX', '2026-10-03T10:00:00', { note: 'Aluguel' }),
    tx('PURCHASE', 90000, 'PIX', '2026-10-04T10:00:00'),
  ]
  const now = new Date(2026, 9, 6)

  it('relatório mensal: lucro estimado e lucro após despesas (compras não entram)', () => {
    const r = monthReport(l, 2026, 9, now, 3000)
    expect(r.marginBp).toBe(3000)
    expect(r.estimatedProfitCents).toBe(90000)
    expect(r.profitAfterExpensesCents).toBe(50000) // 90000 − 40000 de despesas
    expect(r.purchasesCents).toBe(90000) // aparece, mas não é descontada do lucro
  })

  it('sem percentual não há lucro calculado', () => {
    const r = monthReport(l, 2026, 9, now)
    expect(r.estimatedProfitCents).toBeNull()
    expect(r.profitAfterExpensesCents).toBeNull()
  })

  it('anual soma o lucro de cada mês com o PERCENTUAL DO PRÓPRIO MÊS', () => {
    const r = yearReport(l, 2026, now, { '2026-08': 2000, '2026-09': 3000, '2026-10': 4000 })
    // 100000×20% + 200000×30% + 300000×40% = 20000 + 60000 + 120000
    expect(r.profitCents).toBe(200000)
    // menos despesas: 200000 − 30000 − 40000
    expect(r.profitAfterExpensesCents).toBe(130000)
    expect(r.monthsWithMargin).toBe(3)
    expect(r.monthsMissingMargin).toEqual([])
    expect(r.months[8].profitCents).toBe(60000)
    expect(r.months[8].profitAfterExpensesCents).toBe(30000)
  })

  it('anual: meses com vendas e sem percentual ficam fora da soma e são avisados', () => {
    const r = yearReport(l, 2026, now, { '2026-09': 3000 })
    expect(r.profitCents).toBe(60000)
    expect(r.profitAfterExpensesCents).toBe(30000) // despesas de agosto/outubro não entram
    expect(r.monthsMissingMargin).toEqual([7, 9])
    expect(r.months[7].profitCents).toBeNull()
  })

  it('sugere o último percentual informado antes do mês', () => {
    expect(lastMarginBefore({ '2026-08': 2000, '2026-09': 3000 }, 2026, 9)).toEqual({ key: '2026-09', bp: 3000 })
    expect(lastMarginBefore({ '2026-11': 3000 }, 2026, 9)).toBeNull()
    expect(lastMarginBefore({ '2025-12': 1500 }, 2026, 0)).toEqual({ key: '2025-12', bp: 1500 })
  })
})

describe('clientes: renomear e excluir', () => {
  function withMaria() {
    const { data, customer } = repo.addCustomer(emptyData(), { name: 'Maria', phone: '8499' })
    return { data, maria: customer }
  }

  it('renomeia e atualiza o telefone, marcando para sincronizar', () => {
    const { data, maria } = withMaria()
    const { data: next, customer } = repo.updateCustomer(data, maria.id, { name: '  Maria  José ', phone: '' })
    expect(customer.name).toBe('Maria José')
    expect(customer.phone).toBeUndefined()
    expect(next.pending.customers).toContain(maria.id)
  })

  it('não deixa renomear para um nome que já existe (ignora acento e caixa), mas aceita o próprio nome', () => {
    const { data, maria } = withMaria()
    const { data: d2, customer: ana } = repo.addCustomer(data, { name: 'Ana' })
    expect(() => repo.updateCustomer(d2, ana.id, { name: 'MARÍA' })).toThrow()
    expect(() => repo.updateCustomer(d2, maria.id, { name: 'Maria' })).not.toThrow()
    expect(() => repo.updateCustomer(d2, maria.id, { name: ' ' })).toThrow()
  })

  it('só exclui cliente sem saldo devedor; com ficha em aberto recusa', () => {
    const { data, maria } = withMaria()
    const sale = repo.addTransaction(data, { type: 'SALE', amountCents: 30000, paymentMethod: 'FICHA', customerId: maria.id })
    expect(() => repo.deleteCustomer(sale.data, maria.id)).toThrow(/ainda deve/)

    const paid = repo.addTransaction(sale.data, { type: 'PAYMENT', amountCents: 30000, paymentMethod: 'PIX', customerId: maria.id })
    const deleted = repo.deleteCustomer(paid.data, maria.id)
    expect(deleted.customers.find((c) => c.id === maria.id)?.deletedAt).toBeTruthy()
    // o histórico de vendas continua intacto
    expect(deleted.transactions).toHaveLength(2)
    expect(summarize(deleted.transactions).salesCents).toBe(30000)
    expect(totalReceivable(deleted.transactions)).toBe(0)
  })

  it('desfazer restaura o cliente; nome ocupado impede restaurar em duplicidade', () => {
    const { data, maria } = withMaria()
    const deleted = repo.deleteCustomer(data, maria.id)
    const restored = repo.restoreCustomer(deleted, maria.id)
    expect(restored.customers.find((c) => c.id === maria.id)?.deletedAt).toBeNull()

    const { data: taken } = repo.addCustomer(deleted, { name: 'Maria' })
    expect(() => repo.restoreCustomer(taken, maria.id)).toThrow()
  })
})
