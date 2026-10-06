import { useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight, FileText, TrendingDown, TrendingUp } from 'lucide-react'
import { useStore } from '@/store/StoreContext'
import { useUI } from '@/store/UIContext'
import { availableYears, monthReport, yearReport, type MonthReport } from '@/domain/reports'
import { bpToInput, formatPercent, lastMarginBefore, marginKey, parsePercentToBp } from '@/domain/profit'
import { capitalize, formatMonthYear, monthName, monthShort } from '@/lib/dates'
import { formatBRL } from '@/lib/money'
import { cn } from '@/lib/cn'
import { Button } from '@/components/ui/Button'
import { Card, SectionTitle } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/EmptyState'
import { Segmented } from '@/components/ui/Segmented'
import { TextField } from '@/components/ui/TextField'
import { PageHeader } from '@/components/layout/PageHeader'
import { BarChart } from '@/components/charts/BarChart'
import { PaymentBreakdown } from '@/components/PaymentBreakdown'
import { useNow } from '@/hooks/useNow'

function Stat({ label, value, tone, hint }: { label: string; value: string; tone?: 'sage' | 'clay' | 'danger'; hint?: string }) {
  return (
    <div
      className={cn(
        'rounded-2xl p-4',
        tone === 'sage' && 'bg-sage-50',
        tone === 'clay' && 'bg-clay-50',
        tone === 'danger' && 'bg-danger-50',
        !tone && 'border border-line bg-card',
      )}
    >
      <p className={cn('text-sm font-semibold', tone === 'sage' ? 'text-sage-700' : tone === 'clay' ? 'text-clay-700' : tone === 'danger' ? 'text-danger-700' : 'text-muted')}>{label}</p>
      <p className={cn('num mt-1 text-[22px] font-bold leading-tight', tone === 'sage' && 'text-sage-700', tone === 'clay' && 'text-clay-700', tone === 'danger' && 'text-danger-700')}>{value}</p>
      {hint && <p className="mt-0.5 text-[13px] text-muted">{hint}</p>}
    </div>
  )
}

/** Percentual de lucro estimado do mês (salvo automaticamente) e o lucro que resulta dele. */
function ProfitCard({
  report,
  margins,
  onSave,
}: {
  report: MonthReport
  margins: Record<string, number>
  onSave: (bp: number | null) => void
}) {
  const [text, setText] = useState(report.marginBp === null ? '' : bpToInput(report.marginBp))
  const [error, setError] = useState<string>()
  const suggestion = report.marginBp === null ? lastMarginBefore(margins, report.year, report.month0) : null

  const change = (value: string) => {
    setText(value.replace(/[^\d.,]/g, '').slice(0, 6))
    const parsed = parsePercentToBp(value.replace(/[^\d.,]/g, ''))
    if (parsed === 'invalid') {
      setError('Digite um percentual entre 0 e 100, como 35 ou 32,5.')
      return
    }
    setError(undefined)
    onSave(parsed)
  }

  return (
    <Card className="p-5">
      <SectionTitle>Lucro estimado</SectionTitle>
      <TextField
        label="Percentual de lucro estimado (%)"
        value={text}
        onChange={change}
        error={error}
        inputMode="decimal"
        placeholder="Ex.: 35"
        autoComplete="off"
      />
      <p className="mt-2 text-sm leading-snug text-muted">
        Como não temos o lucro de cada peça, o lucro é uma estimativa: este percentual aplicado ao total vendido no mês. Fica
        salvo para este mês.
      </p>
      {suggestion && (
        <button
          type="button"
          onClick={() => change(bpToInput(suggestion.bp))}
          className="mt-3 min-h-10 rounded-xl bg-brand-50 px-3.5 text-sm font-semibold text-brand-700 hover:bg-brand-100"
        >
          Usar {formatPercent(suggestion.bp)} (último percentual informado)
        </button>
      )}

      {report.marginBp !== null && report.estimatedProfitCents !== null && report.profitAfterExpensesCents !== null && (
        <dl className="mt-5 divide-y divide-line rounded-2xl border border-line">
          <div className="flex items-center justify-between gap-4 px-4 py-3.5">
            <dt className="text-[15px] text-muted">
              Lucro estimado <span className="num">({formatPercent(report.marginBp)} de {formatBRL(report.salesCents)})</span>
            </dt>
            <dd className="num shrink-0 whitespace-nowrap text-lg font-bold text-sage-700">{formatBRL(report.estimatedProfitCents)}</dd>
          </div>
          <div className="flex items-center justify-between gap-4 px-4 py-3.5">
            <dt className="text-[15px] text-muted">Despesas do mês</dt>
            <dd className="num shrink-0 whitespace-nowrap text-lg font-bold text-danger-600">{report.expensesCents > 0 ? '−' : ''}{formatBRL(report.expensesCents)}</dd>
          </div>
          <div className="flex items-center justify-between gap-4 bg-sand/60 px-4 py-4">
            <dt className="text-[15px] font-bold">Lucro após despesas</dt>
            <dd className={cn('num shrink-0 whitespace-nowrap text-2xl font-extrabold', report.profitAfterExpensesCents < 0 ? 'text-danger-600' : 'text-ink')}>
              {report.profitAfterExpensesCents < 0 ? '−' : ''}{formatBRL(Math.abs(report.profitAfterExpensesCents))}
            </dd>
          </div>
        </dl>
      )}
      <p className="mt-3 text-[13px] leading-snug text-faint">
        As compras de mercadoria não são descontadas de novo, porque o percentual já considera o custo das peças.
      </p>
    </Card>
  )
}

function Stepper({ label, onPrev, onNext, nextDisabled }: { label: string; onPrev: () => void; onNext: () => void; nextDisabled?: boolean }) {
  return (
    <div className="flex items-center justify-between rounded-2xl border border-line bg-card p-1.5">
      <button type="button" aria-label="Anterior" onClick={onPrev} className="grid h-11 w-11 place-items-center rounded-xl text-muted hover:bg-sand">
        <ChevronLeft className="h-5 w-5" aria-hidden />
      </button>
      <p className="font-bold" aria-live="polite">
        {label}
      </p>
      <button type="button" aria-label="Próximo" disabled={nextDisabled} onClick={onNext} className="grid h-11 w-11 place-items-center rounded-xl text-muted hover:bg-sand disabled:opacity-30">
        <ChevronRight className="h-5 w-5" aria-hidden />
      </button>
    </div>
  )
}

export function ReportsPage() {
  const { transactions, settings, setProfitMargin } = useStore()
  const { toast } = useUI()
  const now = useNow(60_000)
  const [tab, setTab] = useState<'month' | 'year'>('month')
  const [year, setYear] = useState(now.getFullYear())
  const [month0, setMonth0] = useState(now.getMonth())
  const [busy, setBusy] = useState(false)

  const years = useMemo(() => availableYears(transactions, now), [transactions, now])
  const minYear = years[years.length - 1]
  const margins = settings.profitMarginBp
  const month = useMemo(
    () => monthReport(transactions, year, month0, now, margins[marginKey(year, month0)] ?? null),
    [transactions, year, month0, now, margins],
  )
  const yearRep = useMemo(() => yearReport(transactions, year, now, margins), [transactions, year, now, margins])

  const isCurrentMonth = year === now.getFullYear() && month0 === now.getMonth()
  const goMonth = (delta: number) => {
    const d = new Date(year, month0 + delta, 1)
    setYear(d.getFullYear())
    setMonth0(d.getMonth())
  }

  const makePdf = async () => {
    setBusy(true)
    try {
      const { generateMonthPdf, generateYearPdf } = await import('@/reports/pdf')
      if (tab === 'month') await generateMonthPdf(month)
      else await generateYearPdf(yearRep)
      toast({ title: 'Relatório gerado', description: 'O PDF foi salvo no aparelho.' })
    } catch {
      toast({ kind: 'error', title: 'Não foi possível gerar o PDF', description: 'Tente novamente.' })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      <PageHeader title="Relatórios" subtitle="Como a loja está indo" />

      <Segmented variant="tabs" ariaLabel="Tipo de relatório" value={tab} onChange={setTab} options={[{ value: 'month', label: 'Mensal' }, { value: 'year', label: 'Anual' }]} />

      <div className="mt-4">
        {tab === 'month' ? (
          <Stepper label={formatMonthYear(year, month0)} onPrev={() => goMonth(-1)} onNext={() => goMonth(1)} nextDisabled={isCurrentMonth || year > now.getFullYear()} />
        ) : (
          <Stepper label={String(year)} onPrev={() => setYear(year - 1)} onNext={() => setYear(year + 1)} nextDisabled={year >= now.getFullYear()} />
        )}
        {tab === 'year' && year <= minYear - 3 && <p className="mt-2 text-sm text-muted">Sem lançamentos nesses anos.</p>}
      </div>

      {tab === 'month' ? (
        !month.hasData ? (
          <Card className="mt-5">
            <EmptyState icon={FileText} title="Sem movimentações neste mês" description="Escolha outro mês ou registre vendas para ver o relatório." />
          </Card>
        ) : (
          <div className="mt-5 flex flex-col gap-6">
            <Card className="p-5 md:p-6">
              <p className="text-sm font-semibold text-muted">Total vendido</p>
              <p className="num mt-1 text-[44px] font-extrabold leading-none tracking-tight">{formatBRL(month.salesCents)}</p>
              <p className="mt-2 flex flex-wrap items-center gap-x-2 text-sm text-muted">
                <span>{month.salesCount} {month.salesCount === 1 ? 'venda' : 'vendas'} · ticket médio {formatBRL(month.averageTicketCents)}</span>
              </p>
              {month.salesDeltaPct !== null && month.previous ? (
                <p className={cn('mt-3 inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-semibold', month.salesDeltaPct >= 0 ? 'bg-sage-50 text-sage-700' : 'bg-danger-50 text-danger-700')}>
                  {month.salesDeltaPct >= 0 ? <TrendingUp className="h-4 w-4" aria-hidden /> : <TrendingDown className="h-4 w-4" aria-hidden />}
                  {Math.abs(Math.round(month.salesDeltaPct))}% {month.salesDeltaPct >= 0 ? 'a mais' : 'a menos'} que {month.previous.label.split(' de ')[0].toLowerCase()}{month.comparisonIsPartial ? ' (mesmo período)' : ''}
                </p>
              ) : (
                <p className="mt-3 text-sm text-faint">Sem mês anterior para comparar</p>
              )}
            </Card>

            <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
              <Stat label="Total recebido" value={formatBRL(month.receivedCents)} tone="sage" hint="dinheiro que entrou" />
              <Stat label="Vendido em ficha" value={formatBRL(month.fichaSalesCents)} tone="clay" />
              <Stat label="Recebido de fichas" value={formatBRL(month.fichaReceivedCents)} />
              <Stat label="Compras de mercadoria" value={formatBRL(month.purchasesCents)} tone="danger" />
              <Stat label="Despesas" value={formatBRL(month.expensesCents)} tone="danger" hint={month.expensesCount > 0 ? `${month.expensesCount} ${month.expensesCount === 1 ? 'lançamento' : 'lançamentos'}` : undefined} />
            </div>
            <Stat label="Contas a receber no fim do mês" value={formatBRL(month.receivableCents)} tone="clay" />

            <ProfitCard
              key={marginKey(year, month0)}
              report={month}
              margins={margins}
              onSave={(bp) => setProfitMargin(marginKey(year, month0), bp)}
            />

            <Card className="p-5">
              <SectionTitle>Evolução das vendas no mês</SectionTitle>
              <BarChart
                ariaLabel={`Vendas por dia em ${month.label}`}
                data={month.daily.map((d) => ({ label: `Dia ${d.day}`, axis: String(d.day), value: d.salesCents }))}
                axisEvery={month.daily.length > 28 ? 3 : 2}
              />
            </Card>

            <Card className="p-5">
              <SectionTitle>Vendas por forma de pagamento</SectionTitle>
              <PaymentBreakdown variant="bars" byMethod={month.salesByMethod} />
            </Card>

            <Button size="lg" full loading={busy} icon={<FileText className="h-5 w-5" aria-hidden />} onClick={() => void makePdf()}>
              Gerar relatório mensal
            </Button>
          </div>
        )
      ) : !yearRep.hasData ? (
        <Card className="mt-5">
          <EmptyState icon={FileText} title="Sem movimentações neste ano" description="Escolha outro ano ou registre vendas para ver o relatório." />
        </Card>
      ) : (
        <div className="mt-5 flex flex-col gap-6">
          <Card className="p-5 md:p-6">
            <p className="text-sm font-semibold text-muted">Total vendido em {year}</p>
            <p className="num mt-1 text-[44px] font-extrabold leading-none tracking-tight">{formatBRL(yearRep.salesCents)}</p>
            <p className="mt-2 text-sm text-muted">Média mensal {formatBRL(yearRep.averageMonthlySalesCents)}</p>
          </Card>

          <Card className="p-5">
            <SectionTitle>Lucro estimado do ano</SectionTitle>
            {yearRep.monthsWithMargin === 0 ? (
              <p className="text-[15px] leading-relaxed text-muted">
                Ainda não há percentual de lucro informado em nenhum mês de {year}. Informe em <strong>Relatórios → Mensal</strong>, no
                campo "Percentual de lucro estimado". O lucro do ano é a soma dos lucros de cada mês, cada um com o seu percentual.
              </p>
            ) : (
              <>
                <p className="num text-[40px] font-extrabold leading-none tracking-tight">{formatBRL(yearRep.profitCents)}</p>
                <p className="mt-2 text-sm text-muted">
                  Soma dos lucros estimados de {yearRep.monthsWithMargin} {yearRep.monthsWithMargin === 1 ? 'mês' : 'meses'}, cada um com o
                  percentual do próprio mês.
                </p>
                <div className="mt-4 flex items-center justify-between gap-4 rounded-2xl bg-sand/60 px-4 py-3.5">
                  <span className="text-[15px] font-bold">Lucro após despesas</span>
                  <span className={cn('num text-xl font-extrabold', yearRep.profitAfterExpensesCents < 0 && 'text-danger-600')}>
                    {yearRep.profitAfterExpensesCents < 0 ? '−' : ''}{formatBRL(Math.abs(yearRep.profitAfterExpensesCents))}
                  </span>
                </div>
              </>
            )}
            {yearRep.monthsWithMargin > 0 && yearRep.monthsMissingMargin.length > 0 && (
              <p role="status" className="mt-3 rounded-2xl bg-clay-50 px-4 py-3 text-[14px] leading-snug text-clay-700">
                Faltou informar o percentual em {yearRep.monthsMissingMargin.map((m) => capitalize(monthName(m))).join(', ')}. Esses meses não
                entraram na soma do lucro.
              </p>
            )}
          </Card>

          <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
            <Stat label="Total recebido" value={formatBRL(yearRep.receivedCents)} tone="sage" />
            <Stat label="Compras de mercadoria" value={formatBRL(yearRep.purchasesCents)} tone="danger" />
            <Stat label="Despesas" value={formatBRL(yearRep.expensesCents)} tone="danger" />
            <Stat label="Melhor mês" value={yearRep.best ? capitalize(monthName(yearRep.best.month0)) : '—'} hint={yearRep.best ? formatBRL(yearRep.best.salesCents) : undefined} />
            <Stat label="Pior mês" value={yearRep.worst ? capitalize(monthName(yearRep.worst.month0)) : '—'} hint={yearRep.worst ? formatBRL(yearRep.worst.salesCents) : undefined} />
          </div>
          <Stat label="Contas a receber no fim do ano" value={formatBRL(yearRep.receivableCents)} tone="clay" />

          <Card className="p-5">
            <SectionTitle>Evolução das vendas por mês</SectionTitle>
            <BarChart
              ariaLabel={`Vendas por mês em ${year}`}
              data={yearRep.months.map((m) => ({ label: capitalize(monthName(m.month0)), axis: capitalize(monthShort(m.month0)), value: m.salesCents }))}
            />
          </Card>

          <Card className="overflow-hidden">
            <div className="px-5 pt-5">
              <SectionTitle>Mês a mês</SectionTitle>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-left text-[15px]">
                <thead>
                  <tr className="border-y border-line text-sm text-muted">
                    <th className="px-5 py-2.5 font-semibold">Mês</th>
                    <th className="px-3 py-2.5 text-right font-semibold">Vendas</th>
                    <th className="px-3 py-2.5 text-right font-semibold">Recebido</th>
                    <th className="px-3 py-2.5 text-right font-semibold">Compras</th>
                    <th className="px-3 py-2.5 text-right font-semibold">Despesas</th>
                    <th className="px-5 py-2.5 text-right font-semibold">Lucro est.</th>
                  </tr>
                </thead>
                <tbody className="num">
                  {yearRep.months.map((m) => (
                    <tr key={m.month0} className="border-b border-line last:border-0">
                      <th scope="row" className="px-5 py-3 font-semibold">{capitalize(monthName(m.month0))}</th>
                      <td className="px-3 py-3 text-right">{formatBRL(m.salesCents)}</td>
                      <td className="px-3 py-3 text-right text-sage-700">{formatBRL(m.receivedCents)}</td>
                      <td className="px-3 py-3 text-right text-danger-700">{formatBRL(m.purchasesCents)}</td>
                      <td className="px-3 py-3 text-right text-danger-700">{formatBRL(m.expensesCents)}</td>
                      <td className="px-5 py-3 text-right">
                        {m.profitCents === null ? (
                          <span className="text-faint" title="Percentual não informado">—</span>
                        ) : (
                          <>
                            {formatBRL(m.profitCents)}
                            <span className="block text-xs font-medium text-muted">{formatPercent(m.marginBp ?? 0)}</span>
                          </>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="num border-t-2 border-line bg-sand/50 font-bold">
                  <tr>
                    <th scope="row" className="px-5 py-3">Total</th>
                    <td className="px-3 py-3 text-right">{formatBRL(yearRep.salesCents)}</td>
                    <td className="px-3 py-3 text-right">{formatBRL(yearRep.receivedCents)}</td>
                    <td className="px-3 py-3 text-right">{formatBRL(yearRep.purchasesCents)}</td>
                    <td className="px-3 py-3 text-right">{formatBRL(yearRep.expensesCents)}</td>
                    <td className="px-5 py-3 text-right">{yearRep.monthsWithMargin > 0 ? formatBRL(yearRep.profitCents) : '—'}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </Card>

          <Button size="lg" full loading={busy} icon={<FileText className="h-5 w-5" aria-hidden />} onClick={() => void makePdf()}>
            Gerar relatório anual
          </Button>
        </div>
      )}
    </div>
  )
}
