import { useCallback, useMemo, useState } from 'react'
import { centsToInputString, parseMoneyToCents } from '@/lib/money'

/** Estado de um campo de valor: guarda o texto digitado e expõe os centavos (null = inválido). */
export function useMoneyField(initialCents = 0) {
  const [text, setText] = useState(centsToInputString(initialCents))
  const cents = useMemo(() => parseMoneyToCents(text), [text])
  const set = useCallback((next: string) => setText(next), [])
  const setCents = useCallback((c: number) => setText(centsToInputString(c)), [])
  return { text, cents, set, setCents }
}
