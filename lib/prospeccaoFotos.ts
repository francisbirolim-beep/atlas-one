import { usuarioAtual } from '@/lib/auth'
import { supabase } from '@/lib/supabase'

const BUCKET = 'prospeccao-fotos'
const TIPOS = ['image/jpeg', 'image/png', 'image/webp']
const MAX_BYTES = 6 * 1024 * 1024

export interface FotoProspeccao {
  nome: string
  url: string
}

async function pastaDaProspeccao(id: string) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) throw Error('Identificador da prospecção inválido.')
  const usuario = await usuarioAtual()
  if (!usuario?.empresa_id) throw Error('Empresa da sessão não identificada.')
  return usuario.empresa_id + '/' + id
}

export async function anexarFotosProspeccao(id: string, arquivos: File[]) {
  if (!arquivos.length) return
  const pasta = await pastaDaProspeccao(id)
  for (const arquivo of arquivos) {
    if (!TIPOS.includes(arquivo.type)) throw Error('Use fotos JPG, PNG ou WebP.')
    if (arquivo.size > MAX_BYTES) throw Error('Cada foto deve ter no máximo 6 MB.')
    const extensao = arquivo.type === 'image/png' ? 'png' : arquivo.type === 'image/webp' ? 'webp' : 'jpg'
    const caminho = pasta + '/' + crypto.randomUUID() + '.' + extensao
    const { error } = await supabase.storage.from(BUCKET).upload(caminho, arquivo, {
      contentType: arquivo.type, cacheControl: '3600', upsert: false,
    })
    if (error) throw Error('Não foi possível enviar a foto: ' + error.message)
  }
}

/** Somente URLs temporárias para arquivos privados, verificadas pelas políticas do Storage. */
export async function listarFotosProspeccao(id: string): Promise<FotoProspeccao[]> {
  const pasta = await pastaDaProspeccao(id)
  const { data, error } = await supabase.storage.from(BUCKET)
    .list(pasta, { limit: 100, sortBy: { column: 'created_at', order: 'desc' } })
  if (error) throw Error('Não foi possível consultar as fotos: ' + error.message)
  const arquivos = (data || []).filter(item => /\.(jpe?g|png|webp)$/i.test(item.name))
  return (await Promise.all(arquivos.map(async item => {
    const { data: foto, error: erro } = await supabase.storage.from(BUCKET)
      .createSignedUrl(pasta + '/' + item.name, 600)
    if (erro || !foto?.signedUrl) return null
    return { nome: item.name, url: foto.signedUrl }
  }))).filter((item): item is FotoProspeccao => item != null)
}
