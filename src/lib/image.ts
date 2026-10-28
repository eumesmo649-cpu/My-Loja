/** Reduz uma imagem escolhida (logo) para um quadrado de até `size` px e devolve um data URL JPEG/PNG leve. */
export async function fileToLogoDataUrl(file: File, size = 256): Promise<string> {
  if (!file.type.startsWith('image/')) throw new Error('Escolha um arquivo de imagem (PNG ou JPG).')
  if (file.size > 10 * 1024 * 1024) throw new Error('A imagem é muito grande (máx. 10 MB).')
  const url = URL.createObjectURL(file)
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image()
      i.onload = () => resolve(i)
      i.onerror = () => reject(new Error('Não foi possível ler essa imagem.'))
      i.src = url
    })
    const side = Math.min(img.naturalWidth, img.naturalHeight)
    if (!side) throw new Error('Não foi possível ler essa imagem.')
    const canvas = document.createElement('canvas')
    canvas.width = canvas.height = Math.min(size, side)
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('Não foi possível processar a imagem.')
    const sx = (img.naturalWidth - side) / 2
    const sy = (img.naturalHeight - side) / 2
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    ctx.drawImage(img, sx, sy, side, side, 0, 0, canvas.width, canvas.height)
    return canvas.toDataURL('image/jpeg', 0.85)
  } finally {
    URL.revokeObjectURL(url)
  }
}
