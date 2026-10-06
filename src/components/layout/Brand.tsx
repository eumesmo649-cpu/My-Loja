import { cn } from '@/lib/cn'

/** Marca simples: monograma + nome. */
export function Brand({ className }: { className?: string }) {
  return (
    <div className={cn('flex items-center gap-2.5', className)}>
      <span className="grid h-9 w-9 place-items-center rounded-xl bg-brand-600 text-lg font-extrabold text-paper" aria-hidden>
        M
      </span>
      <span className="text-xl font-extrabold tracking-tight">MyLoja</span>
    </div>
  )
}
