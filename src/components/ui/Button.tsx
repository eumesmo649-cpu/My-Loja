import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { LoaderCircle } from 'lucide-react'
import { cn } from '@/lib/cn'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'soft'
type Size = 'md' | 'lg' | 'sm'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
  loading?: boolean
  full?: boolean
  icon?: ReactNode
}

const variants: Record<Variant, string> = {
  primary: 'bg-brand-600 text-white hover:bg-brand-700 active:bg-brand-700 disabled:bg-brand-200',
  secondary: 'border border-line bg-card text-ink hover:bg-sand active:bg-sand disabled:text-faint',
  soft: 'bg-brand-50 text-brand-700 hover:bg-brand-100 active:bg-brand-100 disabled:text-faint',
  ghost: 'text-muted hover:bg-sand hover:text-ink active:bg-sand',
  danger: 'bg-danger-600 text-white hover:bg-danger-700 active:bg-danger-700 disabled:bg-danger-100',
}

const sizes: Record<Size, string> = {
  sm: 'min-h-10 rounded-xl px-3.5 text-sm',
  md: 'min-h-12 rounded-2xl px-5 text-base',
  lg: 'min-h-14 rounded-2xl px-6 text-[17px]',
}

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  full = false,
  icon,
  className,
  children,
  disabled,
  type = 'button',
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cn(
        'inline-flex select-none items-center justify-center gap-2 font-semibold transition-colors duration-150 active:scale-[0.99]',
        variants[variant],
        sizes[size],
        full && 'w-full',
        className,
      )}
      {...rest}
    >
      {loading ? <LoaderCircle className="h-5 w-5 animate-spin-slow" aria-hidden /> : icon}
      {children}
    </button>
  )
}
