import { Banknote, CreditCard, Landmark, NotebookPen, QrCode, type LucideIcon } from 'lucide-react'
import type { PaymentMethod } from '@/types'
import { METHOD_LABEL } from '@/domain/methods'
import { cn } from '@/lib/cn'

export const METHOD_ICON: Record<PaymentMethod, LucideIcon> = {
  PIX: QrCode,
  CASH: Banknote,
  DEBIT: Landmark,
  CREDIT: CreditCard,
  FICHA: NotebookPen,
}

interface MethodPickerProps {
  label?: string
  value: PaymentMethod | null
  onChange: (m: PaymentMethod) => void
  methods: PaymentMethod[]
  error?: string
}

export function MethodPicker({ label = 'Forma de pagamento', value, onChange, methods, error }: MethodPickerProps) {
  return (
    <div>
      <p id="method-label" className="text-sm font-semibold text-muted">
        {label}
      </p>
      <div
        role="radiogroup"
        aria-labelledby="method-label"
        className={cn('mt-2 grid gap-2', methods.length === 4 ? 'grid-cols-2' : 'grid-cols-3')}
      >
        {methods.map((m) => {
          const Icon = METHOD_ICON[m]
          const selected = value === m
          return (
            <button
              key={m}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => onChange(m)}
              className={cn(
                'flex min-h-[60px] flex-col items-center justify-center gap-1 rounded-2xl border px-2 py-2 text-[14px] font-semibold transition-colors',
                m === 'FICHA' && methods.length === 5 && 'col-span-1',
                selected
                  ? 'border-brand-600 bg-brand-50 text-brand-700 ring-2 ring-brand-600/20'
                  : 'border-line bg-card text-ink hover:bg-sand',
              )}
            >
              <Icon className="h-5 w-5" aria-hidden />
              {METHOD_LABEL[m]}
            </button>
          )
        })}
      </div>
      {error && (
        <p role="alert" className="mt-2 text-sm font-medium text-danger-600">
          {error}
        </p>
      )}
    </div>
  )
}
