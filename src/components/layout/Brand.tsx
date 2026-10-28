import { cn } from '@/lib/cn'
import { useStore } from '@/store/StoreContext'

const SIZES = {
  md: 'h-9 w-9 rounded-xl text-lg',
  xl: 'h-24 w-24 rounded-3xl text-5xl',
} as const

/** Logo da loja (se houver) ou um monograma com a inicial do nome. */
export function StoreMark({ logo, name, size = 'md' }: { logo?: string; name: string; size?: keyof typeof SIZES }) {
  if (logo) {
    return <img src={logo} alt="" className={cn('shrink-0 bg-card object-cover ring-1 ring-line', SIZES[size])} />
  }
  return (
    <span className={cn('grid shrink-0 place-items-center bg-brand-600 font-extrabold text-paper', SIZES[size])} aria-hidden>
      {name.trim().slice(0, 1).toUpperCase() || 'M'}
    </span>
  )
}

/** Marca: logo + nome da loja (ou "MyLoja" enquanto a loja não tiver nome). */
export function Brand({ className }: { className?: string }) {
  const { settings } = useStore()
  const name = settings.storeName || 'MyLoja'
  return (
    <div className={cn('flex min-w-0 items-center gap-2.5', className)}>
      <StoreMark logo={settings.logoDataUrl} name={name} />
      <span className="truncate text-xl font-extrabold tracking-tight">{name}</span>
    </div>
  )
}
