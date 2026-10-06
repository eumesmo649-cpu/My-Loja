import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react'
import { CircleAlert, CircleCheck, Info, X } from 'lucide-react'
import { cn } from '@/lib/cn'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'

/** Estado de interface global: bottom sheets, avisos (toasts) e confirmações. */

export type SheetState =
  | { kind: 'menu' }
  | { kind: 'sale'; customerId?: string }
  | { kind: 'payment'; customerId?: string }
  | { kind: 'purchase' }
  | { kind: 'customer' }
  | { kind: 'detail'; id: string }
  | { kind: 'edit'; id: string }
  | null

export interface ToastOptions {
  title: string
  description?: string
  kind?: 'success' | 'error' | 'info'
  action?: { label: string; onClick: () => void }
  durationMs?: number
}

interface ToastItem extends ToastOptions {
  id: number
}

export interface ConfirmOptions {
  title: string
  message?: string
  confirmLabel?: string
  cancelLabel?: string
  tone?: 'danger' | 'default'
}

interface UIValue {
  sheet: SheetState
  openSheet: (s: Exclude<SheetState, null>) => void
  closeSheet: () => void
  toast: (opts: ToastOptions) => void
  confirm: (opts: ConfirmOptions) => Promise<boolean>
}

const UIContext = createContext<UIValue | null>(null)

export function useUI(): UIValue {
  const ctx = useContext(UIContext)
  if (!ctx) throw new Error('useUI precisa estar dentro de <UIProvider>')
  return ctx
}

export function UIProvider({ children }: { children: ReactNode }) {
  const [sheet, setSheet] = useState<SheetState>(null)
  const [toasts, setToasts] = useState<ToastItem[]>([])
  const [confirmState, setConfirmState] = useState<(ConfirmOptions & { resolve: (v: boolean) => void }) | null>(null)
  const idRef = useRef(0)

  const openSheet = useCallback((s: Exclude<SheetState, null>) => setSheet(s), [])
  const closeSheet = useCallback(() => setSheet(null), [])

  const dismiss = useCallback((id: number) => setToasts((t) => t.filter((x) => x.id !== id)), [])

  const toast = useCallback(
    (opts: ToastOptions) => {
      const id = ++idRef.current
      setToasts((t) => [...t.slice(-2), { ...opts, id }])
      window.setTimeout(() => dismiss(id), opts.durationMs ?? (opts.action ? 7000 : 3600))
    },
    [dismiss],
  )

  const confirm = useCallback(
    (opts: ConfirmOptions) =>
      new Promise<boolean>((resolve) => {
        setConfirmState({ ...opts, resolve })
      }),
    [],
  )

  const answer = (value: boolean) => {
    confirmState?.resolve(value)
    setConfirmState(null)
  }

  const value = useMemo(() => ({ sheet, openSheet, closeSheet, toast, confirm }), [sheet, openSheet, closeSheet, toast, confirm])

  return (
    <UIContext.Provider value={value}>
      {children}
      <ToastViewport toasts={toasts} onDismiss={dismiss} />
      {confirmState && (
        <ConfirmDialog
          title={confirmState.title}
          message={confirmState.message}
          confirmLabel={confirmState.confirmLabel}
          cancelLabel={confirmState.cancelLabel}
          tone={confirmState.tone}
          onConfirm={() => answer(true)}
          onCancel={() => answer(false)}
        />
      )}
    </UIContext.Provider>
  )
}

function ToastViewport({ toasts, onDismiss }: { toasts: ToastItem[]; onDismiss: (id: number) => void }) {
  return (
    <div
      className="pointer-events-none fixed inset-x-0 top-0 z-[70] flex flex-col items-center gap-2 px-4 pt-safe"
      style={{ paddingTop: 'max(env(safe-area-inset-top), 12px)' }}
      role="status"
      aria-live="polite"
    >
      {toasts.map((t) => (
        <ToastCard key={t.id} toast={t} onDismiss={() => onDismiss(t.id)} />
      ))}
    </div>
  )
}

function ToastCard({ toast, onDismiss }: { toast: ToastItem; onDismiss: () => void }) {
  const kind = toast.kind ?? 'success'
  const Icon = kind === 'success' ? CircleCheck : kind === 'error' ? CircleAlert : Info
  return (
    <div
      className={cn(
        'pointer-events-auto flex w-full max-w-sm animate-toast-in items-center gap-3 rounded-2xl border bg-card py-3 pl-3.5 pr-2 shadow-lg shadow-ink/10',
        kind === 'error' ? 'border-danger-100' : 'border-line',
      )}
    >
      <span
        className={cn(
          'grid h-9 w-9 shrink-0 place-items-center rounded-full',
          kind === 'success' && 'bg-sage-50 text-sage-600',
          kind === 'error' && 'bg-danger-50 text-danger-600',
          kind === 'info' && 'bg-brand-50 text-brand-600',
        )}
      >
        <Icon className="h-5 w-5" aria-hidden />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[15px] font-semibold leading-tight">{toast.title}</p>
        {toast.description && <p className="num mt-0.5 break-words text-sm leading-snug text-muted">{toast.description}</p>}
      </div>
      {toast.action && (
        <button
          type="button"
          onClick={() => {
            toast.action!.onClick()
            onDismiss()
          }}
          className="shrink-0 rounded-lg px-2.5 py-2 text-sm font-semibold text-brand-600 hover:bg-brand-50"
        >
          {toast.action.label}
        </button>
      )}
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Fechar aviso"
        className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-faint hover:bg-sand hover:text-ink"
      >
        <X className="h-4 w-4" aria-hidden />
      </button>
    </div>
  )
}
