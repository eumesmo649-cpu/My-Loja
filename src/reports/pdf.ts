import type { MonthReport, YearReport } from '@/domain/reports'
import { METHOD_LABEL, SALE_METHODS } from '@/domain/methods'
import { formatDayFull, monthName, capitalize } from '@/lib/dates'
import { formatPercent } from '@/domain/profit'
import { formatBRL } from '@/lib/money'

/**
 * Geração de PDF no próprio aparelho (sem servidor). A biblioteca é carregada sob demanda.
 * Usa a fonte Helvetica embutida do PDF (cobre acentos do português); por isso evitamos
 * caracteres fora do Latin-1 (como "−").
 */

const BRAND: [number, number, number] = [159, 58, 92]
const INK: [number, number, number] = [42, 36, 33]
const MUTED: [number, number, number] = [111, 101, 93]
const LINE: [number, number, number] = [226, 219, 208]
const SAND: [number, number, number] = [243, 238, 230]

type Doc = import('jspdf').jsPDF

const PAGE_W = 210
const MARGIN = 18
const CONTENT_W = PAGE_W - MARGIN * 2

async function newDoc(): Promise<Doc> {
  const { jsPDF } = await import('jspdf')
  return new jsPDF({ unit: 'mm', format: 'a4' })
}

function header(doc: Doc, title: string, subtitle: string): number {
  doc.setFillColor(...BRAND)
  doc.roundedRect(MARGIN, 16, 10, 10, 2.5, 2.5, 'F')
  doc.setTextColor(250, 247, 242)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(13)
  doc.text('M', MARGIN + 5, 23, { align: 'center' })

  doc.setTextColor(...INK)
  doc.setFontSize(12)
  doc.text('MyLoja', MARGIN + 13, 23)

  doc.setFontSize(22)
  doc.text(title, MARGIN, 42)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(11)
  doc.setTextColor(...MUTED)
  doc.text(subtitle, MARGIN, 49)
  doc.setDrawColor(...LINE)
  doc.line(MARGIN, 54, PAGE_W - MARGIN, 54)
  return 64
}

function footer(doc: Doc) {
  const pages = doc.getNumberOfPages()
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    doc.setTextColor(...MUTED)
    doc.text(`Gerado pelo MyLoja em ${formatDayFull(new Date())}`, MARGIN, 288)
    doc.text(`Página ${i} de ${pages}`, PAGE_W - MARGIN, 288, { align: 'right' })
  }
}

function section(doc: Doc, y: number, text: string): number {
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(12)
  doc.setTextColor(...INK)
  doc.text(text, MARGIN, y)
  return y + 4
}

function kpiRow(doc: Doc, y: number, items: { label: string; value: string }[]): number {
  const gap = 4
  const w = (CONTENT_W - gap * (items.length - 1)) / items.length
  items.forEach((it, i) => {
    const x = MARGIN + i * (w + gap)
    doc.setFillColor(...SAND)
    doc.roundedRect(x, y, w, 22, 3, 3, 'F')
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    doc.setTextColor(...MUTED)
    doc.text(it.label, x + 4, y + 7)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(it.value.length > 12 ? 11 : 13)
    doc.setTextColor(...INK)
    doc.text(it.value, x + 4, y + 16)
  })
  return y + 22 + 8
}

function table(doc: Doc, y: number, rows: [string, string][], opts: { boldLast?: boolean } = {}): number {
  rows.forEach((r, i) => {
    if (y > 270) {
      doc.addPage()
      y = 20
    }
    const last = opts.boldLast && i === rows.length - 1
    doc.setFont('helvetica', last ? 'bold' : 'normal')
    doc.setFontSize(11)
    doc.setTextColor(...(last ? INK : MUTED))
    doc.text(r[0], MARGIN + 2, y + 6)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(...INK)
    doc.text(r[1], PAGE_W - MARGIN - 2, y + 6, { align: 'right' })
    doc.setDrawColor(...LINE)
    doc.line(MARGIN, y + 9, PAGE_W - MARGIN, y + 9)
    y += 9
  })
  return y + 6
}

function barChart(doc: Doc, y: number, h: number, bars: { label: string; value: number }[], labelEvery = 1): number {
  const max = Math.max(...bars.map((b) => b.value), 1)
  const slot = CONTENT_W / bars.length
  const bw = Math.min(9, slot * 0.62)
  doc.setDrawColor(...LINE)
  doc.line(MARGIN, y + h, PAGE_W - MARGIN, y + h)
  bars.forEach((b, i) => {
    const bh = b.value > 0 ? Math.max(0.8, (b.value / max) * (h - 4)) : 0
    const x = MARGIN + i * slot + (slot - bw) / 2
    doc.setFillColor(...(b.value > 0 ? BRAND : LINE))
    if (bh > 0) doc.roundedRect(x, y + h - bh, bw, bh, 0.8, 0.8, 'F')
    if (i % labelEvery === 0) {
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(8)
      doc.setTextColor(...MUTED)
      doc.text(b.label, x + bw / 2, y + h + 4.5, { align: 'center' })
    }
  })
  return y + h + 12
}

function save(doc: Doc, filename: string) {
  footer(doc)
  doc.save(filename)
}

export async function generateMonthPdf(r: MonthReport): Promise<void> {
  const doc = await newDoc()
  let y = header(doc, 'Relatório mensal', r.label)

  y = kpiRow(doc, y, [
    { label: 'Total vendido', value: formatBRL(r.salesCents) },
    { label: 'Total recebido', value: formatBRL(r.receivedCents) },
    r.estimatedProfitCents !== null
      ? { label: `Lucro estimado (${formatPercent(r.marginBp ?? 0)})`, value: formatBRL(r.estimatedProfitCents) }
      : { label: 'Despesas', value: formatBRL(r.expensesCents) },
  ])

  y = section(doc, y, 'Resumo do mês')
  const delta =
    r.salesDeltaPct === null
      ? 'sem mês anterior para comparar'
      : `${r.salesDeltaPct >= 0 ? '+' : '-'}${Math.abs(Math.round(r.salesDeltaPct))}% vs. ${r.previous?.label}${r.comparisonIsPartial ? ' (mesmo período)' : ''}`
  y = table(doc, y, [
    ['Quantidade de vendas', String(r.salesCount)],
    ['Ticket médio', formatBRL(r.averageTicketCents)],
    ['Vendas na ficha', formatBRL(r.fichaSalesCents)],
    ['Recebido de fichas (prestações)', formatBRL(r.fichaReceivedCents)],
    ['Contas a receber no fim do mês', formatBRL(r.receivableCents)],
    ['Compras de mercadoria', formatBRL(r.purchasesCents)],
    ['Despesas', formatBRL(r.expensesCents)],
    ['Comparação com o mês anterior', delta],
  ])

  y = section(doc, y, 'Lucro estimado')
  if (r.marginBp !== null && r.estimatedProfitCents !== null && r.profitAfterExpensesCents !== null) {
    y = table(
      doc,
      y,
      [
        ['Percentual de lucro estimado (sobre o total vendido)', formatPercent(r.marginBp)],
        ['Lucro estimado', formatBRL(r.estimatedProfitCents)],
        ['Despesas do mês', `${r.expensesCents > 0 ? '-' : ''}${formatBRL(r.expensesCents)}`],
        [
          'Lucro após despesas',
          `${r.profitAfterExpensesCents < 0 ? '-' : ''}${formatBRL(Math.abs(r.profitAfterExpensesCents))}`,
        ],
      ],
      { boldLast: true },
    )
    doc.setFont('helvetica', 'italic')
    doc.setFontSize(9)
    doc.setTextColor(...MUTED)
    doc.text('Estimativa: o percentual já considera o custo das peças, por isso as compras não são descontadas de novo.', MARGIN, y - 2)
    y += 6
  } else {
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(10)
    doc.setTextColor(...MUTED)
    doc.text('Percentual de lucro não informado para este mês.', MARGIN + 2, y + 6)
    y += 14
  }

  y = section(doc, y, 'Vendas por forma de pagamento')
  y = table(
    doc,
    y,
    SALE_METHODS.map((m) => [METHOD_LABEL[m], formatBRL(r.salesByMethod[m])] as [string, string]),
  )

  if (y > 205) {
    doc.addPage()
    y = 24
  }
  y = section(doc, y, 'Vendas por dia')
  barChart(
    doc,
    y + 4,
    42,
    r.daily.map((d) => ({ label: String(d.day), value: d.salesCents })),
    r.daily.length > 20 ? 3 : 2,
  )

  save(doc, `myloja-relatorio-${r.year}-${String(r.month0 + 1).padStart(2, '0')}.pdf`)
}

export async function generateYearPdf(r: YearReport): Promise<void> {
  const doc = await newDoc()
  let y = header(doc, 'Relatório anual', String(r.year))

  y = kpiRow(doc, y, [
    { label: 'Total vendido', value: formatBRL(r.salesCents) },
    { label: 'Total recebido', value: formatBRL(r.receivedCents) },
    r.monthsWithMargin > 0
      ? { label: 'Lucro estimado do ano', value: formatBRL(r.profitCents) }
      : { label: 'Despesas', value: formatBRL(r.expensesCents) },
  ])

  y = section(doc, y, 'Resumo do ano')
  y = table(doc, y, [
    ['Média mensal de vendas', formatBRL(r.averageMonthlySalesCents)],
    ['Melhor mês', r.best ? `${capitalize(monthName(r.best.month0))} · ${formatBRL(r.best.salesCents)}` : '-'],
    ['Pior mês', r.worst ? `${capitalize(monthName(r.worst.month0))} · ${formatBRL(r.worst.salesCents)}` : '-'],
    ['Contas a receber no fim do ano', formatBRL(r.receivableCents)],
    ['Compras de mercadoria', formatBRL(r.purchasesCents)],
    ['Despesas', formatBRL(r.expensesCents)],
    ...(r.monthsWithMargin > 0
      ? ([
          ['Lucro estimado (soma dos meses)', formatBRL(r.profitCents)],
          [
            'Lucro após despesas',
            `${r.profitAfterExpensesCents < 0 ? '-' : ''}${formatBRL(Math.abs(r.profitAfterExpensesCents))}`,
          ],
        ] as [string, string][])
      : ([['Lucro estimado', 'percentual não informado']] as [string, string][])),
  ])
  if (r.monthsWithMargin > 0 && r.monthsMissingMargin.length > 0) {
    doc.setFont('helvetica', 'italic')
    doc.setFontSize(9)
    doc.setTextColor(...MUTED)
    doc.text(
      `Sem percentual (fora da soma do lucro): ${r.monthsMissingMargin.map((m) => capitalize(monthName(m))).join(', ')}.`,
      MARGIN,
      y - 2,
      { maxWidth: CONTENT_W },
    )
    y += 6
  }

  y = section(doc, y, 'Evolução das vendas')
  y = barChart(
    doc,
    y + 4,
    42,
    r.months.map((m) => ({ label: capitalize(monthName(m.month0)).slice(0, 3), value: m.salesCents })),
  )

  if (y > 150) {
    doc.addPage()
    y = 24
  }
  y = section(doc, y, 'Mês a mês (cada mês usa o seu percentual de lucro)')
  const cols = { month: MARGIN + 2, sales: 66, received: 94, expenses: 122, pct: 142, profit: PAGE_W - MARGIN - 2 }
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9.5)
  doc.setTextColor(...MUTED)
  doc.text('Mês', cols.month, y + 6)
  doc.text('Vendas', cols.sales, y + 6, { align: 'right' })
  doc.text('Recebido', cols.received, y + 6, { align: 'right' })
  doc.text('Despesas', cols.expenses, y + 6, { align: 'right' })
  doc.text('%', cols.pct, y + 6, { align: 'right' })
  doc.text('Lucro est.', cols.profit, y + 6, { align: 'right' })
  doc.setDrawColor(...LINE)
  doc.line(MARGIN, y + 9, PAGE_W - MARGIN, y + 9)
  y += 9
  doc.setTextColor(...INK)
  r.months.forEach((m) => {
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9.5)
    doc.text(capitalize(monthName(m.month0)), cols.month, y + 6)
    doc.text(formatBRL(m.salesCents), cols.sales, y + 6, { align: 'right' })
    doc.text(formatBRL(m.receivedCents), cols.received, y + 6, { align: 'right' })
    doc.text(formatBRL(m.expensesCents), cols.expenses, y + 6, { align: 'right' })
    doc.text(m.marginBp === null ? '-' : formatPercent(m.marginBp), cols.pct, y + 6, { align: 'right' })
    doc.text(m.profitCents === null ? '-' : formatBRL(m.profitCents), cols.profit, y + 6, { align: 'right' })
    doc.line(MARGIN, y + 9, PAGE_W - MARGIN, y + 9)
    y += 9
  })
  doc.setFont('helvetica', 'bold')
  doc.text('Total', cols.month, y + 7)
  doc.text(formatBRL(r.salesCents), cols.sales, y + 7, { align: 'right' })
  doc.text(formatBRL(r.receivedCents), cols.received, y + 7, { align: 'right' })
  doc.text(formatBRL(r.expensesCents), cols.expenses, y + 7, { align: 'right' })
  doc.text(r.monthsWithMargin > 0 ? formatBRL(r.profitCents) : '-', cols.profit, y + 7, { align: 'right' })

  save(doc, `myloja-relatorio-${r.year}.pdf`)
}
