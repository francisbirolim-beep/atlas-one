import { supabase } from './supabase'
import { carregarOrdemProducao, type OrdemProducao } from './ordensProducao'
import type { MaterialPacote, PacoteTecnico } from './materialPlanejamento'

export type MaterialFichaProducao = MaterialPacote & {
  imagem_url?: string | null
  cortes: Array<{
    id: string
    comprimento_mm: number
    perda_corte_mm: number
    barra_id: string
    barra_sobra_final_mm?: number | null
    sobra_exclusiva_item?: boolean
  }>
}

export type RevisaoFichaProducao = {
  id: string
  versao: number
  tipo: string
  justificativa?: string | null
  criado_por_nome?: string | null
  created_at: string
}

export type FichaProducao = {
  ordem: OrdemProducao
  orcamento: any | null
  medicaoFinal: any | null
  pacote: PacoteTecnico | null
  tipologia: any | null
  item: any
  materiais: MaterialFichaProducao[]
  revisoes: RevisaoFichaProducao[]
  situacao: 'liberado' | 'previa'
  motivosBloqueio: string[]
  observacoesProducao: string[]
  linkInternoPath: string
}

function n(valor: unknown) {
  const numero = Number(valor)
  return Number.isFinite(numero) ? numero : 0
}

function itemRef(item: any, indice: number) {
  return String(item?.id || `item-${indice + 1}`)
}

function localizarItem(snapshot: any[], ref?: string | null) {
  if (!Array.isArray(snapshot) || snapshot.length === 0) return null
  if (!ref) return snapshot[0] || null
  return snapshot.find((item, indice) => itemRef(item, indice) === String(ref)) || null
}

async function carregarPacoteParaFicha(orcamentoId: string, itemRefValor?: string | null) {
  const { data: pacotes } = await supabase
    .from('pacotes_tecnicos')
    .select('*')
    .eq('orcamento_id', orcamentoId)
    .neq('status', 'substituido')
    .order('created_at', { ascending: false })

  const lista = (pacotes || []) as PacoteTecnico[]
  const finais = lista.filter(p => p.origem === 'medicao_final')
  const candidatos = finais.length > 0 ? finais : lista

  if (!itemRefValor) return candidatos[0] || null
  return candidatos.find(p => {
    const itens = Array.isArray(p.snapshot_itens) ? p.snapshot_itens : []
    return itens.some((item, indice) => itemRef(item, indice) === String(itemRefValor))
  }) || candidatos[0] || null
}

function observacoesDoItem(item: any, pacote: PacoteTecnico | null) {
  const observacoes: string[] = []
  const candidatas = [
    item?.observacoes_producao,
    item?.observacao_producao,
    item?.observacoes,
    item?.observacao,
    pacote?.observacoes,
  ]
  for (const valor of candidatas) {
    if (typeof valor === 'string' && valor.trim() && !observacoes.includes(valor.trim())) observacoes.push(valor.trim())
  }
  return observacoes
}

export async function carregarFichaProducao(ordemId: string): Promise<FichaProducao | null> {
  const ordem = await carregarOrdemProducao(ordemId)
  if (!ordem) return null

  const orcamentoId = ordem.orcamento_id || null
  let orcamento: any | null = null
  let medicaoFinal: any | null = null
  let pacote: PacoteTecnico | null = null
  let revisoes: RevisaoFichaProducao[] = []

  if (orcamentoId) {
    const [orcResp, medResp] = await Promise.all([
      supabase
        .from('orcamentos')
        .select('id,numero,cliente_nome,cidade,obra_cidade,created_at,itens,clientes(id,nome),obras(id,nome,cidade)')
        .eq('id', orcamentoId)
        .maybeSingle(),
      supabase
        .from('medicoes_finais')
        .select('id,status_operacional,versao,aprovado_em,aprovado_por_nome,responsavel_nome,observacoes,created_at')
        .eq('orcamento_id', orcamentoId)
        .order('versao', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
    ])
    orcamento = orcResp.data || null
    medicaoFinal = medResp.data || null
    pacote = await carregarPacoteParaFicha(orcamentoId, ordem.item_ref)
  }

  if (ordem.venda_obra_id) {
    const { data } = await supabase
      .from('venda_obra_revisoes')
      .select('id,versao,tipo,justificativa,criado_por_nome,created_at')
      .eq('venda_obra_id', ordem.venda_obra_id)
      .order('versao', { ascending: false })
    revisoes = (data || []) as RevisaoFichaProducao[]
  }

  const snapshot = pacote?.snapshot_itens && Array.isArray(pacote.snapshot_itens)
    ? pacote.snapshot_itens
    : (Array.isArray(orcamento?.itens) ? orcamento.itens : [])
  const item = localizarItem(snapshot, ordem.item_ref) || ordem.item_snapshot || {}
  const tipologiaId = item?.tipologia_id || item?.tipologiaId || null

  let tipologia: any | null = null
  if (tipologiaId) {
    const { data } = await supabase
      .from('tipologias')
      .select('id,chave,label,categoria,foto_url,versao_tecnica')
      .eq('id', tipologiaId)
      .maybeSingle()
    tipologia = data || null
  }

  let materiaisBase: MaterialPacote[] = []
  if (pacote) {
    let consulta = supabase
      .from('pacote_tecnico_materiais')
      .select('*')
      .eq('pacote_id', pacote.id)
      .eq('excluido', false)
      .order('categoria')
      .order('ordem')
    if (ordem.item_ref) consulta = consulta.eq('item_ref', ordem.item_ref)
    const { data } = await consulta
    materiaisBase = (data || []) as MaterialPacote[]
  }

  const produtoIds = Array.from(new Set(materiaisBase.map(m => m.produto_id).filter(Boolean))) as string[]
  const produtos = produtoIds.length > 0
    ? ((await supabase.from('produtos').select('id,foto_url').in('id', produtoIds)).data || []) as Array<{ id: string; foto_url?: string | null }>
    : []
  const imagemPorProduto = new Map(produtos.map(p => [p.id, p.foto_url || null]))

  const cortesPorMaterial = new Map<string, MaterialFichaProducao['cortes']>()
  if (pacote && materiaisBase.length > 0) {
    const materialIds = materiaisBase.map(m => m.id)
    const { data: cortes } = await supabase
      .from('pacote_tecnico_cortes')
      .select('id,material_id,item_ref,barra_id,comprimento_mm,perda_corte_mm,pacote_tecnico_barras!inner(pacote_id,sobra_final_mm)')
      .in('material_id', materialIds)
      .eq('pacote_tecnico_barras.pacote_id', pacote.id)

    const barraIds = Array.from(new Set((cortes || []).map((c: any) => c.barra_id).filter(Boolean))) as string[]
    const cortesBarra = barraIds.length > 0
      ? ((await supabase.from('pacote_tecnico_cortes').select('barra_id,item_ref').in('barra_id', barraIds)).data || []) as any[]
      : []
    const refsPorBarra = new Map<string, Set<string>>()
    for (const corte of cortesBarra) {
      const set = refsPorBarra.get(String(corte.barra_id)) || new Set<string>()
      set.add(String(corte.item_ref || ''))
      refsPorBarra.set(String(corte.barra_id), set)
    }

    for (const corte of (cortes || []) as any[]) {
      if (!corte.material_id) continue
      const arr = cortesPorMaterial.get(String(corte.material_id)) || []
      const barra = Array.isArray(corte.pacote_tecnico_barras) ? corte.pacote_tecnico_barras[0] : corte.pacote_tecnico_barras
      const refs = refsPorBarra.get(String(corte.barra_id)) || new Set<string>()
      arr.push({
        id: corte.id,
        comprimento_mm: n(corte.comprimento_mm),
        perda_corte_mm: n(corte.perda_corte_mm),
        barra_id: String(corte.barra_id),
        barra_sobra_final_mm: barra?.sobra_final_mm == null ? null : n(barra.sobra_final_mm),
        sobra_exclusiva_item: refs.size <= 1 && refs.has(String(corte.item_ref || '')),
      })
      cortesPorMaterial.set(String(corte.material_id), arr)
    }
  }

  const materiais: MaterialFichaProducao[] = materiaisBase.map(material => ({
    ...material,
    imagem_url: material.produto_id ? imagemPorProduto.get(material.produto_id) || null : null,
    cortes: cortesPorMaterial.get(material.id) || [],
  }))

  let overrideCount = 0
  if (orcamentoId && ordem.item_ref) {
    const { count } = await supabase
      .from('orcamento_item_componentes_overrides')
      .select('id', { count: 'exact', head: true })
      .eq('orcamento_id', orcamentoId)
      .eq('item_ref', ordem.item_ref)
    overrideCount = count || 0
  }

  const motivosBloqueio: string[] = []
  if (!orcamentoId) motivosBloqueio.push('Ordem sem orçamento técnico vinculado.')
  if (medicaoFinal?.status_operacional !== 'aprovado') motivosBloqueio.push('Medição Final ainda não aprovada.')
  if (!pacote) motivosBloqueio.push('Pacote técnico não encontrado.')
  else if (pacote.origem !== 'medicao_final') motivosBloqueio.push('Pacote técnico ainda não foi regenerado a partir da Medição Final.')
  if (materiais.some(m => m.status_calculo === 'pendente_formula')) motivosBloqueio.push('Existem materiais/fórmulas técnicas pendentes.')
  if (materiais.some(m => m.status_calculo === 'manual' || m.incluido_manual)) motivosBloqueio.push('Existem materiais alterados manualmente aguardando validação técnica.')
  if (overrideCount > 0) motivosBloqueio.push('Existem substituições/adições/remoções manuais da tipologia aguardando validação técnica.')
  if (ordem.bloqueada) motivosBloqueio.push(ordem.bloqueio_motivo || 'Ordem de Produção está bloqueada.')
  if (materiais.length === 0) motivosBloqueio.push('Nenhum material técnico válido foi localizado para esta tipologia.')

  const situacao: FichaProducao['situacao'] = motivosBloqueio.length === 0 ? 'liberado' : 'previa'

  return {
    ordem,
    orcamento,
    medicaoFinal,
    pacote,
    tipologia,
    item,
    materiais,
    revisoes,
    situacao,
    motivosBloqueio,
    observacoesProducao: observacoesDoItem(item, pacote),
    linkInternoPath: `/producao/ordens/${ordem.id}/ficha`,
  }
}
