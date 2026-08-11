import { supabase } from './supabase'
import type { MedicaoItem, Usuario } from './tipos'

export type CampoChecklistV2 = {
  id: string
  tipo_esquadria: string | null
  chave: string
  nome: string
  tipo_valor: 'numero' | 'texto' | 'foto'
  obrigatorio: boolean
  ordem: number
  secao: string | null
  opcoes: unknown[]
  regra_condicional: Record<string, unknown>
  exigir_foto_quando: unknown[]
  ativo: boolean
}

export type RespostaChecklistV2 = {
  id: string
  medicao_id: string
  item_id: string
  campo_id: string | null
  campo_chave: string
  valor: unknown
  observacao: string | null
  foto_urls: string[]
  respondido_por_id: string | null
  respondido_por_nome: string | null
  respondido_em: string
  updated_at: string
}

export type FotoMedicaoV2 = {
  id: string
  medicao_id: string
  item_id: string | null
  categoria: string
  url: string
  legenda: string | null
  criado_por_id: string | null
  criado_por_nome: string | null
  created_at: string
}

export type DadosChecklistMedicaoV2 = {
  itens: MedicaoItem[]
  campos: CampoChecklistV2[]
  respostas: RespostaChecklistV2[]
  fotos: FotoMedicaoV2[]
}

export async function carregarChecklistMedicaoV2(medicaoId: string): Promise<DadosChecklistMedicaoV2> {
  const [itensResp, camposResp, respostasResp, fotosResp] = await Promise.all([
    supabase.from('medicao_itens').select('*').eq('medicao_id', medicaoId).order('ordem', { ascending: true }),
    supabase.from('tipologia_campos_extras').select('*').eq('ativo', true).order('ordem', { ascending: true }),
    supabase.from('medicao_respostas').select('*').eq('medicao_id', medicaoId).order('respondido_em', { ascending: true }),
    supabase.from('medicao_fotos').select('*').eq('medicao_id', medicaoId).order('created_at', { ascending: true }),
  ])

  if (itensResp.error) console.error('Erro ao carregar itens do checklist:', itensResp.error)
  if (camposResp.error) console.error('Erro ao carregar campos do checklist:', camposResp.error)
  if (respostasResp.error) console.error('Erro ao carregar respostas do checklist:', respostasResp.error)
  if (fotosResp.error) console.error('Erro ao carregar fotos da medicao:', fotosResp.error)

  return {
    itens: (itensResp.data || []) as MedicaoItem[],
    campos: (camposResp.data || []).map((campo: any) => ({
      ...campo,
      opcoes: Array.isArray(campo.opcoes) ? campo.opcoes : [],
      regra_condicional: campo.regra_condicional && typeof campo.regra_condicional === 'object' ? campo.regra_condicional : {},
      exigir_foto_quando: Array.isArray(campo.exigir_foto_quando) ? campo.exigir_foto_quando : [],
      ativo: campo.ativo !== false,
    })) as CampoChecklistV2[],
    respostas: (respostasResp.data || []).map((resposta: any) => ({
      ...resposta,
      foto_urls: Array.isArray(resposta.foto_urls) ? resposta.foto_urls : [],
    })) as RespostaChecklistV2[],
    fotos: (fotosResp.data || []) as FotoMedicaoV2[],
  }
}

export function camposDoItemV2(campos: CampoChecklistV2[], item: MedicaoItem): CampoChecklistV2[] {
  return campos
    .filter(campo => campo.ativo && (campo.tipo_esquadria == null || campo.tipo_esquadria === item.tipo_esquadria))
    .sort((a, b) => (a.ordem || 0) - (b.ordem || 0))
}

export function valorRespostaItemV2(
  item: MedicaoItem,
  campo: CampoChecklistV2,
  respostas: RespostaChecklistV2[],
): unknown {
  const resposta = respostas.find(r => r.item_id === item.id && r.campo_chave === campo.chave)
  if (resposta && resposta.valor !== undefined && resposta.valor !== null) return resposta.valor
  return item.campos_extras?.[campo.chave]
}

export async function salvarRespostaChecklistV2(
  medicaoId: string,
  item: MedicaoItem,
  campo: CampoChecklistV2,
  valor: unknown,
  usuario: Usuario | null,
  observacao: string | null = null,
  fotoUrls: string[] = [],
): Promise<boolean> {
  const agora = new Date().toISOString()
  const { error } = await supabase
    .from('medicao_respostas')
    .upsert({
      medicao_id: medicaoId,
      item_id: item.id,
      campo_id: campo.id,
      campo_chave: campo.chave,
      valor,
      observacao: observacao || null,
      foto_urls: fotoUrls,
      respondido_por_id: usuario?.id || null,
      respondido_por_nome: usuario?.nome || null,
      respondido_em: agora,
      updated_at: agora,
    }, { onConflict: 'item_id,campo_chave' })

  if (error) {
    console.error('Erro ao salvar resposta estruturada da medicao:', error)
    return false
  }

  // Compatibilidade: o formulario legado ainda le `medicao_itens.campos_extras`.
  // Mantemos um espelho para que checklist V2 e tela de medicao nao divirjam.
  const extras = { ...(item.campos_extras || {}), [campo.chave]: valor as any }
  const { error: erroLegado } = await supabase
    .from('medicao_itens')
    .update({ campos_extras: extras })
    .eq('id', item.id)

  if (erroLegado) {
    console.error('Resposta V2 salva, mas falhou ao sincronizar campos_extras:', erroLegado)
  }

  return true
}

export async function adicionarFotoMedicaoV2(
  medicaoId: string,
  itemId: string | null,
  categoria: string,
  url: string,
  usuario: Usuario | null,
  legenda: string | null = null,
): Promise<FotoMedicaoV2 | null> {
  const { data, error } = await supabase
    .from('medicao_fotos')
    .insert({
      medicao_id: medicaoId,
      item_id: itemId,
      categoria,
      url,
      legenda: legenda || null,
      criado_por_id: usuario?.id || null,
      criado_por_nome: usuario?.nome || null,
    })
    .select()
    .single()

  if (error || !data) {
    console.error('Erro ao registrar foto da Medicao Final:', error)
    return null
  }

  return data as FotoMedicaoV2
}

export async function removerFotoMedicaoV2(fotoId: string): Promise<boolean> {
  const { error } = await supabase.from('medicao_fotos').delete().eq('id', fotoId)
  if (error) console.error('Erro ao remover foto da Medicao Final:', error)
  return !error
}

export async function validarChecklistObrigatorioV2(medicaoId: string): Promise<{
  ok: boolean
  faltantes: { itemId: string; itemDescricao: string; campo: string }[]
}> {
  const dados = await carregarChecklistMedicaoV2(medicaoId)
  const faltantes: { itemId: string; itemDescricao: string; campo: string }[] = []

  for (const item of dados.itens) {
    const campos = camposDoItemV2(dados.campos, item).filter(c => c.obrigatorio)
    for (const campo of campos) {
      const valor = valorRespostaItemV2(item, campo, dados.respostas)
      const vazio = valor === undefined || valor === null || valor === '' || (Array.isArray(valor) && valor.length === 0)
      if (vazio) {
        faltantes.push({
          itemId: item.id,
          itemDescricao: item.descricao || item.tipo_esquadria,
          campo: campo.nome,
        })
      }
    }
  }

  return { ok: faltantes.length === 0, faltantes }
}
