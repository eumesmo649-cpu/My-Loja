import { useMemo } from 'react'
import { useStore } from '@/store/StoreContext'

/** Devolve uma função id -> nome do cliente (ou undefined). */
export function useCustomerLookup(): (id?: string | null) => string | undefined {
  const { customers } = useStore()
  const map = useMemo(() => new Map(customers.map((c) => [c.id, c.name])), [customers])
  return (id) => (id ? map.get(id) : undefined)
}
