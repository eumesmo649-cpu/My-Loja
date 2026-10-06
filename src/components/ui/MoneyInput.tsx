import { useId } from 'react'
import { cn } from '@/lib/cn'

interface MoneyInputProps {
  label: string
  value: string
  onChange: (next: string) => void
  error?: string
  autoFocus?: boolean
  onEnter?: () => void
  hint?: string
}

/** Só deixa passar dígitos, vírgula e ponto (aceita "35", "35,90", "1.250,50"). */
function sanitize(raw: string): string {
  return raw.replace(/[^\d.,]/g, '').slice(0, 13)
}

/** Campo de valor grande, com teclado numérico no celular. */
export function MoneyInput({ label, value, onChange, error, autoFocus, onEnter, hint }: MoneyInputProps) {
  const id = useId()
  const errId = `${id}-err`
  return (
    <div>
      <label htmlFor={id} className="text-sm font-semibold text-muted">
        {label}
      </label>
      <div
        className={cn(
          'mt-2 flex items-baseline gap-2 rounded-2xl border bg-card px-4 py-3.5 transition-shadow focus-within:ring-4',
          error
            ? 'border-danger-600 focus-within:ring-danger-100'
            : 'border-line focus-within:border-brand-500 focus-within:ring-brand-100',
        )}
      >
        <span className="text-2xl font-semibold text-muted" aria-hidden>
          R$
        </span>
        <input
          id={id}
          data-autofocus={autoFocus ? '' : undefined}
          inputMode="decimal"
          autoComplete="off"
          enterKeyHint="done"
          placeholder="0,00"
          value={value}
          onChange={(e) => onChange(sanitize(e.target.value))}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && onEnter) {
              e.preventDefault()
              onEnter()
            }
          }}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errId : undefined}
          className="num min-w-0 flex-1 bg-transparent text-[40px] font-bold leading-tight outline-none placeholder:text-faint"
          style={{ fontSize: 40 }}
        />
      </div>
      {error ? (
        <p id={errId} role="alert" className="mt-2 text-sm font-medium text-danger-600">
          {error}
        </p>
      ) : (
        hint && <p className="mt-2 text-sm text-muted">{hint}</p>
      )}
    </div>
  )
}
