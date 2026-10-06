import { Plus } from 'lucide-react'
import { cn } from '@/lib/cn'
import { useUI } from '@/store/UIContext'
import { NAV_ITEMS, type TabId } from './navItems'

function NavLink({ item, active }: { item: (typeof NAV_ITEMS)[number]; active: boolean }) {
  const Icon = item.icon
  return (
    <a
      href={item.href}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'flex min-h-[64px] flex-col items-center justify-center gap-1 text-[12px] font-semibold transition-colors',
        active ? 'text-brand-600' : 'text-muted hover:text-ink',
      )}
    >
      <Icon className={cn('h-6 w-6 transition-transform', active && 'scale-110')} strokeWidth={active ? 2.4 : 2} aria-hidden />
      {item.label}
    </a>
  )
}

/** Navegação inferior (celular): 2 abas · botão + central · 2 abas. */
export function BottomNav({ active }: { active: TabId | null }) {
  const { openSheet } = useUI()
  const [home, history, reports, customers] = NAV_ITEMS
  return (
    <nav
      aria-label="Principal"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-paper/92 backdrop-blur-md md:hidden"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <div className="mx-auto grid max-w-lg grid-cols-5 items-center">
        <NavLink item={home} active={active === 'home'} />
        <NavLink item={history} active={active === 'history'} />
        <div className="flex justify-center">
          <button
            type="button"
            onClick={() => openSheet({ kind: 'menu' })}
            aria-label="Registrar movimentação"
            className="-mt-7 grid h-16 w-16 place-items-center rounded-full bg-brand-600 text-white shadow-float ring-4 ring-paper transition-transform hover:bg-brand-700 active:scale-95"
          >
            <Plus className="h-8 w-8" strokeWidth={2.6} aria-hidden />
          </button>
        </div>
        <NavLink item={reports} active={active === 'reports'} />
        <NavLink item={customers} active={active === 'customers'} />
      </div>
    </nav>
  )
}
