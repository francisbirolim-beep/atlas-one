import { supabaseAdmin } from './supabaseAdmin'

export type AnexoStorage = {
  titulo?: string | null
  nome?: string | null
  url?: string | null
  storage_bucket?: string | null
  storage_path?: string | null
  acesso?: 'interno' | 'cliente' | null
  [key: string]: unknown
}

export function anexoTemArquivo(anexo: AnexoStorage | null | undefined): boolean {
  return !!(anexo?.storage_bucket && anexo?.storage_path) || !!anexo?.url
}

export function anexoEhPdf(anexo: AnexoStorage | null | undefined): boolean {
  if (!anexo) return false
  const nome = String(anexo.nome || '').toLowerCase()
  const storagePath = String(anexo.storage_path || '').toLowerCase().split('?')[0].split('#')[0]
  const url = String(anexo.url || '').toLowerCase().split('?')[0].split('#')[0]
  return nome.endsWith('.pdf') || storagePath.endsWith('.pdf') || url.endsWith('.pdf')
}

export async function baixarAnexoPrivadoOuLegado(anexo: AnexoStorage): Promise<Buffer> {
  if (anexo.storage_bucket && anexo.storage_path) {
    const { data, error } = await supabaseAdmin.storage
      .from(anexo.storage_bucket)
      .download(anexo.storage_path)
    if (error || !data) throw new Error('Não foi possível baixar o anexo privado.')
    return Buffer.from(await data.arrayBuffer())
  }

  if (!anexo.url) throw new Error('Anexo sem localização de arquivo.')
  const resposta = await fetch(anexo.url, { cache: 'no-store' })
  if (!resposta.ok) throw new Error('Não foi possível baixar o anexo legado.')
  return Buffer.from(await resposta.arrayBuffer())
}

export async function urlTemporariaAnexo(anexo: AnexoStorage, expiresIn = 600): Promise<string | null> {
  if (anexo.storage_bucket && anexo.storage_path) {
    const { data, error } = await supabaseAdmin.storage
      .from(anexo.storage_bucket)
      .createSignedUrl(anexo.storage_path, expiresIn)
    if (error) return null
    return data?.signedUrl || null
  }
  return anexo.url || null
}
