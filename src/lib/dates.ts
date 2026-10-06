/** Datas sempre no fuso LOCAL do aparelho (a loja fecha o dia no horário dela). */

const MONTHS = [
  'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro',
]
const MONTHS_SHORT = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']

const pad = (n: number) => String(n).padStart(2, '0')

/** "2026-10-05" no fuso local. */
export function dayKey(d: Date | string): string {
  const date = typeof d === 'string' ? new Date(d) : d
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

export function todayKey(now: Date = new Date()): string {
  return dayKey(now)
}

/** "2026-10" no fuso local. */
export function monthKey(d: Date | string): string {
  return dayKey(d).slice(0, 7)
}

/** Converte "YYYY-MM-DD" em Date local à meia-noite. */
export function dateFromKey(key: string): Date {
  const [y, m, d] = key.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export function addDays(key: string, delta: number): string {
  const d = dateFromKey(key)
  d.setDate(d.getDate() + delta)
  return dayKey(d)
}

export function startOfDayISO(key: string): string {
  return dateFromKey(key).toISOString()
}

/** Início do dia seguinte (limite superior exclusivo). */
export function endOfDayExclusiveISO(key: string): string {
  return dateFromKey(addDays(key, 1)).toISOString()
}

export function monthName(month0: number): string {
  return MONTHS[month0]
}

export function monthShort(month0: number): string {
  return MONTHS_SHORT[month0]
}

export function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

/** "05 de outubro" */
export function formatDayLong(d: Date | string): string {
  const date = typeof d === 'string' ? new Date(d) : d
  return `${pad(date.getDate())} de ${MONTHS[date.getMonth()]}`
}

/** "05/10" */
export function formatDayShort(d: Date | string): string {
  const date = typeof d === 'string' ? new Date(d) : d
  return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}`
}

/** "05/10/2026" */
export function formatDayFull(d: Date | string): string {
  const date = typeof d === 'string' ? new Date(d) : d
  return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()}`
}

/** "14:32" */
export function formatTime(d: Date | string): string {
  const date = typeof d === 'string' ? new Date(d) : d
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`
}

/** "Outubro de 2026" */
export function formatMonthYear(year: number, month0: number): string {
  return `${capitalize(MONTHS[month0])} de ${year}`
}

/** "Hoje", "Ontem" ou "04 de outubro". */
export function relativeDayLabel(key: string, now: Date = new Date()): string {
  const today = todayKey(now)
  if (key === today) return 'Hoje'
  if (key === addDays(today, -1)) return 'Ontem'
  const d = dateFromKey(key)
  const base = formatDayLong(d)
  return d.getFullYear() === now.getFullYear() ? base : `${base} de ${d.getFullYear()}`
}

export function greeting(now: Date = new Date()): string {
  const h = now.getHours()
  if (h < 12) return 'Bom dia'
  if (h < 18) return 'Boa tarde'
  return 'Boa noite'
}

/** Para <input type="date"> e <input type="time"> */
export function toDateInput(iso: string): string {
  return dayKey(iso)
}
export function toTimeInput(iso: string): string {
  return formatTime(iso)
}
export function fromDateTimeInputs(dateStr: string, timeStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number)
  const [hh, mm] = (timeStr || '00:00').split(':').map(Number)
  return new Date(y, m - 1, d, hh, mm, 0, 0).toISOString()
}
