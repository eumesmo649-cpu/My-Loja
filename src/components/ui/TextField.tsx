import { useId, type InputHTMLAttributes } from 'react'
import { cn } from '@/lib/cn'

interface TextFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'onChange'> {
  label: string
  value: string
  onChange: (v: string) => void
  error?: string
  optional?: boolean
}

export function TextField({ label, value, onChange, error, optional, className, ...rest }: TextFieldProps) {
  const id = useId()
  return (
    <div>
      <label htmlFor={id} className="text-sm font-semibold text-muted">
        {label}
        {optional && <span className="ml-1 font-normal text-faint">(opcional)</span>}
      </label>
      <input
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-err` : undefined}
        className={cn(
          'mt-2 min-h-[52px] w-full rounded-2xl border bg-card px-4 text-base outline-none transition-shadow placeholder:text-faint focus:ring-4',
          error ? 'border-danger-600 focus:ring-danger-100' : 'border-line focus:border-brand-500 focus:ring-brand-100',
          className,
        )}
        {...rest}
      />
      {error && (
        <p id={`${id}-err`} role="alert" className="mt-2 text-sm font-medium text-danger-600">
          {error}
        </p>
      )}
    </div>
  )
}
