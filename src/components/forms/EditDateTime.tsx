import { useId } from 'react'

interface EditDateTimeProps {
  date: string
  time: string
  onDate: (v: string) => void
  onTime: (v: string) => void
  error?: string
}

const inputClass =
  'mt-2 min-h-[52px] w-full rounded-2xl border border-line bg-card px-4 text-base outline-none focus:border-brand-500 focus:ring-4 focus:ring-brand-100'

/** Data e hora do lançamento (só aparece ao editar). */
export function EditDateTime({ date, time, onDate, onTime, error }: EditDateTimeProps) {
  const id = useId()
  return (
    <div>
      <div className="grid grid-cols-[3fr_2fr] gap-3">
        <div>
          <label htmlFor={`${id}-d`} className="text-sm font-semibold text-muted">
            Data
          </label>
          <input id={`${id}-d`} type="date" value={date} onChange={(e) => onDate(e.target.value)} className={inputClass} />
        </div>
        <div>
          <label htmlFor={`${id}-t`} className="text-sm font-semibold text-muted">
            Hora
          </label>
          <input id={`${id}-t`} type="time" value={time} onChange={(e) => onTime(e.target.value)} className={inputClass} />
        </div>
      </div>
      {error && (
        <p role="alert" className="mt-2 text-sm font-medium text-danger-600">
          {error}
        </p>
      )}
    </div>
  )
}
