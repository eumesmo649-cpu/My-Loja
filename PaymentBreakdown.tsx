import type { PaymentMethod } from '@/types'
import { METHOD_LABEL, SALE_METHODS } from '@/domain/methods'
import { formatBRL } from '@/lib/money'
import { cn } from '@/lib/cn'
import { METHOD_ICON } from './ui/MethodPicker'

interface PaymentBreakdownProps {
  byMethod: Record<PaymentMethod, number>
  /** "grid": cartões compactos (Início) · "bars": barras proporcionais (relatórios) */
  variant?: 'grid' | 'bars'
  methods?: PaymentMethod[]
}

export function PaymentBreakdown({ byMethod, variant = 'grid', methods = SALE_METHODS }: PaymentBreakdownProps) {
  const total = methods.reduce((a, m) => a + byMethod[m], 0)

  if (variant === 'bars') {
    return (
      <ul className="flex flex-col gap-4">
        {methods.map((m) => {
          const Icon = METHOD_ICON[m]
          const pct = total > 0 ? (byMethod[m] / total) * 100 : 0
          return (
            <li key={m}>
              <div className="flex items-center justify-between gap-3">
                <span className="flex items-center gap-2 text-[15px] font-semibold">
                  <Icon className="h-4 w-4 text-muted" aria-hidden />
                  {METHOD_LABEL[m]}
                </span>
                <span className="num text-[15px] font-bold">
                  {formatBRL(byMethod[m])} <span className="font-medium text-muted">· {Math.round(pct)}%</span>
                </span>
              </div>
              <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-sand" aria-hidden>
                <div
                  className={cn('h-full rounded-full transition-[width] duration-500', m === 'FICHA' ? 'bg-clay-600/70' : 'bg-brand-500')}
                  style={{ width: `${pct}%` }}
                />
              </div>
            </li>
          )
        })}
      </ul>
    )
  }

  return (
    <ul className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
      {methods.map((m) => {
        const Icon = METHOD_ICON[m]
        return (
          <li
            key={m}
            className={cn(
              'rounded-2xl border border-line bg-card p-3.5',
              m === 'FICHA' && 'col-span-2 sm:col-span-1',
            )}
          >
            <div className="flex items-center gap-2 text-sm font-semibold text-muted">
              <Icon className="h-4 w-4" aria-hidden />
              {METHOD_LABEL[m]}
            </div>
            <p className={cn('num mt-1.5 text-xl font-bold leading-tight', byMethod[m] === 0 && 'text-faint')}>
              {formatBRL(byMethod[m])}
            </p>
          </li>
        )
      })}
    </ul>
  )
}
