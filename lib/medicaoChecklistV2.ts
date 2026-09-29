import { supabase } from './supabase'
import type { ItemEsquadria, MedicaoItem, Usuario } from './tipos'
import { listarItensMedicao } from './medicaoFinal'

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

export function valorChecklistPreenchido(valor: unknown) {
  return !(valor === undefined || valor === null || valor === '' || (Array.isArray(valor) && valor.length === 0))
}

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

  // A deliberately removed photo must not return on the next page load.
  // Read failure is fail-closed: do not import anything without this history.
  const { data: correcoes, error: erroCorrecoes } = await supabase.from('medicao_revisoes')
    .select('snapshot').eq('medicao_id', medicaoId).eq('motivo', 'Correção de foto')
  if (erroCorrecoes) return false
  const fotoFoiRemovida = (itemId: string, campo: string, url: string) => (correcoes || []).some(({ snapshot }) =>
    snapshot?.item_id === itemId && snapshot?.campo === campo && snapshot?.foto_anterior === url && snapshot?.resultado !== 'nao_realizada',
  )

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

    if (!destino.foto_larguras_url && origem.foto_larguras_url && !fotoFoiRemovida(destino.id, 'foto_larguras_url', origem.foto_larguras_url)) {
      atualizacao.foto_larguras_url = origem.foto_larguras_url
    }
    if (!destino.foto_alturas_url && origem.foto_alturas_url && !fotoFoiRemovida(destino.id, 'foto_alturas_url', origem.foto_alturas_url)) {
      atualizacao.foto_alturas_url = origem.foto_alturas_url
    }

    if (Object.keys(atualizacao).length === 0) continue

    // Herdar as seis medidas não conclui a tipologia por si só. A conclusão
    // depende também dos campos obrigatórios específicos do checklist.

    const { error } = await supabase
      .from('medicao_itens')
      .update(atualizacao)
      .eq('id', destino.id)

    if (error) {
      console.error('Erro ao herdar medidas finais do orçamento:', error)
      continue
    }

    alterou = true
    await sincronizarStatusItemChecklistV2(medicaoId, destino.id, null)
  }

  return alterou
}

export function statusItemChecklistV2(
  item: MedicaoItem,
  campos: CampoChecklistV2[],
  respostas: RespostaChecklistV2[],
): 'pendente' | 'em_andamento' | 'concluida' {
  const camposAtivos = camposDoItemV2(campos, item)
  const obrigatorios = camposAtivos.filter(c => c.obrigatorio)
  const medidasCompletas = CAMPOS_MEDIDA_FIXA.every(campo => medidaPositiva(item[campo]))
  const checklistCompleto = obrigatorios.every(campo => valorChecklistPreenchido(valorRespostaItemV2(item, campo, respostas)))
  if (medidasCompletas && checklistCompleto) return 'concluida'

  const iniciouMedidas = CAMPOS_MEDIDA_FIXA.some(campo => medidaPositiva(item[campo]))
  const iniciouChecklist = camposAtivos.some(campo => valorChecklistPreenchido(valorRespostaItemV2(item, campo, respostas)))
  const iniciou = iniciouMedidas || iniciouChecklist || Boolean(
    item.foto_larguras_url || item.foto_alturas_url || item.observacoes_medicao
  )
  return iniciou ? 'em_andamento' : 'pendente'
}

async function sincronizarStatusItemChecklistV2(
  medicaoId: string,
  itemId: string,
  usuario: Usuario | null,
): Promise<boolean> {
  const dados = await carregarChecklistMedicaoV2(medicaoId)
  const item = dados.itens.find(i => i.id === itemId)
  if (!item) return false
  const status = statusItemChecklistV2(item, dados.campos, dados.respostas)
  const concluida = status === 'concluida'
  const agora = new Date().toISOString()
  const { error } = await supabase.from('medicao_itens').update({
    medido: concluida,
    status_medicao: concluida ? 'concluida' : 'rascunho',
    updated_at: agora,
    medido_em: concluida ? (item.medido_em || agora) : null,
    medido_por_id: concluida ? (usuario?.id || item.medido_por_id || null) : null,
    medido_por_nome: concluida ? (usuario?.nome || item.medido_por_nome || null) : null,
  }).eq('id', itemId)
  if (error) console.error('Erro ao sincronizar status da peça:', error)
  return !error
}

export async function salvarMedidasFixasItemV2(
  medicaoId: string,
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

  const agora = new Date().toISOString()

  const { error } = await supabase
    .from('medicao_itens')
    .update({
      ...normalizadas,
      updated_at: agora,
    })
    .eq('id', itemId)

  if (error) {
    console.error('Erro ao salvar medidas fixas da Medição Final:', error)
    return false
  }

  return sincronizarStatusItemChecklistV2(medicaoId, itemId, usuario)
}

export async function carregarChecklistMedicaoV2(medicaoId: string): Promise<DadosChecklistMedicaoV2> {
  const [itens, camposResp, respostasResp, fotosResp] = await Promise.all([
    listarItensMedicao(medicaoId),
    supabase.from('tipologia_campos_extras').select('*').eq('ativo', true).order('ordem', { ascending: true }),
    supabase.from('medicao_respostas').select('*').eq('medicao_id', medicaoId).order('respondido_em', { ascending: true }),
    supabase.from('medicao_fotos').select('*').eq('medicao_id', medicaoId).order('created_at', { ascending: true }),
  ])

  if (camposResp.error) console.error('Erro ao carregar campos do checklist:', camposResp.error)
  if (respostasResp.error) console.error('Erro ao carregar respostas do checklist:', respostasResp.error)
  if (fotosResp.error) console.error('Erro ao carregar fotos da medicao:', fotosResp.error)

  return {
    itens,
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

  await sincronizarStatusItemChecklistV2(medicaoId, item.id, usuario)
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
