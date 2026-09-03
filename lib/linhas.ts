import { supabase } from './supabase'
import { Linha } from './tipos'

export type StatusCadastroLinha = 'rascunho' | 'em_revisao' | 'validada'
export type EtapaCadastroLinha = 'dados_linha' | 'perfis' | 'acessorios' | 'tipologias' | 'formulacoes' | 'revisao'

export interface LinhaCadastro extends Linha {
  status_cadastro?: StatusCadastroLinha
  etapa_cadastro?: EtapaCadastroLinha
  validada_em?: string | null
  validada_por_id?: string | null
  validada_por_nome?: string | null
}

export async function listarLinhas(somenteAtivas = false): Promise<LinhaCadastro[]> {
  let query = supabase.from('linhas').select('*').order('nome')
  if (somenteAtivas) query = query.eq('ativo', true).eq('status_cadastro', 'validada')
  const { data } = await query
  return (data as LinhaCadastro[]) || []
}

export async function criarLinha(nome: string) {
  return supabase
    .from('linhas')
    .insert({
      nome: nome.trim(),
      ativo: false,
      status_cadastro: 'rascunho',
      etapa_cadastro: 'dados_linha',
    })
    .select('*')
    .single()
}

export async function atualizarLinha(
  id: string,
  dados: Partial<{
    nome: string
    ativo: boolean
    status_cadastro: StatusCadastroLinha
    etapa_cadastro: EtapaCadastroLinha
    validada_em: string | null
    validada_por_id: string | null
    validada_por_nome: string | null
  }>,
) {
  return supabase.from('linhas').update({ ...dados, updated_at: new Date().toISOString() }).eq('id', id)
}

export async function salvarProgressoLinha(id: string, etapa: EtapaCadastroLinha) {
  return atualizarLinha(id, {
    etapa_cadastro: etapa,
    status_cadastro: etapa === 'revisao' ? 'em_revisao' : 'rascunho',
    ativo: false,
  })
}

export async function validarLinha(id: string, usuario?: { id?: string | null; nome?: string | null }) {
  return atualizarLinha(id, {
    etapa_cadastro: 'revisao',
    status_cadastro: 'validada',
    ativo: true,
    validada_em: new Date().toISOString(),
    validada_por_id: usuario?.id || null,
    validada_por_nome: usuario?.nome || null,
  })
}

export async function reabrirLinhaParaEdicao(id: string, etapa: EtapaCadastroLinha = 'dados_linha') {
  return atualizarLinha(id, {
    etapa_cadastro: etapa,
    status_cadastro: 'rascunho',
    ativo: false,
    validada_em: null,
    validada_por_id: null,
    validada_por_nome: null,
  })
}

export async function alternarAtivoLinha(id: string, ativo: boolean) {
  return supabase.from('linhas').update({ ativo, updated_at: new Date().toISOString() }).eq('id', id)
}

export async function excluirLinha(id: string) {
  return supabase.from('linhas').delete().eq('id', id)
}
