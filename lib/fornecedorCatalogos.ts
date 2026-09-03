import { supabase } from './supabase'
import { tokenAtual } from './auth'
import { v4 as uuidv4 } from 'uuid'

export type ResumoCatalogoFornecedor = {
  total: number
  vinculados: number
  criados: number
  revisar: number
}

export async function uploadDocumentoFornecedor(fornecedorId: string, file: File) {
  if (!file || file.size <= 0) throw new Error('Arquivo vazio.')
  if (file.size > 25 * 1024 * 1024) throw new Error('O arquivo deve ter no máximo 25 MB.')

  const ext = (file.name.split('.').pop() || 'bin').toLowerCase().replace(/[^a-z0-9]/g, '') || 'bin'
  const path = `fornecedores/${fornecedorId}/${uuidv4()}.${ext}`
  const { error } = await supabase.storage.from('fotos').upload(path, file, {
    contentType: file.type || undefined,
    cacheControl: '3600',
    upsert: false,
  })
  if (error) throw new Error(error.message)
  const { data } = supabase.storage.from('fotos').getPublicUrl(path)
  if (!data.publicUrl) throw new Error('Não foi possível gerar a URL do arquivo.')
  return data.publicUrl
}

export async function registrarDocumentoFornecedor(params: {
  fornecedorId: string
  file: File
  tipo?: string
}) {
  const url = await uploadDocumentoFornecedor(params.fornecedorId, params.file)
  const token = await tokenAtual()
  if (!token) throw new Error('Sessão expirada.')

  const resposta = await fetch(`/api/fornecedores/360/${params.fornecedorId}/documentos`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({
      acao: 'registrar_documento',
      tipo: params.tipo || 'catalogo',
      nome_arquivo: params.file.name,
      url,
      mime_type: params.file.type || null,
      tamanho_bytes: params.file.size,
    }),
  })
  const json = await resposta.json().catch(() => ({}))
  if (!resposta.ok) throw new Error(json.error || 'Não foi possível registrar o documento.')
  return json as { documento: any; resumo: ResumoCatalogoFornecedor; custo_modelo: number }
}

export async function importarAnaliseFornecedor(params: {
  fornecedorId: string
  documentoId: string
  itens: unknown[]
}) {
  const token = await tokenAtual()
  if (!token) throw new Error('Sessão expirada.')
  const resposta = await fetch(`/api/fornecedores/360/${params.fornecedorId}/documentos`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ acao: 'importar_analise', documento_id: params.documentoId, itens: params.itens }),
  })
  const json = await resposta.json().catch(() => ({}))
  if (!resposta.ok) throw new Error(json.error || 'Não foi possível importar a análise.')
  return json as { resumo: ResumoCatalogoFornecedor; custo_modelo: number }
}

export async function carregarCatalogosFornecedor(fornecedorId: string) {
  const token = await tokenAtual()
  if (!token) throw new Error('Sessão expirada.')
  const resposta = await fetch(`/api/fornecedores/360/${fornecedorId}/documentos`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
  })
  const json = await resposta.json().catch(() => ({}))
  if (!resposta.ok) throw new Error(json.error || 'Não foi possível carregar os catálogos.')
  return json as { documentos: any[]; itens: any[]; vinculos: any[] }
}
