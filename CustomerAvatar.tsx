import { cn } from '@/lib/cn'

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].slice(0, 1).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

export function CustomerAvatar({ name, size = 'md' }: { name: string; size?: 'md' | 'lg' }) {
  return (
    <span
      aria-hidden
      className={cn(
        'grid shrink-0 place-items-center rounded-full bg-brand-50 font-bold text-brand-700',
        size === 'md' ? 'h-11 w-11 text-[15px]' : 'h-16 w-16 text-xl',
      )}
    >
      {initials(name)}
    </span>
  )
}
