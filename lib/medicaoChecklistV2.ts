import { supabase } from './supabase'
import type { ItemEsquadria, MedicaoItem, Usuario } from './tipos'

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

export type MedidasFixasItemV2 = {
  largura_baixo_mm: number | null
  largura_meio_mm: number | null
  largura_cima_mm: number | null
  altura_direita_mm: number | null
  altura_meio_mm: number | null
  altura_esquerda_mm: number | null
}

const CAMPOS_MEDIDA_FIXA = [
  'largura_baixo_mm',
  'largura_meio_mm',
  'largura_cima_mm',
  'altura_direita_mm',
  'altura_meio_mm',
  'altura_esquerda_mm',
] as const

function medidaPositiva(valor: unknown): valor is number {
  const numero = Number(valor)
  return Number.isFinite(numero) && numero > 0
}

function normalizarMedida(valor: number | null | undefined): number | null {
  return medidaPositiva(valor) ? Number(valor) : null
}

/**
 * Quando a Medição Final nasce de um orçamento do Atlas marcado explicitamente
 * como `tipo_medida = final`, reaproveita as 3 larguras, 3 alturas e as duas
 * fotos da trena já conferidas no orçamento.
 *
 * A herança é conservadora:
 * - orçamento comum/referência nunca preenche medida final;
 * - não inventa valores ausentes;
 * - só faz o pareamento automático quando a quantidade de linhas continua
 *   igual à do orçamento, evitando associar medidas erradas depois de uma
 *   separação/reorganização de peças;
 * - nunca sobrescreve uma medida/foto já registrada na Medição Final.
 */
export async function herdarMedidasFinaisDoOrcamento(medicaoId: string): Promise<boolean> {
  const { data: medicao, error: erroMedicao } = await supabase
    .from('medicoes_finais')
    .select('orcamento_id')
    .eq('id', medicaoId)
    .maybeSingle()

  if (erroMedicao || !medicao?.orcamento_id) return false

  const { data: orcamento, error: erroOrcamento } = await supabase
    .from('orcamentos')
    .select('tipo_medida, itens')
    .eq('id', medicao.orcamento_id)
    .maybeSingle()

  if (erroOrcamento || !orcamento || orcamento.tipo_medida !== 'final') return false

  const itensOrigem = Array.isArray(orcamento.itens) ? (orcamento.itens as ItemEsquadria[]) : []
  if (itensOrigem.length === 0) return false

  const { data: itensDestino, error: erroItens } = await supabase
    .from('medicao_itens')
    .select('*')
    .eq('medicao_id', medicaoId)
    .order('ordem', { ascending: true })

  if (erroItens || !itensDestino || itensDestino.length !== itensOrigem.length) return false

  let alterou = false

  for (let indice = 0; indice < itensDestino.length; indice++) {
    const destino = itensDestino[indice] as MedicaoItem
    const origem = itensOrigem[indice]
    if (!origem) continue

    const atualizacao: Record<string, unknown> = {}

    for (const campo of CAMPOS_MEDIDA_FIXA) {
      if (!medidaPositiva(destino[campo]) && medidaPositiva(origem[campo])) {
        atualizacao[campo] = Number(origem[campo])
      }
    }

    if (!destino.foto_larguras_url && origem.foto_larguras_url) {
      atualizacao.foto_larguras_url = origem.foto_larguras_url
    }
    if (!destino.foto_alturas_url && origem.foto_alturas_url) {
      atualizacao.foto_alturas_url = origem.foto_alturas_url
    }

    const medidasMescladas = CAMPOS_MEDIDA_FIXA.map(campo =>
      atualizacao[campo] ?? destino[campo]
    )
    const medidasCompletas = medidasMescladas.every(medidaPositiva)

    if (medidasCompletas && !destino.medido) {
      atualizacao.medido = true
      atualizacao.medido_em = destino.medido_em || new Date().toISOString()
    }

    if (Object.keys(atualizacao).length === 0) continue

    const { error } = await supabase
      .from('medicao_itens')
      .update(atualizacao)
      .eq('id', destino.id)

    if (error) {
      console.error('Erro ao herdar medidas finais do orçamento:', error)
      continue
    }

    alterou = true
  }

  return alterou
}

export async function salvarMedidasFixasItemV2(
  itemId: string,
  medidas: MedidasFixasItemV2,
  usuario: Usuario | null,
): Promise<boolean> {
  const normalizadas: MedidasFixasItemV2 = {
    largura_baixo_mm: normalizarMedida(medidas.largura_baixo_mm),
    largura_meio_mm: normalizarMedida(medidas.largura_meio_mm),
    largura_cima_mm: normalizarMedida(medidas.largura_cima_mm),
    altura_direita_mm: normalizarMedida(medidas.altura_direita_mm),
    altura_meio_mm: normalizarMedida(medidas.altura_meio_mm),
    altura_esquerda_mm: normalizarMedida(medidas.altura_esquerda_mm),
  }

  const completo = CAMPOS_MEDIDA_FIXA.every(campo => medidaPositiva(normalizadas[campo]))
  const agora = new Date().toISOString()

  const { error } = await supabase
    .from('medicao_itens')
    .update({
      ...normalizadas,
      medido: completo,
      medido_em: completo ? agora : null,
      medido_por_id: completo ? usuario?.id || null : null,
      medido_por_nome: completo ? usuario?.nome || null : null,
    })
    .eq('id', itemId)

  if (error) {
    console.error('Erro ao salvar medidas fixas da Medição Final:', error)
    return false
  }

  return true
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
