import { cn } from '@/lib/cn'

interface SegmentedProps<T extends string> {
  options: { value: T; label: string }[]
  value: T
  onChange: (v: T) => void
  ariaLabel: string
  /** "pill": linhas rolável de chips (filtros) · "tabs": controle em bloco com 2–3 opções */
  variant?: 'pill' | 'tabs'
}

export function Segmented<T extends string>({ options, value, onChange, ariaLabel, variant = 'pill' }: SegmentedProps<T>) {
  if (variant === 'tabs') {
    return (
      <div role="tablist" aria-label={ariaLabel} className="grid auto-cols-fr grid-flow-col rounded-2xl bg-sand p-1">
        {options.map((o) => (
          <button
            key={o.value}
            role="tab"
            type="button"
            aria-selected={value === o.value}
            onClick={() => onChange(o.value)}
            className={cn(
              'min-h-11 rounded-xl px-4 text-[15px] font-semibold transition-all',
              value === o.value ? 'bg-card text-ink shadow-card' : 'text-muted hover:text-ink',
            )}
          >
            {o.label}
          </button>
        ))}
      </div>
    )
  }
  return (
    <div role="group" aria-label={ariaLabel} className="scrollbar-none -mx-4 flex gap-2 overflow-x-auto px-4 md:mx-0 md:px-0">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          aria-pressed={value === o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            'min-h-10 shrink-0 rounded-full border px-4 text-[14px] font-semibold transition-colors',
            value === o.value
              ? 'border-ink bg-ink text-paper'
              : 'border-line bg-card text-muted hover:bg-sand hover:text-ink',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}
