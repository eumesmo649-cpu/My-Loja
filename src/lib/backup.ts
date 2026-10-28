/** Download da cópia de segurança + lembrete semanal (tudo local, chave própria). */
const KEY = 'myloja:backup:v1'
export const BACKUP_REMIND_DAYS = 7

interface BackupMeta {
  lastAt?: string
  firstSeenAt?: string
  snoozeUntil?: string
}

export function readBackupMeta(): BackupMeta {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? (JSON.parse(raw) as BackupMeta) : {}
  } catch {
    return {}
  }
}

function write(patch: BackupMeta) {
  try {
    localStorage.setItem(KEY, JSON.stringify({ ...readBackupMeta(), ...patch }))
  } catch {
    /* sem armazenamento: o lembrete simplesmente não persiste */
  }
}

export function downloadBackup(json: string, now = new Date()) {
  const blob = new Blob([json], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `myloja-backup-${now.toISOString().slice(0, 10)}.json`
  a.click()
  URL.revokeObjectURL(url)
  write({ lastAt: now.toISOString(), snoozeUntil: undefined })
}

export function snoozeBackupReminder(days = 1, now = new Date()) {
  write({ snoozeUntil: new Date(now.getTime() + days * 86400000).toISOString() })
}

/** Deve lembrar? Só quando há dados e passou 1 semana desde a última cópia (ou desde que o app viu dados pela 1ª vez). */
export function shouldRemindBackup(hasData: boolean, now = new Date()): boolean {
  if (!hasData) return false
  const meta = readBackupMeta()
  if (!meta.lastAt && !meta.firstSeenAt) {
    write({ firstSeenAt: now.toISOString() })
    return false
  }
  if (meta.snoozeUntil && new Date(meta.snoozeUntil) > now) return false
  const base = new Date((meta.lastAt ?? meta.firstSeenAt) as string).getTime()
  return now.getTime() - base >= BACKUP_REMIND_DAYS * 86400000
}
