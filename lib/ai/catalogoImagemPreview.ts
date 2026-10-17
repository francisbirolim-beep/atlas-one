// Armazenamento EXCLUSIVAMENTE local para a prévia da homologação.
// Não representa validação oficial, nem altera dados no Supabase.
export type ArmazenamentoImagem = Pick<Storage, 'getItem' | 'setItem'>

export function chaveImagemCatalogoPreview(usuarioId: string, candidatoId: string): string {
  if (!usuarioId || !candidatoId) throw new Error('Usuário e candidato são necessários.')
  return 'atlas:preview:catalogo:imagem:v1:' + usuarioId + ':' + candidatoId
}

type RegistroImagemPreview = {
  codigo: string
  imagem: string
  confirmado_em: string
}

export function salvarImagemCatalogoPreview(
  storage: ArmazenamentoImagem,
  usuarioId: string,
  candidatoId: string,
  codigo: string,
  imagem: string,
): RegistroImagemPreview {
  const codigoCanonico = String(codigo || '').trim().toUpperCase()
  if (!codigoCanonico || !/^data:image\/(?:jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(imagem)) {
    throw new Error('Imagem ou código inválido para a prévia.')
  }
  // Evita exceder a cota do navegador ao guardar imagens em base64.
  if (imagem.length > 2_000_000) {
    throw new Error('Imagem muito grande para esta prévia. Gere um recorte menor.')
  }
  const registro = { codigo: codigoCanonico, imagem, confirmado_em: new Date().toISOString() }
  storage.setItem(chaveImagemCatalogoPreview(usuarioId, candidatoId), JSON.stringify(registro))
  return registro
}

export function lerImagemCatalogoPreview(
  storage: Pick<Storage, 'getItem'>,
  usuarioId: string,
  candidatoId: string,
  codigo: string,
): RegistroImagemPreview | null {
  if (!usuarioId || !candidatoId || !codigo) return null
  try {
    const texto = storage.getItem(chaveImagemCatalogoPreview(usuarioId, candidatoId))
    if (!texto) return null
    const registro = JSON.parse(texto) as RegistroImagemPreview
    if (registro.codigo !== String(codigo).trim().toUpperCase()) return null
    if (!/^data:image\/(?:jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(registro.imagem)) return null
    return registro
  } catch {
    return null
  }
}
