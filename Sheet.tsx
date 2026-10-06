import { useEffect, useId, useRef, type ReactNode } from 'react'
import { X } from 'lucide-react'
import { cn } from '@/lib/cn'

interface SheetProps {
  title: string
  onClose: () => void
  children: ReactNode
  /** "sheet": sobe do rodapé no celular e vira janela no desktop. "dialog": sempre centralizado e acima de tudo. */
  layer?: 'sheet' | 'dialog'
  /** Esconde o botão fechar (ex.: diálogos de confirmação) */
  hideClose?: boolean
  size?: 'md' | 'lg'
}

let scrollLocks = 0
/** Pilha de janelas abertas: a última é a que está no topo. */
const openSheets: symbol[] = []

const FOCUSABLE =
  'a[href],button:not([disabled]),textarea,input:not([disabled]),select,[tabindex]:not([tabindex="-1"])'

export function Sheet({ title, onClose, children, layer = 'sheet', hideClose, size = 'md' }: SheetProps) {
  const titleId = useId()
  const panelRef = useRef<HTMLDivElement>(null)
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose

  // trava o scroll do fundo
  useEffect(() => {
    scrollLocks += 1
    document.body.style.overflow = 'hidden'
    return () => {
      scrollLocks -= 1
      if (scrollLocks === 0) document.body.style.overflow = ''
    }
  }, [])

  // foco inicial, Esc e prisão de foco; devolve o foco ao fechar
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null
    const panel = panelRef.current
    const target = panel?.querySelector<HTMLElement>('[data-autofocus]') ?? panel
    // pequeno atraso: deixa a animação começar e abre o teclado no campo certo
    const t = window.setTimeout(() => target?.focus({ preventScroll: true }), 60)
    const me = Symbol('sheet')
    openSheets.push(me)

    const onKey = (e: KeyboardEvent) => {
      // só a janela do topo reage (um diálogo aberto sobre um sheet não fecha os dois)
      if (openSheets[openSheets.length - 1] !== me) return
      if (e.key === 'Escape') {
        onCloseRef.current()
      } else if (e.key === 'Tab' && panel) {
        const items = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((el) => el.offsetParent !== null)
        if (items.length === 0) return
        const first = items[0]
        const last = items[items.length - 1]
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault()
          last.focus()
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault()
          first.focus()
        }
      }
    }
    document.addEventListener('keydown', onKey)
    return () => {
      window.clearTimeout(t)
      const i = openSheets.indexOf(me)
      if (i !== -1) openSheets.splice(i, 1)
      document.removeEventListener('keydown', onKey)
      previous?.focus?.({ preventScroll: true })
    }
  }, [])

  const isDialog = layer === 'dialog'

  return (
    <div
      className={cn(
        'fixed inset-0 flex justify-center',
        isDialog ? 'z-[60] items-center p-5' : 'z-50 items-end md:items-center md:p-6',
      )}
    >
      <div className="absolute inset-0 animate-fade-in bg-ink/45" onClick={onClose} aria-hidden />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={cn(
          'relative flex w-full flex-col bg-paper shadow-sheet outline-none',
          size === 'lg' ? 'md:max-w-xl' : 'md:max-w-md',
          isDialog
            ? 'max-h-[85dvh] max-w-sm animate-pop rounded-3xl'
            : 'max-h-[94dvh] animate-sheet-up rounded-t-[28px] md:animate-pop md:rounded-3xl',
        )}
      >
        {!isDialog && <div className="mx-auto mt-2.5 h-1.5 w-10 shrink-0 rounded-full bg-line md:hidden" aria-hidden />}
        <div className="flex shrink-0 items-center justify-between gap-3 px-5 pb-1 pt-4 md:px-6 md:pt-5">
          <h2 id={titleId} className="text-xl font-bold tracking-tight">
            {title}
          </h2>
          {!hideClose && (
            <button
              type="button"
              onClick={onClose}
              aria-label="Fechar"
              className="-mr-2 grid h-11 w-11 place-items-center rounded-full text-muted hover:bg-sand hover:text-ink"
            >
              <X className="h-5 w-5" aria-hidden />
            </button>
          )}
        </div>
        <div className="overflow-y-auto overscroll-contain px-5 pb-5 pt-2 md:px-6 md:pb-6" style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 20px)' }}>
          {children}
        </div>
      </div>
    </div>
  )
}
