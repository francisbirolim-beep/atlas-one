import { supabaseAdmin } from '@/lib/supabaseAdmin'

export type TipoPendenciaCadastro =
  | 'cadastro_incompleto'
  | 'possivel_duplicidade'
  | 'vinculo_wvetro'

export type PrioridadePendenciaCadastro = 'baixa' | 'normal' | 'alta' | 'urgente'

export function nomeCadastroIncompleto(nome: unknown) {
  const valor = String(nome ?? '').trim().replace(/\s+/g, ' ')
  return Boolean(valor && !valor.includes(' ') && !/^teste/i.test(valor))
}

export async function registrarPendenciaCadastro(params: {
  empresaId: string
  tipo: TipoPendenciaCadastro
  chaveUnica: string
  titulo: string
  descricao?: string | null
  origem?: string
  clienteId?: string | null
  clienteCandidatoId?: string | null
  dados?: Record<string, unknown>
  prioridade?: PrioridadePendenciaCadastro
  criadoPorId?: string | null
  criadoPorNome?: string | null
}) {
  const { data: existente, error: erroBusca } = await supabaseAdmin
    .from('cadastro_pendencias')
    .select('id,status')
    .eq('empresa_id', params.empresaId)
    .eq('chave_unica', params.chaveUnica)
    .maybeSingle()

  if (erroBusca) throw erroBusca
  if (existente?.status === 'ignorada') return existente

  const payload = {
    empresa_id: params.empresaId,
    tipo: params.tipo,
    status: 'pendente',
    prioridade: params.prioridade || 'normal',
    titulo: params.titulo,
    descricao: params.descricao || null,
    origem: params.origem || 'atlas',
    chave_unica: params.chaveUnica,
    cliente_id: params.clienteId || null,
    cliente_candidato_id: params.clienteCandidatoId || null,
    dados: params.dados || {},
    criado_por_id: params.criadoPorId || null,
    criado_por_nome: params.criadoPorNome || null,
    atualizado_em: new Date().toISOString(),
    resolvido_em: null,
    resolvido_por_id: null,
    resolvido_por_nome: null,
  }

  if (existente?.id) {
    const { data, error } = await supabaseAdmin
      .from('cadastro_pendencias')
      .update(payload)
      .eq('id', existente.id)
      .eq('empresa_id', params.empresaId)
      .select('id,status')
      .single()
    if (error) throw error
    return data
  }

  const { data, error } = await supabaseAdmin
    .from('cadastro_pendencias')
    .insert(payload)
    .select('id,status')
    .single()
  if (error) throw error
  return data
}
