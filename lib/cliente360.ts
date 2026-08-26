import { supabase } from './supabase'
import { usuarioAtual } from './auth'
import { uploadArquivo } from './upload'

export interface ObraCliente360 {
  id: string
  numero: number
  cliente_id: string
  nome: string
  status: string
  endereco?: string | null
  numero_endereco?: string | null
  complemento?: string | null
  bairro?: string | null
  cidade?: string | null
  uf?: string | null
  cep?: string | null
  responsavel?: string | null
  data_inicio?: string | null
  previsao_entrega?: string | null
  observacoes?: string | null
  created_at: string
  updated_at: string
}

export interface ContaReceberCliente360 {
  id: string
  cliente_id?: string | null
  cliente_nome?: string | null
  obra_id?: string | null
  orcamento_id?: string | null
  venda_balcao_id?: string | null
  documento?: string | null
  parcela: number
  total_parcelas: number
  data_emissao: string
  vencimento?: string | null
  valor: number
  valor_pago?: number | null
  status: string
  forma?: string | null
  data_pagamento?: string | null
  observacoes?: string | null
  created_at: string
}

export interface RecebimentoCliente360 {
  id: string
  cliente_id: string
  cliente_nome: string
  obra_id?: string | null
  data_recebimento: string
  valor: number
  forma?: string | null
  referencia?: string | null
  observacoes?: string | null
  status: string
  criado_por_nome?: string | null
  created_at: string
}

export interface AlocacaoRecebimento360 {
  id: string
  recebimento_id: string
  conta_receber_id?: string | null
  obra_id?: string | null
  tipo: string
  valor: number
  created_at: string
}

export interface DocumentoCliente360 {
  id: string
  cliente_id: string
  obra_id?: string | null
  titulo: string
  nome_arquivo?: string | null
  url: string
  tipo?: string | null
  observacoes?: string | null
  criado_por_nome?: string | null
  created_at: string
}

export interface NovaObraCliente360 {
  nome: string
  status?: string
  endereco?: string
  numero_endereco?: string
  complemento?: string
  bairro?: string
  cidade?: string
  uf?: string
  cep?: string
  responsavel?: string
  data_inicio?: string
  previsao_entrega?: string
  observacoes?: string
}

export async function listarObrasCliente(clienteId: string): Promise<ObraCliente360[]> {
  const { data, error } = await supabase
    .from('obras')
    .select('*')
    .eq('cliente_id', clienteId)
    .order('created_at', { ascending: false })
  if (error) {
    console.error('Erro ao listar obras do cliente', error)
    return []
  }
  return (data || []) as ObraCliente360[]
}

export async function criarObraCliente(clienteId: string, dados: NovaObraCliente360): Promise<{ ok: boolean; obra?: ObraCliente360; error?: string }> {
  if (!dados.nome.trim()) return { ok: false, error: 'Informe o nome da obra.' }
  const usuario = await usuarioAtual()
  const { data, error } = await supabase
    .from('obras')
    .insert({
      cliente_id: clienteId,
      nome: dados.nome.trim(),
      status: dados.status || 'planejamento',
      endereco: dados.endereco?.trim() || null,
      numero_endereco: dados.numero_endereco?.trim() || null,
      complemento: dados.complemento?.trim() || null,
      bairro: dados.bairro?.trim() || null,
      cidade: dados.cidade?.trim() || null,
      uf: dados.uf?.trim().toUpperCase() || null,
      cep: dados.cep?.trim() || null,
      responsavel: dados.responsavel?.trim() || null,
      data_inicio: dados.data_inicio || null,
      previsao_entrega: dados.previsao_entrega || null,
      observacoes: dados.observacoes?.trim() || null,
      criado_por_id: usuario?.id || null,
      criado_por_nome: usuario?.nome || null,
    })
    .select('*')
    .single()
  if (error) return { ok: false, error: error.message }
  return { ok: true, obra: data as ObraCliente360 }
}

export async function atualizarObraCliente(obraId: string, dados: Partial<NovaObraCliente360>): Promise<{ ok: boolean; error?: string }> {
  const patch: Record<string, unknown> = { ...dados }
  Object.keys(patch).forEach(chave => {
    if (typeof patch[chave] === 'string') {
      const valor = String(patch[chave]).trim()
      patch[chave] = valor || null
    }
  })
  const { error } = await supabase.from('obras').update(patch).eq('id', obraId)
  return error ? { ok: false, error: error.message } : { ok: true }
}

export async function listarContasReceberCliente(clienteId: string): Promise<ContaReceberCliente360[]> {
  const { data, error } = await supabase
    .from('financeiro_contas_receber')
    .select('*')
    .eq('cliente_id', clienteId)
    .order('vencimento', { ascending: true })
  if (error) {
    console.error('Erro ao listar contas a receber do cliente', error)
    return []
  }
  return (data || []) as ContaReceberCliente360[]
}

export async function listarRecebimentosCliente(clienteId: string): Promise<RecebimentoCliente360[]> {
  const { data, error } = await supabase
    .from('financeiro_recebimentos')
    .select('*')
    .eq('cliente_id', clienteId)
    .order('data_recebimento', { ascending: false })
    .order('created_at', { ascending: false })
  if (error) {
    console.error('Erro ao listar recebimentos do cliente', error)
    return []
  }
  return (data || []) as RecebimentoCliente360[]
}

export async function listarAlocacoesCliente(recebimentoIds: string[]): Promise<AlocacaoRecebimento360[]> {
  if (!recebimentoIds.length) return []
  const { data, error } = await supabase
    .from('financeiro_recebimento_alocacoes')
    .select('*')
    .in('recebimento_id', recebimentoIds)
    .order('created_at', { ascending: true })
  if (error) {
    console.error('Erro ao listar alocações de recebimentos', error)
    return []
  }
  return (data || []) as AlocacaoRecebimento360[]
}

export async function registrarRecebimentoCliente(dados: {
  clienteId: string
  clienteNome: string
  valor: number
  dataRecebimento?: string
  forma?: string
  referencia?: string
  observacoes?: string
  obraId?: string | null
}): Promise<{ ok: boolean; recebimento?: RecebimentoCliente360; error?: string }> {
  if (!Number.isFinite(dados.valor) || dados.valor <= 0) return { ok: false, error: 'Informe um valor recebido válido.' }
  const usuario = await usuarioAtual()
  const { data, error } = await supabase
    .from('financeiro_recebimentos')
    .insert({
      cliente_id: dados.clienteId,
      cliente_nome: dados.clienteNome,
      obra_id: dados.obraId || null,
      data_recebimento: dados.dataRecebimento || new Date().toISOString().slice(0, 10),
      valor: dados.valor,
      forma: dados.forma || null,
      referencia: dados.referencia?.trim() || null,
      observacoes: dados.observacoes?.trim() || null,
      criado_por_id: usuario?.id || null,
      criado_por_nome: usuario?.nome || null,
    })
    .select('*')
    .single()

  if (error) return { ok: false, error: error.message }

  const recebimento = data as RecebimentoCliente360
  if (dados.obraId) {
    const alocado = await alocarRecebimentoEmObra(recebimento.id, dados.obraId, dados.valor)
    if (!alocado.ok) return { ok: false, recebimento, error: alocado.error }
  }

  return { ok: true, recebimento }
}

export async function alocarRecebimentoEmObra(recebimentoId: string, obraId: string, valor: number): Promise<{ ok: boolean; error?: string }> {
  const usuario = await usuarioAtual()
  const { error } = await supabase.rpc('alocar_recebimento_cliente_em_obra', {
    p_recebimento_id: recebimentoId,
    p_obra_id: obraId,
    p_valor: valor,
    p_usuario_id: usuario?.id || null,
    p_usuario_nome: usuario?.nome || null,
  })
  return error ? { ok: false, error: error.message } : { ok: true }
}

export async function listarDocumentosCliente(clienteId: string): Promise<DocumentoCliente360[]> {
  const { data, error } = await supabase
    .from('cliente_documentos')
    .select('*')
    .eq('cliente_id', clienteId)
    .order('created_at', { ascending: false })
  if (error) {
    console.error('Erro ao listar documentos do cliente', error)
    return []
  }
  return (data || []) as DocumentoCliente360[]
}

export async function adicionarDocumentoCliente(dados: {
  clienteId: string
  obraId?: string | null
  titulo: string
  arquivo: File
  tipo?: string
  observacoes?: string
}): Promise<{ ok: boolean; documento?: DocumentoCliente360; error?: string }> {
  if (!dados.titulo.trim()) return { ok: false, error: 'Informe o título do documento.' }
  const url = await uploadArquivo(dados.arquivo)
  if (!url) return { ok: false, error: 'Não foi possível enviar o arquivo.' }
  const usuario = await usuarioAtual()
  const { data, error } = await supabase
    .from('cliente_documentos')
    .insert({
      cliente_id: dados.clienteId,
      obra_id: dados.obraId || null,
      titulo: dados.titulo.trim(),
      nome_arquivo: dados.arquivo.name,
      url,
      tipo: dados.tipo || null,
      observacoes: dados.observacoes?.trim() || null,
      criado_por_id: usuario?.id || null,
      criado_por_nome: usuario?.nome || null,
    })
    .select('*')
    .single()
  if (error) return { ok: false, error: error.message }
  return { ok: true, documento: data as DocumentoCliente360 }
}
