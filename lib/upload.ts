import { supabase } from './supabase'
import { v4 as uuidv4 } from 'uuid'

function extensaoSegura(file: File) {
  const peloNome = file.name.split('.').pop()?.toLowerCase().replace(/[^a-z0-9]/g, '')
  if (peloNome && peloNome.length <= 5) return peloNome === 'jpeg' ? 'jpg' : peloNome

  const porMime: Record<string, string> = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
    'image/heic': 'heic',
    'image/heif': 'heif',
  }
  return porMime[file.type] || 'jpg'
}

async function subir(bucketPath: string, file: File): Promise<string | null> {
  const ext = extensaoSegura(file)
  const path = `${bucketPath}/${uuidv4()}.${ext}`
  const contentType = file.type || (ext === 'png' ? 'image/png' : 'image/jpeg')
  const { error } = await supabase.storage.from('fotos').upload(path, file, {
    contentType,
    cacheControl: '3600',
    upsert: false,
  })
  if (error) {
    console.error(`Erro ao subir arquivo em ${bucketPath}:`, error)
    return null
  }
  const { data } = supabase.storage.from('fotos').getPublicUrl(path)
  return data.publicUrl || null
}

export async function uploadFoto(file: File): Promise<string | null> {
  return subir('orcamentos', file)
}

export async function uploadArquivo(file: File): Promise<string | null> {
  const ext = file.name.split('.').pop()?.toLowerCase().replace(/[^a-z0-9]/g, '') || 'bin'
  const path = `anexos/${uuidv4()}.${ext}`
  const { error } = await supabase.storage.from('fotos').upload(path, file, {
    contentType: file.type || undefined,
    cacheControl: '3600',
    upsert: false,
  })
  if (error) {
    console.error('Erro ao subir arquivo:', error)
    return null
  }
  const { data } = supabase.storage.from('fotos').getPublicUrl(path)
  return data.publicUrl || null
}

// Foto do produto (Cadastro > Produtos), usada no catálogo e opcionalmente
// no PDF do Orçamento Balcão.
export async function uploadFotoProduto(file: File): Promise<string | null> {
  return subir('produtos', file)
}
