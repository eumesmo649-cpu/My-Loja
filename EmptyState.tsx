import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'

interface EmptyStateProps {
  icon: LucideIcon
  title: string
  description?: string
  action?: ReactNode
}

export function EmptyState({ icon: Icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center px-6 py-10 text-center">
      <span className="grid h-14 w-14 place-items-center rounded-full bg-brand-50 text-brand-600">
        <Icon className="h-7 w-7" aria-hidden />
      </span>
      <p className="mt-4 text-lg font-bold tracking-tight">{title}</p>
      {description && <p className="mt-1 max-w-xs text-[15px] leading-relaxed text-muted">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  )
}

export function ErrorState({ title, description, action }: { title: string; description?: string; action?: ReactNode }) {
  return (
    <div role="alert" className="flex flex-col items-center px-6 py-10 text-center">
      <span className="grid h-14 w-14 place-items-center rounded-full bg-danger-50 text-danger-600 text-2xl font-bold" aria-hidden>
        !
      </span>
      <p className="mt-4 text-lg font-bold tracking-tight">{title}</p>
      {description && <p className="mt-1 max-w-sm text-[15px] leading-relaxed text-muted">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  )
}
