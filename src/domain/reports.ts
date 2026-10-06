import type { PaymentMethod, Transaction } from '@/types'
import { formatMonthYear } from '@/lib/dates'
import { totalReceivable } from './balances'
import { estimatedProfitCents, marginKey } from './profit'
import { filterByRange, summarize } from './summary'

function monthRange(year: number, month0: number): [number, number] {
  return [new Date(year, month0, 1).getTime(), new Date(year, month0 + 1, 1).getTime()]
}

/** Contas a receber "fotografadas" no fim do período. */
function receivableAsOf(txs: Transaction[], endExclusiveMs: number): number {
  return totalReceivable(
    txs.filter((t) => !t.deletedAt && new Date(t.createdAt).getTime() < endExclusiveMs),
  )
}

export interface MonthReport {
  year: number
  month0: number
  label: string
  hasData: boolean
  salesCents: number
  salesCount: number
  averageTicketCents: number
  receivedCents: number
  fichaSalesCents: number
  fichaReceivedCents: number
  purchasesCents: number
  purchasesCount: number
  expensesCents: number
  expensesCount: number
  receivableCents: number
  salesByMethod: Record<PaymentMethod, number>
  daily: { day: number; salesCents: number }[]
  previous: { label: string; salesCents: number } | null
  /** true quando o mês ainda não acabou (comparação feita só até o mesmo dia do mês anterior) */
  comparisonIsPartial: boolean
  /** variação percentual das vendas vs. mês anterior (null se não houver base de comparação) */
  salesDeltaPct: number | null
  /** percentual de lucro estimado informado para o mês (null = ainda não informado) */
  marginBp: number | null
  /** vendas × percentual (null se não há percentual) */
  estimatedProfitCents: number | null
  /** lucro estimado − despesas do mês (null se não há percentual) */
  profitAfterExpensesCents: number | null
}

export function monthReport(
  txs: Transaction[],
  year: number,
  month0: number,
  now: Date = new Date(),
  marginBp: number | null = null,
): MonthReport {
  const [from, to] = monthRange(year, month0)
  const monthTxs = filterByRange(txs, from, to)
  const s = summarize(monthTxs)

  const daysInMonth = new Date(year, month0 + 1, 0).getDate()
  const daily = Array.from({ length: daysInMonth }, (_, i) => ({ day: i + 1, salesCents: 0 }))
  for (const t of monthTxs) {
    if (t.type !== 'SALE') continue
    daily[new Date(t.createdAt).getDate() - 1].salesCents += t.amountCents
  }

  const prevYear = month0 === 0 ? year - 1 : year
  const prevMonth = month0 === 0 ? 11 : month0 - 1
  const [pFrom, pFullTo] = monthRange(prevYear, prevMonth)
  // Mês em andamento: compara com o MESMO PERÍODO do mês anterior (dias 1..hoje), não com o mês inteiro.
  const inProgress = year === now.getFullYear() && month0 === now.getMonth()
  const prevDays = new Date(prevYear, prevMonth + 1, 0).getDate()
  const pTo = inProgress
    ? Math.min(pFullTo, new Date(prevYear, prevMonth, Math.min(now.getDate(), prevDays) + 1).getTime())
    : pFullTo
  const prev = summarize(filterByRange(txs, pFrom, pTo))
  const previous =
    prev.salesCount > 0
      ? { label: formatMonthYear(prevYear, prevMonth), salesCents: prev.salesCents }
      : null
  const salesDeltaPct =
    previous && previous.salesCents > 0
      ? ((s.salesCents - previous.salesCents) / previous.salesCents) * 100
      : null

  const profit = marginBp === null ? null : estimatedProfitCents(s.salesCents, marginBp)

  return {
    year,
    month0,
    label: formatMonthYear(year, month0),
    hasData: monthTxs.length > 0,
    salesCents: s.salesCents,
    salesCount: s.salesCount,
    averageTicketCents: s.salesCount > 0 ? Math.round(s.salesCents / s.salesCount) : 0,
    receivedCents: s.receivedCents,
    fichaSalesCents: s.fichaSalesCents,
    fichaReceivedCents: s.paymentsCents,
    purchasesCents: s.purchasesCents,
    purchasesCount: s.purchasesCount,
    expensesCents: s.expensesCents,
    expensesCount: s.expensesCount,
    receivableCents: receivableAsOf(txs, to),
    salesByMethod: s.salesByMethod,
    daily,
    previous,
    comparisonIsPartial: inProgress,
    salesDeltaPct,
    marginBp,
    estimatedProfitCents: profit,
    profitAfterExpensesCents: profit === null ? null : profit - s.expensesCents,
  }
}

export interface YearMonthRow {
  month0: number
  salesCents: number
  purchasesCents: number
  expensesCents: number
  receivedCents: number
  /** percentual do mês (null = não informado) */
  marginBp: number | null
  /** lucro estimado do mês (null = sem percentual) */
  profitCents: number | null
  /** lucro estimado − despesas do mês (null = sem percentual) */
  profitAfterExpensesCents: number | null
}

export interface YearReport {
  year: number
  hasData: boolean
  months: YearMonthRow[]
  salesCents: number
  purchasesCents: number
  expensesCents: number
  receivedCents: number
  /** Soma dos lucros estimados de cada mês (cada mês usa o SEU percentual). Só meses com percentual entram. */
  profitCents: number
  /** Soma de (lucro estimado − despesas) dos meses com percentual. */
  profitAfterExpensesCents: number
  /** Meses com percentual informado */
  monthsWithMargin: number
  /** Meses que tiveram vendas, mas não têm percentual (não entram na soma do lucro) */
  monthsMissingMargin: number[]
  /** Média mensal = vendas do ano / meses considerados (do 1º mês com venda até o mês atual, ou dezembro em anos passados). */
  averageMonthlySalesCents: number
  monthsConsidered: number
  best: YearMonthRow | null
  worst: YearMonthRow | null
  receivableCents: number
}

export function yearReport(
  txs: Transaction[],
  year: number,
  now: Date = new Date(),
  margins: Record<string, number> = {},
): YearReport {
  const months: YearMonthRow[] = Array.from({ length: 12 }, (_, month0) => {
    const [from, to] = monthRange(year, month0)
    const s = summarize(filterByRange(txs, from, to))
    const bp = margins[marginKey(year, month0)]
    const marginBp = typeof bp === 'number' ? bp : null
    const profit = marginBp === null ? null : estimatedProfitCents(s.salesCents, marginBp)
    return {
      month0,
      salesCents: s.salesCents,
      purchasesCents: s.purchasesCents,
      expensesCents: s.expensesCents,
      receivedCents: s.receivedCents,
      marginBp,
      profitCents: profit,
      profitAfterExpensesCents: profit === null ? null : profit - s.expensesCents,
    }
  })

  const sum = (pick: (m: YearMonthRow) => number | null) =>
    months.reduce((a, m) => a + (pick(m) ?? 0), 0)

  const salesCents = sum((m) => m.salesCents)
  const purchasesCents = sum((m) => m.purchasesCents)
  const expensesCents = sum((m) => m.expensesCents)
  const receivedCents = sum((m) => m.receivedCents)

  const lastMonth = year < now.getFullYear() ? 11 : year === now.getFullYear() ? now.getMonth() : -1
  const firstWithSales = months.findIndex((m) => m.salesCents > 0)
  let considered: YearMonthRow[] = []
  if (firstWithSales !== -1 && lastMonth >= firstWithSales) {
    considered = months.slice(firstWithSales, lastMonth + 1)
  }

  let best: YearMonthRow | null = null
  let worst: YearMonthRow | null = null
  for (const m of considered) {
    if (!best || m.salesCents > best.salesCents) best = m
    if (!worst || m.salesCents < worst.salesCents) worst = m
  }

  const monthsConsidered = considered.length
  const yearEnd = new Date(year + 1, 0, 1).getTime()

  return {
    year,
    hasData: months.some((m) => m.salesCents || m.purchasesCents || m.expensesCents || m.receivedCents),
    months,
    salesCents,
    purchasesCents,
    expensesCents,
    receivedCents,
    profitCents: sum((m) => m.profitCents),
    profitAfterExpensesCents: sum((m) => m.profitAfterExpensesCents),
    monthsWithMargin: months.filter((m) => m.marginBp !== null).length,
    monthsMissingMargin: months.filter((m) => m.marginBp === null && m.salesCents > 0).map((m) => m.month0),
    averageMonthlySalesCents: monthsConsidered > 0 ? Math.round(salesCents / monthsConsidered) : 0,
    monthsConsidered,
    best,
    worst,
    receivableCents: receivableAsOf(txs, yearEnd),
  }
}

/** Anos que possuem lançamentos (sempre inclui o ano atual), do mais novo ao mais antigo. */
export function availableYears(txs: Transaction[], now: Date = new Date()): number[] {
  const years = new Set<number>([now.getFullYear()])
  for (const t of txs) if (!t.deletedAt) years.add(new Date(t.createdAt).getFullYear())
  return [...years].sort((a, b) => b - a)
}
