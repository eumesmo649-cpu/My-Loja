import type { ReactNode } from 'react'
import { tabOf, useRoute } from '@/hooks/useRoute'
import { SheetHost } from '../SheetHost'
import { BottomNav } from './BottomNav'
import { Sidebar } from './Sidebar'
import { StatusBanners } from './StatusBanners'

export function AppShell({ children }: { children: ReactNode }) {
  const route = useRoute()
  const active = tabOf(route)
  return (
    <div className="min-h-dvh md:flex">
      <a
        href="#conteudo"
        className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[80] focus:rounded-xl focus:bg-ink focus:px-4 focus:py-2 focus:text-paper"
        onClick={(e) => {
          e.preventDefault()
          document.getElementById('conteudo')?.focus()
        }}
      >
        Pular para o conteúdo
      </a>
      <Sidebar active={active} route={route} />
      <div className="min-w-0 flex-1">
        <StatusBanners />
        <main
          id="conteudo"
          tabIndex={-1}
          className="mx-auto w-full max-w-5xl px-4 pt-5 outline-none md:px-8 md:pb-14 md:pt-10"
          style={{ paddingBottom: 'calc(7.5rem + env(safe-area-inset-bottom))' }}
        >
          {/* key: reinicia a animação suave a cada troca de tela */}
          <div key={route.name === 'customer' ? `c-${route.id}` : route.name} className="animate-page-in">
            {children}
          </div>
        </main>
      </div>
      <BottomNav active={active} />
      <SheetHost />
    </div>
  )
}
