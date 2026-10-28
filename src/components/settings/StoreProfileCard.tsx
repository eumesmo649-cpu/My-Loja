import { useRef, useState } from 'react'
import { ImagePlus, X } from 'lucide-react'
import { useStore } from '@/store/StoreContext'
import { useUI } from '@/store/UIContext'
import { fileToLogoDataUrl } from '@/lib/image'
import { Button } from '@/components/ui/Button'
import { Card, SectionTitle } from '@/components/ui/Card'
import { TextField } from '@/components/ui/TextField'
import { StoreMark } from '@/components/layout/Brand'

/** Nome da loja, seu nome e logo: aparecem no topo do app e na tela de bloqueio. */
export function StoreProfileCard() {
  const store = useStore()
  const { toast } = useUI()
  const fileRef = useRef<HTMLInputElement>(null)
  const [owner, setOwner] = useState(store.settings.ownerName)
  const [storeName, setStoreName] = useState(store.settings.storeName)

  const save = () => {
    store.setOwnerName(owner)
    store.setStoreProfile({ storeName })
    toast({ title: 'Salvo' })
  }

  const onLogo = async (file: File | undefined) => {
    if (!file) return
    try {
      store.setStoreProfile({ logoDataUrl: await fileToLogoDataUrl(file) })
      toast({ title: 'Logo atualizada' })
    } catch (e) {
      toast({ kind: 'error', title: e instanceof Error ? e.message : 'Não foi possível usar essa imagem' })
    } finally {
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  const shownName = store.settings.storeName || 'MyLoja'
  return (
    <Card className="p-5">
      <SectionTitle>Minha loja</SectionTitle>
      <div className="mb-4 flex items-center gap-4">
        <StoreMark logo={store.settings.logoDataUrl} name={shownName} size="xl" />
        <div className="flex flex-col gap-2">
          <Button variant="secondary" size="sm" icon={<ImagePlus className="h-4 w-4" aria-hidden />} onClick={() => fileRef.current?.click()}>
            {store.settings.logoDataUrl ? 'Trocar logo' : 'Escolher logo'}
          </Button>
          {store.settings.logoDataUrl && (
            <Button variant="ghost" size="sm" icon={<X className="h-4 w-4" aria-hidden />} onClick={() => store.setStoreProfile({ logoDataUrl: null })}>
              Remover logo
            </Button>
          )}
          <input ref={fileRef} type="file" accept="image/*" className="sr-only" aria-label="Arquivo da logo" onChange={(e) => void onLogo(e.target.files?.[0])} />
        </div>
      </div>
      <div className="flex flex-col gap-3">
        <TextField label="Nome da loja" value={storeName} onChange={setStoreName} placeholder="Ex.: Loja da Maria" maxLength={40} />
        <TextField label="Como devemos te chamar?" value={owner} onChange={setOwner} placeholder="Ex.: Maria" maxLength={40} />
      </div>
      <p className="mt-3 text-sm text-muted">Aparecem no topo do app e na tela de bloqueio. Com a nuvem ligada, valem em todos os seus aparelhos.</p>
      <Button className="mt-4" onClick={save}>Salvar</Button>
    </Card>
  )
}
