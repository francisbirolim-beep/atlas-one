import { supabase } from './supabase'
import { usuarioAtual } from './auth'
import { registrarHistorico } from './historico'

export type TipoRevisaoOrcamento = 'alteracao' | 'complemento'

export type RevisaoOrcamentoResumo = {
  id: string
  numero: number | null
  revisao_grupo_id: string
  revisao_versao: number
  revisao_atual: boolean
  revisao_origem_id: string | null
  revisao_tipo: TipoRevisaoOrcamento | null
  revisao_motivo: string | null
  revisao_criada_em: string | null
  revisao_criada_por_nome: string | null
  created_at: string
  status: string | null
  valor_estimado: number | null
  coluna_id: string | null
}

export async function listarRevisoesOrcamento(orcamentoId: string): Promise<RevisaoOrcamentoResumo[]> {
  const { data: origem } = await supabase
    .from('orcamentos')
    .select('id,revisao_grupo_id')
    .eq('id', orcamentoId)
    .maybeSingle()

  if (!origem) return []
  const grupoId = origem.revisao_grupo_id || origem.id

  const { data, error } = await supabase
    .from('orcamentos')
    .select('id,numero,revisao_grupo_id,revisao_versao,revisao_atual,revisao_origem_id,revisao_tipo,revisao_motivo,revisao_criada_em,revisao_criada_por_nome,created_at,status,valor_estimado,coluna_id')
    .eq('revisao_grupo_id', grupoId)
    .order('revisao_versao', { ascending: false })

  if (error) {
    console.error('Erro ao listar revisões do orçamento:', error)
    return []
  }
  return (data || []) as RevisaoOrcamentoResumo[]
}

export async function criarRevisaoOrcamento(params: {
  orcamentoId: string
  tipo: TipoRevisaoOrcamento
  motivo?: string
}): Promise<{ ok: boolean; id?: string; error?: string }> {
  const usuario = await usuarioAtual()
  const { data, error } = await supabase.rpc('criar_revisao_orcamento', {
    p_orcamento_id: params.orcamentoId,
    p_tipo: params.tipo,
    p_motivo: params.motivo?.trim() || null,
    p_usuario_id: usuario?.id || null,
    p_usuario_nome: usuario?.nome || null,
  })

  if (error || !data) {
    return { ok: false, error: error?.message || 'Não foi possível criar a nova versão do orçamento.' }
  }

  const novoId = String(data)
  await registrarHistorico(
    params.orcamentoId,
    usuario,
    `Solicitou ${params.tipo === 'complemento' ? 'complemento' : 'alteração'} do orçamento`,
    params.motivo?.trim() || 'Nova versão criada sem observação.'
  )
  await registrarHistorico(
    novoId,
    usuario,
    'Criou nova versão do orçamento',
    `Origem: ${params.orcamentoId}${params.motivo?.trim() ? ` · ${params.motivo.trim()}` : ''}`
  )

  return { ok: true, id: novoId }
}
