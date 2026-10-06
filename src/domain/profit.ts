import { parseMoneyToCents } from '@/lib/money'

/**
 * Lucro ESTIMADO. Não temos o custo por peça, então a loja informa um percentual de
 * lucro sobre o total VENDIDO no mês (ex.: 35%). O percentual é guardado como inteiro em
 * centésimos de ponto percentual ("basis points"): 35% = 3500, 32,5% = 3250. Sem floats.
 *
 * Obs.: o percentual já considera o custo das peças; por isso as compras de mercadoria NÃO
 * são descontadas de novo. Já as despesas (aluguel, energia...) são descontadas à parte.
 */

export const MAX_MARGIN_BP = 10000 // 100%

export function marginKey(year: number, month0: number): string {
  return `${year}-${String(month0 + 1).padStart(2, '0')}`
}

/** vendas × percentual, arredondado ao centavo. */
export function estimatedProfitCents(salesCents: number, marginBp: number): number {
  return Math.round((salesCents * marginBp) / 10000)
}

/** "35" / "32,5" -> 3500 / 3250. Vazio -> null (sem percentual). Inválido -> 'invalid'. */
export function parsePercentToBp(text: string): number | null | 'invalid' {
  const cleaned = text.replace('%', '').trim()
  if (cleaned === '') return null
  const bp = parseMoneyToCents(cleaned)
  if (bp === null || bp < 0 || bp > MAX_MARGIN_BP) return 'invalid'
  return bp
}

/** 3500 -> "35%"; 3250 -> "32,5%"; 3205 -> "32,05%" */
export function formatPercent(bp: number): string {
  if (bp % 100 === 0) return `${bp / 100}%`
  const text = (bp / 100).toFixed(2).replace('.', ',')
  return `${text.endsWith('0') ? text.slice(0, -1) : text}%`
}

/** 3500 -> "35"; 3250 -> "32,5" (para preencher o campo) */
export function bpToInput(bp: number): string {
  return formatPercent(bp).replace('%', '')
}

/** Percentual mais recente definido ANTES do mês informado (para sugerir no mês novo). */
export function lastMarginBefore(
  margins: Record<string, number>,
  year: number,
  month0: number,
): { key: string; bp: number } | null {
  const current = marginKey(year, month0)
  const keys = Object.keys(margins)
    .filter((k) => k < current)
    .sort()
  const key = keys[keys.length - 1]
  return key ? { key, bp: margins[key] } : null
}
