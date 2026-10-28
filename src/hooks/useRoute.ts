import { useSyncExternalStore } from 'react'

/** Roteamento minúsculo por hash (#/historico): funciona em PWA/hospedagem estática sem configuração. */

export type Route =
  | { name: 'home' }
  | { name: 'history' }
  | { name: 'reports' }
  | { name: 'customers' }
  | { name: 'customer'; id: string }
  | { name: 'closing' }
  | { name: 'settings' }
  | { name: 'trash' }
  | { name: 'privacy' }

export function parseHash(hash: string): Route {
  const path = hash.replace(/^#/, '').split('?')[0].replace(/\/+$/, '') || '/'
  if (path === '/historico') return { name: 'history' }
  if (path === '/relatorios') return { name: 'reports' }
  if (path === '/clientes') return { name: 'customers' }
  if (path.startsWith('/clientes/')) return { name: 'customer', id: decodeURIComponent(path.slice('/clientes/'.length)) }
  if (path === '/fechamento') return { name: 'closing' }
  if (path === '/ajustes') return { name: 'settings' }
  if (path === '/lixeira') return { name: 'trash' }
  if (path === '/privacidade') return { name: 'privacy' }
  return { name: 'home' }
}

function subscribe(cb: () => void) {
  window.addEventListener('hashchange', cb)
  return () => window.removeEventListener('hashchange', cb)
}
const getSnapshot = () => window.location.hash

export function useRoute(): Route {
  const hash = useSyncExternalStore(subscribe, getSnapshot, () => '')
  return parseHash(hash)
}

export function navigate(path: string) {
  window.location.hash = path
}

export const paths = {
  home: '#/',
  history: '#/historico',
  reports: '#/relatorios',
  customers: '#/clientes',
  customer: (id: string) => `#/clientes/${encodeURIComponent(id)}`,
  closing: '#/fechamento',
  settings: '#/ajustes',
  trash: '#/lixeira',
  privacy: '#/privacidade',
}

/** Rota "principal" para destacar a aba certa (cliente aberto conta como Clientes). */
export function tabOf(route: Route): 'home' | 'history' | 'reports' | 'customers' | null {
  switch (route.name) {
    case 'home':
      return 'home'
    case 'history':
      return 'history'
    case 'reports':
      return 'reports'
    case 'customers':
    case 'customer':
      return 'customers'
    default:
      return null
  }
}
