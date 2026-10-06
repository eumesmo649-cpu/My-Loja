import type { Customer, PaymentMethod } from '@/types'

export type FieldErrors = Partial<Record<'amount' | 'customer' | 'method' | 'name', string>>

/** Teto de segurança para evitar digitação com zeros a mais (R$ 10 milhões). */
export const MAX_AMOUNT_CENTS = 1_000_000_000

export function validateAmount(cents: number | null): string | undefined {
  if (cents === null) return 'Digite um valor válido, como 35 ou 35,90.'
  if (cents < 0) return 'O valor não pode ser negativo.'
  if (cents === 0) return 'Digite um valor maior que zero.'
  if (cents > MAX_AMOUNT_CENTS) return 'Esse valor parece grande demais. Confira os zeros.'
  return undefined
}

export function validateSale(input: {
  amountCents: number | null
  method: PaymentMethod | null
  customerId?: string | null
}): FieldErrors {
  const errors: FieldErrors = {}
  const amountError = validateAmount(input.amountCents)
  if (amountError) errors.amount = amountError
  if (!input.method) errors.method = 'Escolha a forma de pagamento.'
  if (input.method === 'FICHA' && !input.customerId) {
    errors.customer = 'Escolha ou crie o cliente da ficha.'
  }
  return errors
}

export function validatePayment(input: {
  amountCents: number | null
  method: PaymentMethod | null
  customerId?: string | null
  balanceCents: number
}): { errors: FieldErrors; exceedsBalance: boolean } {
  const errors: FieldErrors = {}
  if (!input.customerId) errors.customer = 'Escolha o cliente que está pagando.'
  const amountError = validateAmount(input.amountCents)
  if (amountError) errors.amount = amountError
  if (!input.method || input.method === 'FICHA') errors.method = 'Escolha como o cliente pagou.'
  const exceedsBalance =
    !errors.amount && input.amountCents !== null && input.amountCents > Math.max(0, input.balanceCents)
  return { errors, exceedsBalance }
}

export function validatePurchase(input: {
  amountCents: number | null
  method: PaymentMethod | null
}): FieldErrors {
  const errors: FieldErrors = {}
  const amountError = validateAmount(input.amountCents)
  if (amountError) errors.amount = amountError
  if (!input.method || input.method === 'FICHA') errors.method = 'Escolha a forma de pagamento.'
  return errors
}

export function normalizeName(name: string): string {
  return name
    .trim()
    .replace(/\s+/g, ' ')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
}

export function validateCustomerName(name: string, existing: Customer[]): string | undefined {
  const trimmed = name.trim()
  if (trimmed.length < 2) return 'Digite o nome do cliente.'
  if (trimmed.length > 80) return 'O nome está muito longo.'
  const dup = existing.find((c) => !c.deletedAt && normalizeName(c.name) === normalizeName(trimmed))
  if (dup) return `Já existe um cliente chamado "${dup.name}".`
  return undefined
}

export function hasErrors(errors: FieldErrors): boolean {
  return Object.keys(errors).length > 0
}
