import { CalendarCheck, Plus, Settings } from 'lucide-react'
import type { Route } from '@/hooks/useRoute'
import { paths } from '@/hooks/useRoute'
import { cn } from '@/lib/cn'
import { useUI } from '@/store/UIContext'
import { Brand } from './Brand'
import { NAV_ITEMS, type TabId } from './navItems'

function SideLink({ href, icon: Icon, label, active }: { href: string; icon: typeof Settings; label: string; active: boolean }) {
  return (
    <a
      href={href}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'flex min-h-11 items-center gap-3 rounded-xl px-3.5 text-[15px] font-semibold transition-colors',
        active ? 'bg-brand-50 text-brand-700' : 'text-muted hover:bg-sand hover:text-ink',
      )}
    >
      <Icon className="h-5 w-5" strokeWidth={active ? 2.4 : 2} aria-hidden />
      {label}
    </a>
  )
}

/** Navegação lateral (tablet/desktop). */
export function Sidebar({ active, route }: { active: TabId | null; route: Route }) {
  const { openSheet } = useUI()
  return (
    <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col border-r border-line bg-paper px-4 py-6 md:flex lg:w-64">
      <Brand className="px-2" />

      <button
        type="button"
        onClick={() => openSheet({ kind: 'menu' })}
        className="mt-7 flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-brand-600 px-4 text-base font-bold text-white shadow-float transition-colors hover:bg-brand-700"
      >
        <Plus className="h-5 w-5" strokeWidth={2.6} aria-hidden />
        Registrar
      </button>

      <nav aria-label="Principal" className="mt-6 flex flex-col gap-1">
        {NAV_ITEMS.map((item) => (
          <SideLink key={item.id} href={item.href} icon={item.icon} label={item.label} active={active === item.id} />
        ))}
      </nav>

      <div className="mt-auto flex flex-col gap-1 border-t border-line pt-4">
        <SideLink href={paths.closing} icon={CalendarCheck} label="Fechamento do dia" active={route.name === 'closing'} />
        <SideLink href={paths.settings} icon={Settings} label="Ajustes" active={route.name === 'settings'} />
      </div>
    </aside>
  )
}
