/** Utilidades de dinheiro. Nunca use floats para somar valores: tudo em centavos inteiros. */

const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })
const plain = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

/** 3590 -> "R$ 35,90" */
export function formatBRL(cents: number): string {
  return brl.format(cents / 100).replace(/ /g, ' ')
}

/** 3590 -> "35,90" (sem símbolo) */
export function formatPlain(cents: number): string {
  return plain.format(cents / 100).replace(/ /g, ' ')
}

/** Versão curta para eixos de gráfico: 1250000 -> "12,5 mil" */
export function formatCompact(cents: number): string {
  const reais = cents / 100
  if (reais >= 1_000_000) return `${(reais / 1_000_000).toFixed(1).replace('.', ',')} mi`
  if (reais >= 1000) return `${(reais / 1000).toFixed(1).replace('.', ',').replace(',0', '')} mil`
  return String(Math.round(reais))
}

/**
 * Converte o que a pessoa digitou ("35", "35,9", "1.250,50", "R$ 12.5") em centavos.
 * Faz o parsing da string (sem float). Retorna null se for inválido; 0 para vazio.
 */
export function parseMoneyToCents(input: string): number | null {
  let s = input.replace(/R\$/gi, '').replace(/\s/g, '')
  if (s === '') return 0
  if (!/^[\d.,]+$/.test(s)) return null

  const lastComma = s.lastIndexOf(',')
  const lastDot = s.lastIndexOf('.')
  let intPart: string
  let decPart = ''

  if (lastComma !== -1 && lastDot !== -1) {
    // Os dois presentes: o que vier por último é o separador decimal.
    const decIdx = Math.max(lastComma, lastDot)
    intPart = s.slice(0, decIdx)
    decPart = s.slice(decIdx + 1)
  } else if (lastComma !== -1) {
    if (s.indexOf(',') !== lastComma) return null
    intPart = s.slice(0, lastComma)
    decPart = s.slice(lastComma + 1)
  } else if (lastDot !== -1) {
    const after = s.length - lastDot - 1
    if (s.indexOf('.') === lastDot && after >= 1 && after <= 2) {
      // "35.9" ou "35.90" -> decimal
      intPart = s.slice(0, lastDot)
      decPart = s.slice(lastDot + 1)
    } else {
      // "1.500" ou "1.250.000" -> milhar
      intPart = s
    }
  } else {
    intPart = s
  }

  intPart = intPart.replace(/[.,]/g, '')
  if (decPart.length > 2 || /[.,]/.test(decPart)) return null
  if (intPart === '' && decPart === '') return null
  if (intPart.length > 9) return null // protege contra números absurdos

  const reais = intPart === '' ? 0 : parseInt(intPart, 10)
  const cents = decPart === '' ? 0 : parseInt(decPart.padEnd(2, '0'), 10)
  return reais * 100 + cents
}

/** Centavos -> texto editável ("3590" -> "35,90"; "3500" -> "35"). */
export function centsToInputString(cents: number): string {
  if (!cents) return ''
  const reais = Math.floor(cents / 100)
  const rest = cents % 100
  return rest === 0 ? String(reais) : `${reais},${String(rest).padStart(2, '0')}`
}

export function sumCents(values: number[]): number {
  let total = 0
  for (const v of values) total += v
  return total
}
