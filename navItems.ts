import { ChartColumn, History, House, Users, type LucideIcon } from 'lucide-react'
import { paths } from '@/hooks/useRoute'

export type TabId = 'home' | 'history' | 'reports' | 'customers'

export const NAV_ITEMS: { id: TabId; label: string; icon: LucideIcon; href: string }[] = [
  { id: 'home', label: 'Início', icon: House, href: paths.home },
  { id: 'history', label: 'Histórico', icon: History, href: paths.history },
  { id: 'reports', label: 'Relatórios', icon: ChartColumn, href: paths.reports },
  { id: 'customers', label: 'Clientes', icon: Users, href: paths.customers },
]
