import { supabase } from './supabase'
import { v4 as uuidv4 } from 'uuid'

export async function uploadFoto(file: File): Promise<string | null> {
  const ext = file.name.split('.').pop()
  const path = `orcamentos/${uuidv4()}.${ext}`
  const { error } = await supabase.storage.from('fotos').upload(path, file)
  if (error) {
    console.error('Erro ao subir foto:', error)
    return null
  }
  const { data } = supabase.storage.from('fotos').getPublicUrl(path)
  return data.publicUrl
}

export async function uploadArquivo(file: File): Promise<string | null> {
  const ext = file.name.split('.').pop()
  const path = `anexos/${uuidv4()}.${ext}`
  const { error } = await supabase.storage.from('fotos').upload(path, file)
  if (error) {
    console.error('Erro ao subir arquivo:', error)
    return null
  }
  const { data } = supabase.storage.from('fotos').getPublicUrl(path)
  return data.publicUrl
}

// Foto do produto (Cadastro > Produtos), usada no catálogo e opcionalmente
// no PDF do Orçamento Balcão.
export async function uploadFotoProduto(file: File): Promise<string | null> {
  const ext = file.name.split('.').pop()
  const path = `produtos/${uuidv4()}.${ext}`
  const { error } = await supabase.storage.from('fotos').upload(path, file)
  if (error) {
    console.error('Erro ao subir foto do produto:', error)
    return null
  }
  const { data } = supabase.storage.from('fotos').getPublicUrl(path)
  return data.publicUrl
}
