import { supabase } from './supabase'
import { registrarEventoAprendizadoAtlas } from './ai/aprendizadoAtlas'

export type EtapaCadastroLinhaTecnica = 'dados_linha' | 'perfis' | 'acessorios' | 'tipologias' | 'formulacoes' | 'revisao'
export type StatusValidacaoLinhaTecnica = 'referencia_wvetro' | 'em_validacao' | 'validada'

export interface LinhaTecnica {
  id: string
  chave: string
  nome: string
  fabricante?: string | null
  descricao?: string | null
  apelidos: string[]
  ativo: boolean
  ordem: number
  origem_referencia?: 'atlas' | 'wvetro' | 'misto' | null
  status_validacao?: StatusValidacaoLinhaTecnica | null
  etapa_cadastro?: EtapaCadastroLinhaTecnica | null
  validada_em?: string | null
  validada_por_id?: string | null
  validada_por_nome?: string | null
  produto_ids?: string[]
  tipologia_ids?: string[]
}

export async function listarLinhasTecnicas(): Promise<LinhaTecnica[]> {
  const { data, error } = await supabase
    .from('linhas_tecnicas')
    .select('*, linha_produtos(produto_id), linha_tipologias(tipologia_id)')
    .order('ordem', { ascending: true })
    .order('nome', { ascending: true })

  if (error || !data) return []
  return data.map((linha: any) => ({
    ...linha,
    produto_ids: (linha.linha_produtos || []).map((r: any) => r.produto_id),
    tipologia_ids: (linha.linha_tipologias || []).map((r: any) => r.tipologia_id),
  })) as LinhaTecnica[]
}

function slugLinha(nome: string) {
  return nome.trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '')
}

export async function salvarLinhaTecnica(dados: {
  id?: string
  nome: string
  fabricante?: string
  descricao?: string
  apelidos?: string[]
  ativo?: boolean
  status_validacao?: StatusValidacaoLinhaTecnica
  etapa_cadastro?: EtapaCadastroLinhaTecnica
  produto_ids?: string[]
  tipologia_ids?: string[]
}): Promise<string> {
  const nova = !dados.id
  const payload = {
    nome: dados.nome.trim().toUpperCase(),
    fabricante: dados.fabricante?.trim().toUpperCase() || null,
    descricao: dados.descricao?.trim().toUpperCase() || null,
    apelidos: (dados.apelidos || []).map(a => a.trim().toUpperCase()).filter(Boolean),
    ativo: nova ? false : dados.ativo === true,
    status_validacao: dados.status_validacao || (nova ? 'em_validacao' : undefined),
    etapa_cadastro: dados.etapa_cadastro || (nova ? 'dados_linha' : undefined),
    updated_at: new Date().toISOString(),
  }

  let linhaId = dados.id
  if (linhaId) {
    const { error } = await supabase.from('linhas_tecnicas').update(payload).eq('id', linhaId)
    if (error) throw error
  } else {
    const { data: ultima } = await supabase.from('linhas_tecnicas').select('ordem').order('ordem', { ascending: false }).limit(1).maybeSingle()
    const { data, error } = await supabase.from('linhas_tecnicas').insert({
      ...payload,
      chave: slugLinha(dados.nome) || `linha_${Date.now()}`,
      ordem: (ultima?.ordem || 0) + 1,
      origem_referencia: 'atlas',
    }).select('id').single()
    if (error) throw error
    linhaId = data?.id
  }

  if (!linhaId) throw new Error('Não foi possível identificar a linha salva.')

  await supabase.from('linha_produtos').delete().eq('linha_id', linhaId)
  await supabase.from('linha_tipologias').delete().eq('linha_id', linhaId)

  if (dados.produto_ids?.length) {
    const { error } = await supabase.from('linha_produtos').insert(dados.produto_ids.map(produto_id => ({ linha_id: linhaId, produto_id })))
    if (error) throw error
  }
  if (dados.tipologia_ids?.length) {
    const { error } = await supabase.from('linha_tipologias').insert(dados.tipologia_ids.map(tipologia_id => ({ linha_id: linhaId, tipologia_id })))
    if (error) throw error
  }

  registrarEventoAprendizadoAtlas({
    dominio: 'linha_tecnica',
    tipo: dados.id ? 'linha_atualizada' : 'linha_criada',
    entidade_tipo: 'linha_tecnica',
    entidade_id: linhaId,
    contexto: {
      linha_id: linhaId,
      linha_nome: payload.nome,
      fabricante: payload.fabricante,
    },
    dados: {
      produto_ids: dados.produto_ids || [],
      tipologia_ids: dados.tipologia_ids || [],
      quantidade_produtos: dados.produto_ids?.length || 0,
      quantidade_tipologias: dados.tipologia_ids?.length || 0,
      etapa_cadastro: payload.etapa_cadastro || null,
      status_validacao: payload.status_validacao || null,
    },
    evidencia: 'observado',
  }).catch(() => {})

  return linhaId
}

export async function salvarEtapaLinhaTecnica(id: string, etapa: EtapaCadastroLinhaTecnica) {
  const resposta = await supabase.from('linhas_tecnicas').update({
    etapa_cadastro: etapa,
    status_validacao: 'em_validacao',
    ativo: false,
    updated_at: new Date().toISOString(),
  }).eq('id', id)
  if (!resposta.error) {
    registrarEventoAprendizadoAtlas({
      dominio: 'linha_tecnica',
      tipo: 'etapa_cadastro_atualizada',
      entidade_tipo: 'linha_tecnica',
      entidade_id: id,
      contexto: { linha_id: id },
      dados: { etapa_cadastro: etapa, ativo: false, status_validacao: 'em_validacao' },
      evidencia: 'observado',
    }).catch(() => {})
  }
  return resposta
}

export async function validarLinhaTecnica(id: string, usuario?: { id?: string | null; nome?: string | null }) {
  const resposta = await supabase.from('linhas_tecnicas').update({
    etapa_cadastro: 'revisao',
    status_validacao: 'validada',
    ativo: true,
    validada_em: new Date().toISOString(),
    validada_por_id: usuario?.id || null,
    validada_por_nome: usuario?.nome || null,
    updated_at: new Date().toISOString(),
  }).eq('id', id)
  if (!resposta.error) {
    registrarEventoAprendizadoAtlas({
      dominio: 'linha_tecnica',
      tipo: 'linha_validada',
      entidade_tipo: 'linha_tecnica',
      entidade_id: id,
      contexto: { linha_id: id },
      dados: { ativo: true, status_validacao: 'validada', etapa_cadastro: 'revisao' },
      evidencia: 'validado',
    }).catch(() => {})
  }
  return resposta
}

export async function reabrirLinhaTecnica(id: string, etapa: EtapaCadastroLinhaTecnica = 'dados_linha') {
  const resposta = await supabase.from('linhas_tecnicas').update({
    etapa_cadastro: etapa,
    status_validacao: 'em_validacao',
    ativo: false,
    validada_em: null,
    validada_por_id: null,
    validada_por_nome: null,
    updated_at: new Date().toISOString(),
  }).eq('id', id)
  if (!resposta.error) {
    registrarEventoAprendizadoAtlas({
      dominio: 'linha_tecnica',
      tipo: 'linha_reaberta',
      entidade_tipo: 'linha_tecnica',
      entidade_id: id,
      contexto: { linha_id: id },
      dados: { ativo: false, status_validacao: 'em_validacao', etapa_cadastro: etapa },
      evidencia: 'observado',
    }).catch(() => {})
  }
  return resposta
}

export async function alternarLinhaTecnica(id: string, ativo: boolean) {
  const resposta = await supabase.from('linhas_tecnicas').update({ ativo, updated_at: new Date().toISOString() }).eq('id', id)
  if (!resposta.error) {
    registrarEventoAprendizadoAtlas({
      dominio: 'linha_tecnica',
      tipo: ativo ? 'linha_ativada' : 'linha_inativada',
      entidade_tipo: 'linha_tecnica',
      entidade_id: id,
      contexto: { linha_id: id },
      dados: { ativo },
      evidencia: 'observado',
    }).catch(() => {})
  }
  return resposta
}
