import { supabase } from '@/lib/supabase'

const BUCKET = 'prospeccao-fotos'
const MAX_BYTES = 10 * 1024 * 1024
const MAX_POR_ENVIO = 6
const MIME: Record<string, string> = {
  'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp',
  'image/heic': 'heic', 'image/heif': 'heif',
}
const MIME_POR_EXT: Record<string, string> = Object.fromEntries(
  Object.entries(MIME).map(([tipo, ext]) => [ext, tipo]),
)

export interface FotoProspeccao {
  nome: string
  url: string
  criadoEm: string | null
}

function mimeValido(arquivo: File): { mime: string; ext: string } | null {
  const extNome = arquivo.name.split('.').pop()?.toLowerCase() || ''
  const mime = MIME[arquivo.type] ? arquivo.type :
    arquivo.type === '' ? MIME_POR_EXT[extNome] : ''
  if (!mime) return null
  return { mime, ext: MIME[mime] }
}

export async function enviarFotosProspeccao(prospeccaoId: string, arquivos: File[]) {
  const falhas: string[] = []
  let enviadas = 0
  if (!/^[0-9a-f-]{36}$/i.test(prospeccaoId)) return { enviadas, falhas: ['Identificador da prospecção inválido.'] }
  if (arquivos.length > MAX_POR_ENVIO) return { enviadas, falhas: ['Selecione no máximo 6 fotos por envio.'] }

  for (const arquivo of arquivos) {
    const formato = mimeValido(arquivo)
    if (!formato) { falhas.push(arquivo.name + ': formato de imagem não permitido.'); continue }
    if (arquivo.size <= 0 || arquivo.size > MAX_BYTES) {
      falhas.push(arquivo.name + ': limite de 10 MB por foto.'); continue
    }
    const caminho = prospeccaoId + '/' + crypto.randomUUID() + '.' + formato.ext
    const { error } = await supabase.storage.from(BUCKET).upload(caminho, arquivo, {
      contentType: formato.mime,
      cacheControl: '3600',
      upsert: false,
    })
    if (error) falhas.push(arquivo.name + ': ' + error.message)
    else enviadas++
  }
  return { enviadas, falhas }
}

export async function listarFotosProspeccao(prospeccaoId: string): Promise<{ fotos: FotoProspeccao[]; erro: string | null }> {
  const { data, error } = await supabase.storage.from(BUCKET).list(prospeccaoId, {
    limit: 100,
    sortBy: { column: 'created_at', order: 'desc' },
  })
  if (error) return { fotos: [], erro: error.message }
  const assinadas = await Promise.all((data || []).filter(item => item.name !== '.emptyFolderPlaceholder').map(async item => {
    const { data: acesso, error: falha } = await supabase.storage.from(BUCKET)
      .createSignedUrl(prospeccaoId + '/' + item.name, 60 * 30)
    if (falha || !acesso?.signedUrl) return null
    return { nome: item.name, url: acesso.signedUrl, criadoEm: item.created_at || null }
  }))
  return { fotos: assinadas.filter((f): f is FotoProspeccao => f !== null), erro: null }
}
