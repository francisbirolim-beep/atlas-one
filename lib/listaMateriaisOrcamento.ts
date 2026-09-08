import { supabase } from './supabase'
import type { MaterialPacote, PacoteTecnico } from './materialPlanejamento'

export type GrupoMaterialOrcamento = 'perfis' | 'acessorios' | 'vidros' | 'outros'

export type OrigemMaterialOrcamento = {
  item_ref: string
  label: string
  quantidade: number
}

export type LinhaMaterialOrcamento = {
  chave: string
  grupo: GrupoMaterialOrcamento
  categoria: MaterialPacote['categoria']
  produto_id?: string | null
  codigo?: string | null
  descricao: string
  unidade: string
  cor_ref?: string | null
  quantidade: number
  comprimento_corte_mm?: number | null
  comprimento_barra_mm?: number | null
  status_calculo: MaterialPacote['status_calculo']
  incluido_manual: boolean
  justificativa?: string | null
  origens: OrigemMaterialOrcamento[]
}

export type ListaMateriaisOrcamento = {
  orcamento: any
  pacote: PacoteTecnico | null
  individual: LinhaMaterialOrcamento[]
  consolidada: LinhaMaterialOrcamento[]
  itemLabels: Record<string, string>
  pendencias: number
}

function n(valor: unknown) {
  const numero = Number(valor)
  return Number.isFinite(numero) ? numero : 0
}

function itemRef(item: any, indice: number) {
  return String(item?.id || `item-${indice + 1}`)
}

function itemLabel(item: any, indice: number) {
  const ambiente = String(item?.ambiente || '').trim()
  const tipo = String(item?.tipo_outro_texto || item?.tipo_esquadria || item?.tipo || item?.descricao || `Tipologia ${indice + 1}`).trim()
  const medida = n(item?.largura_mm) > 0 && n(item?.altura_mm) > 0
    ? `${Math.round(n(item.largura_mm))} × ${Math.round(n(item.altura_mm))} mm`
    : ''
  return [ambiente, tipo, medida].filter(Boolean).join(' · ')
}

function grupoDaCategoria(categoria: MaterialPacote['categoria']): GrupoMaterialOrcamento {
  if (categoria === 'perfil' || categoria === 'contramarco') return 'perfis'
  if (categoria === 'acessorio') return 'acessorios'
  if (categoria === 'vidro') return 'vidros'
  return 'outros'
}

function chaveConsolidacao(material: MaterialPacote) {
  return [
    grupoDaCategoria(material.categoria),
    material.categoria,
    material.produto_id || '',
    (material.codigo || '').trim().toUpperCase(),
    material.descricao.trim().toUpperCase(),
    material.unidade.trim().toUpperCase(),
    (material.cor_ref || '').trim().toUpperCase(),
    material.comprimento_corte_mm ?? '',
    material.comprimento_barra_mm ?? '',
    material.status_calculo,
    material.incluido_manual ? 'manual' : 'tecnico',
  ].join('|')
}

function linhaDoMaterial(material: MaterialPacote, label: string): LinhaMaterialOrcamento {
  const quantidade = n(material.quantidade_ajustada)
  const ref = String(material.item_ref || 'sem-tipologia')
  return {
    chave: material.id,
    grupo: grupoDaCategoria(material.categoria),
    categoria: material.categoria,
    produto_id: material.produto_id || null,
    codigo: material.codigo || null,
    descricao: material.descricao,
    unidade: material.unidade,
    cor_ref: material.cor_ref || null,
    quantidade,
    comprimento_corte_mm: material.comprimento_corte_mm ?? null,
    comprimento_barra_mm: material.comprimento_barra_mm ?? null,
    status_calculo: material.status_calculo,
    incluido_manual: Boolean(material.incluido_manual),
    justificativa: material.justificativa_ajuste || null,
    origens: [{ item_ref: ref, label, quantidade }],
  }
}

function consolidar(materiais: MaterialPacote[], labels: Record<string, string>) {
  const mapa = new Map<string, LinhaMaterialOrcamento>()

  for (const material of materiais) {
    const ref = String(material.item_ref || 'sem-tipologia')
    const label = labels[ref] || 'Material geral do orçamento'
    const quantidade = n(material.quantidade_ajustada)
    const chave = chaveConsolidacao(material)
    const atual = mapa.get(chave)

    if (!atual) {
      const linha = linhaDoMaterial(material, label)
      linha.chave = chave
      mapa.set(chave, linha)
      continue
    }

    atual.quantidade += quantidade
    const origem = atual.origens.find(o => o.item_ref === ref)
    if (origem) origem.quantidade += quantidade
    else atual.origens.push({ item_ref: ref, label, quantidade })
  }

  return Array.from(mapa.values()).sort((a, b) => {
    const grupo = a.grupo.localeCompare(b.grupo, 'pt-BR')
    if (grupo !== 0) return grupo
    return `${a.codigo || ''} ${a.descricao}`.localeCompare(`${b.codigo || ''} ${b.descricao}`, 'pt-BR')
  })
}

async function pacoteAtualDoOrcamento(orcamentoId: string) {
  const principal = await supabase
    .from('pacotes_tecnicos')
    .select('*')
    .eq('orcamento_id', orcamentoId)
    .eq('origem', 'orcamento_simulacao')
    .neq('status', 'substituido')
    .order('versao', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (principal.data) return principal.data as PacoteTecnico

  const fallback = await supabase
    .from('pacotes_tecnicos')
    .select('*')
    .eq('orcamento_id', orcamentoId)
    .neq('status', 'substituido')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  return (fallback.data || null) as PacoteTecnico | null
}

export async function carregarListaMateriaisOrcamento(orcamentoId: string): Promise<ListaMateriaisOrcamento | null> {
  const { data: orcamento, error: erroOrcamento } = await supabase
    .from('orcamentos')
    .select('id,numero,cliente_nome,cidade,obra_cidade,created_at,itens,clientes(id,nome),obras(id,nome,cidade)')
    .eq('id', orcamentoId)
    .maybeSingle()

  if (erroOrcamento || !orcamento) return null

  const pacote = await pacoteAtualDoOrcamento(orcamentoId)
  if (!pacote) {
    return { orcamento, pacote: null, individual: [], consolidada: [], itemLabels: {}, pendencias: 0 }
  }

  const itens = Array.isArray(pacote.snapshot_itens) && pacote.snapshot_itens.length > 0
    ? pacote.snapshot_itens
    : (Array.isArray((orcamento as any).itens) ? (orcamento as any).itens : [])

  const itemLabels: Record<string, string> = {}
  itens.forEach((item: any, indice: number) => {
    itemLabels[itemRef(item, indice)] = itemLabel(item, indice)
  })
  itemLabels['sem-tipologia'] = 'Material geral do orçamento'

  const { data: materiais } = await supabase
    .from('pacote_tecnico_materiais')
    .select('*')
    .eq('pacote_id', pacote.id)
    .eq('excluido', false)
    .order('categoria')
    .order('ordem')

  const ativos = (materiais || []) as MaterialPacote[]
  const individual = ativos.map(material => {
    const ref = String(material.item_ref || 'sem-tipologia')
    return linhaDoMaterial(material, itemLabels[ref] || 'Material geral do orçamento')
  })

  return {
    orcamento,
    pacote,
    individual,
    consolidada: consolidar(ativos, itemLabels),
    itemLabels,
    pendencias: ativos.filter(material => material.status_calculo === 'pendente_formula').length,
  }
}
