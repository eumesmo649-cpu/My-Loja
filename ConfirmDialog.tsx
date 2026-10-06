import { Button } from './Button'
import { Sheet } from './Sheet'

interface ConfirmDialogProps {
  title: string
  message?: string
  confirmLabel?: string
  cancelLabel?: string
  tone?: 'danger' | 'default'
  onConfirm: () => void
  onCancel: () => void
}

/** Confirmação para ações que não têm volta fácil (excluir, apagar tudo...). */
export function ConfirmDialog({
  title,
  message,
  confirmLabel = 'Confirmar',
  cancelLabel = 'Cancelar',
  tone = 'default',
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  return (
    <Sheet title={title} onClose={onCancel} layer="dialog" hideClose>
      {message && <p className="mb-5 text-[15px] leading-relaxed text-muted">{message}</p>}
      <div className="flex flex-col gap-2.5">
        <Button variant={tone === 'danger' ? 'danger' : 'primary'} size="lg" full onClick={onConfirm}>
          {confirmLabel}
        </Button>
        <Button variant="ghost" size="lg" full onClick={onCancel} data-autofocus>
          {cancelLabel}
        </Button>
      </div>
    </Sheet>
  )
}
