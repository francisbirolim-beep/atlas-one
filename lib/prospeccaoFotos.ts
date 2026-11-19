import { usuarioAtual } from '@/lib/auth'
import { supabase } from '@/lib/supabase'

const BUCKET = 'prospeccao-fotos'
const TIPOS_PERMITIDOS: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/heic': 'heic',
  'image/heif': 'heif',
}

export const LIMITE_FOTO_BYTES = 10 * 1024 * 1024
export const LIMITE_FOTOS_POR_ENVIO = 12

export interface FotoProspeccao {
  id: string
  prospeccao_id: string
  arquivo_nome: string
  arquivo_path: string
  mime_type: string
  created_at: string
  url: string | null
}

export function validarFotoLocal(file: File): string | null {
  if (!TIPOS_PERMITIDOS[file.type]) return 'Use uma foto JPG, PNG, WebP ou HEIC.'
  if (file.size <= 0) return 'Esta foto está vazia.'
  if (file.size > LIMITE_FOTO_BYTES) return 'Cada foto deve ter até 10 MB.'
  return null
}

export async function listarFotosProspeccao(prospeccaoId: string): Promise<FotoProspeccao[]> {
  const { data, error } = await supabase
    .from('prospeccao_fotos')
    .select('id,prospeccao_id,arquivo_nome,arquivo_path,mime_type,created_at')
    .eq('prospeccao_id', prospeccaoId)
    .order('created_at', { ascending: false })
  if (error) throw new Error(error.message)

  return Promise.all((data || []).map(async foto => {
    const { data: link, error: erroUrl } = await supabase.storage
      .from(BUCKET)
      .createSignedUrl(foto.arquivo_path, 3600)
    return { ...foto, url: erroUrl ? null : (link?.signedUrl || null) } as FotoProspeccao
  }))
}

export async function enviarFotoProspeccao(
  prospeccaoId: string,
  arquivo: File
): Promise<{ ok: boolean; error?: string }> {
  const invalida = validarFotoLocal(arquivo)
  if (invalida) return { ok: false, error: invalida }

  const usuario = await usuarioAtual()
  if (!usuario?.id || !usuario.empresa_id) {
    return { ok: false, error: 'Sua sessão não possui empresa vinculada. Entre novamente.' }
  }

  const caminho = `${usuario.empresa_id}/${prospeccaoId}/${crypto.randomUUID()}.${TIPOS_PERMITIDOS[arquivo.type]}`
  const { error: erroUpload } = await supabase.storage.from(BUCKET).upload(caminho, arquivo, {
    contentType: arquivo.type,
    cacheControl: '3600',
    upsert: false,
  })
  if (erroUpload) return { ok: false, error: 'Não foi possível enviar a foto: ' + erroUpload.message }

  const { error: erroRegistro } = await supabase.from('prospeccao_fotos').insert({
    prospeccao_id: prospeccaoId,
    arquivo_path: caminho,
    arquivo_nome: arquivo.name.slice(0, 240) || 'Foto da obra',
    mime_type: arquivo.type,
    enviado_por: usuario.id,
  })
  if (erroRegistro) {
    await supabase.storage.from(BUCKET).remove([caminho])
    return { ok: false, error: 'Foto enviada, mas não vinculada ao registro: ' + erroRegistro.message }
  }

  return { ok: true }
}
