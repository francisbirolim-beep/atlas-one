// Versionamento das instrucoes de IA por setor (setores.instrucoes_ia).
// Cada alteracao salva uma nova linha em setor_instrucoes_versoes e mantem
// setores.instrucoes_ia sincronizado com o conteudo da versao mais recente.

import { supabase } from './supabase'

export interface VersaoInstrucoes {
  id: string
  setor_id: string
  versao: number
  conteudo: string | null
  autor_id: string | null
  autor_nome: string | null
  criado_em: string
  justificativa: string | null
  status: 'ativa' | 'substituida'
  restaurada_de_versao: number | null
}

export async function listarVersoes(setorId: string): Promise<VersaoInstrucoes[]> {
  const { data } = await supabase
    .from('setor_instrucoes_versoes')
    .select('*')
    .eq('setor_id', setorId)
    .order('versao', { ascending: false })
  return (data as VersaoInstrucoes[]) || []
}

async function proximaVersao(setorId: string): Promise<number> {
  const { data } = await supabase
    .from('setor_instrucoes_versoes')
    .select('versao')
    .eq('setor_id', setorId)
    .order('versao', { ascending: false })
    .limit(1)
  const ultima = data && data[0] ? (data[0] as any).versao : 0
  return ultima + 1
}

export async function salvarNovaVersao(params: {
  setorId: string
  conteudo: string
  autorId: string | null
  autorNome: string | null
  justificativa?: string
  restauradaDeVersao?: number | null
}): Promise<{ ok: boolean; erro?: string }> {
  try {
    const versao = await proximaVersao(params.setorId)

    // marca a versao ativa anterior (se existir) como substituida
    await supabase
      .from('setor_instrucoes_versoes')
      .update({ status: 'substituida' })
      .eq('setor_id', params.setorId)
      .eq('status', 'ativa')

    const { error: erroInsert } = await supabase.from('setor_instrucoes_versoes').insert({
      setor_id: params.setorId,
      versao,
      conteudo: params.conteudo || null,
      autor_id: params.autorId,
      autor_nome: params.autorNome,
      justificativa: params.justificativa || null,
      status: 'ativa',
      restaurada_de_versao: params.restauradaDeVersao ?? null,
    })
    if (erroInsert) return { ok: false, erro: erroInsert.message }

    const { error: erroUpdate } = await supabase
      .from('setores')
      .update({ instrucoes_ia: params.conteudo || null })
      .eq('id', params.setorId)
    if (erroUpdate) return { ok: false, erro: erroUpdate.message }

    return { ok: true }
  } catch (e: any) {
    return { ok: false, erro: String(e && e.message ? e.message : e) }
  }
}

export async function restaurarVersao(params: {
  setorId: string
  versaoParaRestaurar: VersaoInstrucoes
  autorId: string | null
  autorNome: string | null
}): Promise<{ ok: boolean; erro?: string }> {
  return salvarNovaVersao({
    setorId: params.setorId,
    conteudo: params.versaoParaRestaurar.conteudo || '',
    autorId: params.autorId,
    autorNome: params.autorNome,
    justificativa: 'Restaurado da versao ' + params.versaoParaRestaurar.versao,
    restauradaDeVersao: params.versaoParaRestaurar.versao,
  })
}
