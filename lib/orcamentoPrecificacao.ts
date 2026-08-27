import { supabase } from './supabase'
import { usuarioAtual } from './auth'
import {
  carregarPacoteCompleto,
  gerarPacoteTecnico,
  recalcularAproveitamentoPacote,
  type MaterialPacote,
  type PacoteTecnico,
} from './materialPlanejamento'
import { registrarOverrideOrcamento, substituirComponenteDefinitivo } from './historicoTipologias'

export type CategoriaPrecificacao = 'perfil' | 'acessorio' | 'vidro' | 'mao_obra' | 'instalacao' | 'deslocamento' | 'frete' | 'pintura' | 'terceiro' | 'consumivel' | 'outro'

export type ComponentePrecificacao = {
  id: string
  orcamento_id: string
  pacote_id?: string | null
  material_id?: string | null
  item_ref?: string | null
  categoria: CategoriaPrecificacao
  produto_id?: string | null
  catalogo_custo_id?: string | null
  codigo?: string | null
  descricao: string
  unidade: string
  quantidade: number
  custo_unitario: number
  custo_total: number
  margem_pct: number
  preco_venda: number
  origem_custo: 'produto' | 'catalogo' | 'calculado' | 'manual' | 'pendente'
  custo_pendente: boolean
  incluido_manual: boolean
  excluido: boolean
  observacoes?: string | null
}

export type PoliticaItem = {
  id?: string
  orcamento_id: string
  item_ref: string
  margem_herda_geral: boolean
  margem_pct?: number | null
  sobra_herda_geral: boolean
  cobrar_sobra?: boolean | null
  custo_produtivo: number
  custo_sobra: number
  custo_extras: number
  custo_total: number
  preco_venda: number
  observacoes?: string | null
}

export type ProdutoPrecificacao = {
  id: string
  codigo?: string | null
  nome: string
  categoria: string
  unidade?: string | null
  custo?: number | null
  peso_kg_m?: number | null
  tamanho_barra_mm?: number | null
  tamanho_barra_mm_origem?: number | null
}

export type PrecificacaoOrcamento = {
  orcamento: any
  pacote: PacoteTecnico | null
  materiais: MaterialPacote[]
  barras: any[]
  cortes: any[]
  componentes: ComponentePrecificacao[]
  politicas: PoliticaItem[]
  formulas: Record<string, { id: string; tipologia_id: string; configuracao_label: string; versao: number }>
  produtos: ProdutoPrecificacao[]
  pendencias: string[]
}

function num(v: any, fallback = 0) {
  const n = Number(v)
  return Number.isFinite(n) ? n : fallback
}
function itemRef(item: any, index: number) { return String(item?.id || `item-${index + 1}`) }
function categoriaMaterial(categoria: string): CategoriaPrecificacao {
  if (categoria === 'contramarco') return 'perfil'
  if (categoria === 'perfil' || categoria === 'acessorio' || categoria === 'vidro' || categoria === 'outro') return categoria
  return 'outro'
}
function margemVenda(custo: number, margem: number) {
  const m = Math.min(99.9, Math.max(0, margem))
  return custo <= 0 ? 0 : custo / (1 - m / 100)
}
function codigoKey(v?: string | null) { return (v || '').trim().toUpperCase() }
function tamanhoBarra(p: any) {
  return num(p?.tamanho_barra_mm) || num(p?.tamanho_barra_mm_origem) || num(p?.dados_origem?.tamanho_raw) || 0
}

async function carregarConfigs() {
  const { data } = await supabase.from('configuracoes_precificacao').select('chave,valor').in('chave', ['preco_kg_aluminio','custo_pintura_kg','margem_padrao_orcamento'])
  const map = new Map((data || []).map((x: any) => [x.chave, num(x.valor)]))
  return {
    precoKg: map.get('preco_kg_aluminio') || 0,
    pinturaKg: map.get('custo_pintura_kg') || 0,
    margemPadrao: map.get('margem_padrao_orcamento') || 40,
  }
}

async function aplicarOverridesAoPacote(orcamentoId: string, pacoteId: string) {
  const [{ data: overrides }, { data: materiais }, { data: produtos }] = await Promise.all([
    supabase.from('orcamento_item_componentes_overrides').select('*').eq('orcamento_id', orcamentoId).order('created_at'),
    supabase.from('pacote_tecnico_materiais').select('*').eq('pacote_id', pacoteId).order('ordem'),
    supabase.from('produtos').select('id,codigo,nome,categoria,unidade,tamanho_barra_mm,tamanho_barra_mm_origem,dados_origem').eq('ativo', true),
  ])
  const produtoMap = new Map<string, any>()
  ;(produtos || []).forEach((p: any) => { if (p.codigo) produtoMap.set(codigoKey(p.codigo), p) })

  for (const ov of overrides || []) {
    const categoria = ov.componente_tipo === 'perfil' ? ['perfil','contramarco'] : [ov.componente_tipo]
    const candidatas = (materiais || []).filter((m: any) =>
      m.item_ref === ov.item_ref && categoria.includes(m.categoria) &&
      (!ov.codigo_origem || codigoKey(m.codigo) === codigoKey(ov.codigo_origem))
    )

    if (ov.acao === 'remover') {
      if (candidatas.length) await supabase.from('pacote_tecnico_materiais').update({ excluido: true, status_calculo: 'manual', justificativa_ajuste: ov.justificativa }).in('id', candidatas.map((m: any) => m.id))
      continue
    }

    if (ov.acao === 'substituir') {
      const destino = ov.produto_destino_id
        ? (produtos || []).find((p: any) => p.id === ov.produto_destino_id)
        : produtoMap.get(codigoKey(ov.codigo_destino))
      for (const m of candidatas as any[]) {
        await supabase.from('pacote_tecnico_materiais').update({
          produto_id: destino?.id || ov.produto_destino_id || null,
          codigo: ov.codigo_destino || destino?.codigo || m.codigo,
          descricao: ov.descricao_destino || destino?.nome || m.descricao,
          quantidade_ajustada: ov.quantidade_override == null ? m.quantidade_ajustada : Math.max(0, num(ov.quantidade_override)),
          comprimento_corte_mm: ov.comprimento_override_mm == null ? m.comprimento_corte_mm : Math.max(0, num(ov.comprimento_override_mm)),
          comprimento_barra_mm: tamanhoBarra(destino) || m.comprimento_barra_mm,
          status_calculo: 'manual',
          justificativa_ajuste: ov.justificativa,
        }).eq('id', m.id)
      }
      continue
    }

    if (ov.acao === 'adicionar') {
      const destino = ov.produto_destino_id
        ? (produtos || []).find((p: any) => p.id === ov.produto_destino_id)
        : produtoMap.get(codigoKey(ov.codigo_destino))
      await supabase.from('pacote_tecnico_materiais').insert({
        pacote_id: pacoteId,
        item_ref: ov.item_ref,
        categoria: ov.componente_tipo,
        produto_id: destino?.id || ov.produto_destino_id || null,
        codigo: ov.codigo_destino || destino?.codigo || null,
        descricao: ov.descricao_destino || destino?.nome || ov.codigo_destino || 'Componente adicional',
        unidade: destino?.unidade || 'UN',
        quantidade_tecnica: 0,
        quantidade_ajustada: Math.max(0, num(ov.quantidade_override, 1)),
        comprimento_corte_mm: ov.comprimento_override_mm == null ? null : Math.max(0, num(ov.comprimento_override_mm)),
        comprimento_barra_mm: tamanhoBarra(destino) || null,
        origem_calculo: 'manual',
        status_calculo: 'manual',
        incluido_manual: true,
        excluido: false,
        justificativa_ajuste: ov.justificativa,
        ordem: 20000,
      })
    }
  }
  await recalcularAproveitamentoPacote(pacoteId, [])
}

async function custoMaterial(material: MaterialPacote, produto: any, catalogo: any, cfg: { precoKg: number; pinturaKg: number }) {
  if ((material.categoria === 'perfil' || material.categoria === 'contramarco') && num(material.comprimento_corte_mm) > 0) {
    const pesoM = num(produto?.peso_kg_m)
    if (pesoM > 0 && pesoM < 50 && cfg.precoKg > 0) {
      const kg = pesoM * (num(material.comprimento_corte_mm) / 1000)
      return { custo: kg * (cfg.precoKg + cfg.pinturaKg), origem: 'calculado' as const, pendente: false }
    }
  }
  if (num(produto?.custo) > 0) return { custo: num(produto.custo), origem: 'produto' as const, pendente: false }
  if (num(catalogo?.custo_unitario) > 0) return { custo: num(catalogo.custo_unitario), origem: 'catalogo' as const, pendente: false }
  return { custo: 0, origem: 'pendente' as const, pendente: true }
}

async function gerarComponentesDoPacote(orcamentoId: string, pacoteId: string) {
  const [{ data: materiais }, { data: produtos }, { data: catalogo }, { data: orc }] = await Promise.all([
    supabase.from('pacote_tecnico_materiais').select('*').eq('pacote_id', pacoteId).eq('excluido', false).order('ordem'),
    supabase.from('produtos').select('id,codigo,nome,categoria,unidade,custo,peso_kg_m,tamanho_barra_mm,tamanho_barra_mm_origem').eq('ativo', true),
    supabase.from('catalogo_custos_tecnicos').select('*').eq('ativo', true),
    supabase.from('orcamentos').select('margem_padrao_pct').eq('id', orcamentoId).single(),
  ])
  const cfg = await carregarConfigs()
  const pMap = new Map((produtos || []).map((p: any) => [p.id, p]))
  const cProduto = new Map((catalogo || []).filter((c: any) => c.produto_id).map((c: any) => [c.produto_id, c]))
  const cCodigo = new Map((catalogo || []).filter((c: any) => c.codigo).map((c: any) => [codigoKey(c.codigo), c]))
  const margem = num(orc?.margem_padrao_pct, cfg.margemPadrao)

  await supabase.from('orcamento_precificacao_componentes').delete().eq('orcamento_id', orcamentoId).eq('incluido_manual', false)
  const linhas: any[] = []
  for (const m of (materiais || []) as MaterialPacote[]) {
    const produto = m.produto_id ? pMap.get(m.produto_id) : null
    const cat = m.produto_id ? cProduto.get(m.produto_id) : cCodigo.get(codigoKey(m.codigo))
    const custo = await custoMaterial(m, produto, cat, cfg)
    const quantidade = Math.max(0, num(m.quantidade_ajustada))
    const custoTotal = custo.custo * quantidade
    linhas.push({
      orcamento_id: orcamentoId,
      pacote_id: pacoteId,
      material_id: m.id,
      item_ref: m.item_ref || null,
      categoria: categoriaMaterial(m.categoria),
      produto_id: m.produto_id || null,
      catalogo_custo_id: cat?.id || null,
      codigo: m.codigo || null,
      descricao: m.descricao,
      unidade: m.unidade || 'UN',
      quantidade,
      custo_unitario: custo.custo,
      custo_total: custoTotal,
      margem_pct: margem,
      preco_venda: margemVenda(custoTotal, margem),
      origem_custo: m.status_calculo === 'pendente_formula' ? 'pendente' : custo.origem,
      custo_pendente: m.status_calculo === 'pendente_formula' || custo.pendente,
      incluido_manual: false,
      excluido: false,
      observacoes: m.justificativa_ajuste || null,
    })
  }
  if (linhas.length) await supabase.from('orcamento_precificacao_componentes').insert(linhas)
}

async function garantirPoliticas(orcamento: any) {
  const itens = Array.isArray(orcamento.itens) ? orcamento.itens : []
  const { data: existentes } = await supabase.from('orcamento_item_precificacao').select('*').eq('orcamento_id', orcamento.id)
  const refs = new Set((existentes || []).map((x: any) => x.item_ref))
  const novos = itens.map((item: any, idx: number) => itemRef(item, idx)).filter(ref => !refs.has(ref)).map(ref => ({
    orcamento_id: orcamento.id,
    item_ref: ref,
    margem_herda_geral: true,
    margem_pct: null,
    sobra_herda_geral: true,
    cobrar_sobra: null,
  }))
  if (novos.length) await supabase.from('orcamento_item_precificacao').insert(novos)
}

export async function gerarBasePrecificacao(orcamentoId: string, opcoes: { perdaCorteMm?: number; minimoSobraReaproveitavelMm?: number } = {}) {
  const usuario = await usuarioAtual()
  const { data: orcamento } = await supabase.from('orcamentos').select('*').eq('id', orcamentoId).maybeSingle()
  if (!orcamento) return { ok: false as const, error: 'Orçamento não encontrado.' }
  const gerado = await gerarPacoteTecnico(orcamentoId, 'orcamento_simulacao', usuario, opcoes)
  if (!gerado.ok) return gerado
  await supabase.from('pacotes_tecnicos').update({ status: 'substituido' }).eq('orcamento_id', orcamentoId).eq('origem', 'orcamento_simulacao').neq('id', gerado.pacote.id)
  await aplicarOverridesAoPacote(orcamentoId, gerado.pacote.id)
  await garantirPoliticas(orcamento)
  await gerarComponentesDoPacote(orcamentoId, gerado.pacote.id)
  await recalcularResumoPrecificacao(orcamentoId, gerado.pacote.id)
  return { ok: true as const, pacoteId: gerado.pacote.id }
}

export async function carregarPrecificacaoOrcamento(orcamentoId: string): Promise<PrecificacaoOrcamento | null> {
  const { data: orcamento } = await supabase.from('orcamentos').select('*,clientes(id,nome),obras(id,nome)').eq('id', orcamentoId).maybeSingle()
  if (!orcamento) return null
  await garantirPoliticas(orcamento)
  const { data: pacote } = await supabase.from('pacotes_tecnicos').select('*').eq('orcamento_id', orcamentoId).eq('origem', 'orcamento_simulacao').neq('status', 'substituido').order('versao', { ascending: false }).limit(1).maybeSingle()
  const completo = pacote ? await carregarPacoteCompleto(pacote.id) : { materiais: [], barras: [], cortes: [] }
  const [{ data: componentes }, { data: politicas }, { data: produtos }] = await Promise.all([
    supabase.from('orcamento_precificacao_componentes').select('*').eq('orcamento_id', orcamentoId).eq('excluido', false).order('categoria').order('descricao'),
    supabase.from('orcamento_item_precificacao').select('*').eq('orcamento_id', orcamentoId).order('created_at'),
    supabase.from('produtos').select('id,codigo,nome,categoria,unidade,custo,peso_kg_m,tamanho_barra_mm,tamanho_barra_mm_origem').eq('ativo', true).order('categoria').order('nome'),
  ])
  const itens = Array.isArray(orcamento.itens) ? orcamento.itens : []
  const tipologiaIds = Array.from(new Set(itens.map((i: any) => i?.tipologia_id).filter(Boolean))) as string[]
  const { data: fs } = tipologiaIds.length ? await supabase.from('engenharia_tipologia_formulas_corte').select('id,tipologia_id,configuracao_label,versao,status,ativo').in('tipologia_id', tipologiaIds).eq('ativo', true).order('status') : { data: [] as any[] }
  const formulas: Record<string, any> = {}
  for (const f of fs || []) if (!formulas[f.tipologia_id] || f.status === 'validada') formulas[f.tipologia_id] = f
  const pendencias = ((componentes || []) as any[]).filter(c => c.custo_pendente).map(c => `${c.codigo ? `${c.codigo} · ` : ''}${c.descricao}: custo ou regra técnica pendente.`)
  return {
    orcamento,
    pacote: (pacote || null) as PacoteTecnico | null,
    materiais: (completo.materiais || []) as MaterialPacote[],
    barras: completo.barras || [],
    cortes: completo.cortes || [],
    componentes: (componentes || []) as ComponentePrecificacao[],
    politicas: (politicas || []) as PoliticaItem[],
    formulas,
    produtos: (produtos || []) as ProdutoPrecificacao[],
    pendencias,
  }
}

export async function salvarPoliticaGeral(orcamentoId: string, margem: number, cobrarSobra: boolean) {
  const { error } = await supabase.from('orcamentos').update({ margem_padrao_pct: Math.min(99.9, Math.max(0, margem)), cobrar_sobra_padrao: cobrarSobra }).eq('id', orcamentoId)
  if (error) return { ok: false as const, error: error.message }
  const { data: pacote } = await supabase.from('pacotes_tecnicos').select('id').eq('orcamento_id', orcamentoId).eq('origem', 'orcamento_simulacao').neq('status','substituido').order('versao',{ascending:false}).limit(1).maybeSingle()
  if (pacote) await recalcularResumoPrecificacao(orcamentoId, pacote.id)
  return { ok: true as const }
}

export async function salvarPoliticaItem(orcamentoId: string, itemRefValue: string, patch: Partial<Pick<PoliticaItem,'margem_herda_geral'|'margem_pct'|'sobra_herda_geral'|'cobrar_sobra'>>) {
  const { error } = await supabase.from('orcamento_item_precificacao').update(patch).eq('orcamento_id', orcamentoId).eq('item_ref', itemRefValue)
  if (error) return { ok: false as const, error: error.message }
  const { data: pacote } = await supabase.from('pacotes_tecnicos').select('id').eq('orcamento_id', orcamentoId).eq('origem','orcamento_simulacao').neq('status','substituido').order('versao',{ascending:false}).limit(1).maybeSingle()
  if (pacote) await recalcularResumoPrecificacao(orcamentoId, pacote.id)
  return { ok: true as const }
}

export async function salvarCustoComponente(componente: ComponentePrecificacao, custoUnitario: number, salvarCatalogo: boolean) {
  const custo = Math.max(0, num(custoUnitario))
  const total = custo * num(componente.quantidade)
  const { error } = await supabase.from('orcamento_precificacao_componentes').update({
    custo_unitario: custo,
    custo_total: total,
    origem_custo: 'manual',
    custo_pendente: false,
  }).eq('id', componente.id)
  if (error) return { ok: false as const, error: error.message }

  if (salvarCatalogo) {
    const usuario = await usuarioAtual()
    let q = supabase.from('catalogo_custos_tecnicos').select('id').eq('ativo', true).limit(1)
    if (componente.produto_id) q = q.eq('produto_id', componente.produto_id)
    else if (componente.codigo) q = q.eq('categoria', componente.categoria).eq('codigo', componente.codigo)
    else q = q.eq('categoria', componente.categoria).eq('chave', componente.descricao.toLowerCase())
    const { data: existente } = await q.maybeSingle()
    const payload = {
      categoria: componente.categoria,
      produto_id: componente.produto_id || null,
      chave: componente.produto_id ? null : componente.descricao.toLowerCase(),
      codigo: componente.codigo || null,
      descricao: componente.descricao,
      unidade: componente.unidade,
      custo_unitario: custo,
      ativo: true,
      atualizado_por_id: usuario?.id || null,
      atualizado_por_nome: usuario?.nome || null,
    }
    if (existente) await supabase.from('catalogo_custos_tecnicos').update(payload).eq('id', existente.id)
    else await supabase.from('catalogo_custos_tecnicos').insert(payload)
  }
  const { data: pacote } = await supabase.from('pacotes_tecnicos').select('id').eq('orcamento_id', componente.orcamento_id).eq('origem','orcamento_simulacao').neq('status','substituido').order('versao',{ascending:false}).limit(1).maybeSingle()
  if (pacote) await recalcularResumoPrecificacao(componente.orcamento_id, pacote.id)
  return { ok: true as const }
}

export async function adicionarCustoExtra(dados: { orcamentoId: string; itemRef?: string | null; categoria: CategoriaPrecificacao; descricao: string; unidade?: string; quantidade: number; custoUnitario: number }) {
  const { data: orc } = await supabase.from('orcamentos').select('margem_padrao_pct').eq('id', dados.orcamentoId).single()
  const margem = num(orc?.margem_padrao_pct, 40)
  const qtd = Math.max(0, num(dados.quantidade, 1)); const custo = Math.max(0, num(dados.custoUnitario)); const total = qtd * custo
  const { data, error } = await supabase.from('orcamento_precificacao_componentes').insert({
    orcamento_id: dados.orcamentoId,
    item_ref: dados.itemRef || null,
    categoria: dados.categoria,
    descricao: dados.descricao.trim(),
    unidade: dados.unidade || 'UN',
    quantidade: qtd,
    custo_unitario: custo,
    custo_total: total,
    margem_pct: margem,
    preco_venda: margemVenda(total, margem),
    origem_custo: 'manual',
    custo_pendente: false,
    incluido_manual: true,
    excluido: false,
  }).select().single()
  if (error) return { ok: false as const, error: error.message }
  const { data: pacote } = await supabase.from('pacotes_tecnicos').select('id').eq('orcamento_id', dados.orcamentoId).eq('origem','orcamento_simulacao').neq('status','substituido').order('versao',{ascending:false}).limit(1).maybeSingle()
  if (pacote) await recalcularResumoPrecificacao(dados.orcamentoId, pacote.id)
  return { ok: true as const, componente: data as ComponentePrecificacao }
}

export async function excluirComponentePrecificacao(id: string, orcamentoId: string) {
  const { error } = await supabase.from('orcamento_precificacao_componentes').update({ excluido: true }).eq('id', id)
  if (error) return { ok: false as const, error: error.message }
  const { data: pacote } = await supabase.from('pacotes_tecnicos').select('id').eq('orcamento_id', orcamentoId).eq('origem','orcamento_simulacao').neq('status','substituido').order('versao',{ascending:false}).limit(1).maybeSingle()
  if (pacote) await recalcularResumoPrecificacao(orcamentoId, pacote.id)
  return { ok: true as const }
}

export async function trocarComponenteOrcamento(dados: {
  orcamentoId: string; itemRef: string; tipologiaId?: string|null; formulaId?: string|null; componenteTipo: 'perfil'|'acessorio'; codigoOrigem: string; produtoOrigemId?: string|null; produtoDestino: ProdutoPrecificacao; justificativa: string; escopo: 'orcamento'|'tipologia_definitiva'; comprimentoOverrideMm?: number|null; quantidadeOverride?: number|null
}) {
  if (dados.justificativa.trim().length < 3) return { ok: false as const, error: 'Informe o motivo da alteração.' }
  if (dados.escopo === 'tipologia_definitiva') {
    if (!dados.formulaId) return { ok: false as const, error: 'Esta tipologia não possui fórmula técnica identificada. Abra o Editor Técnico.' }
    const r = await substituirComponenteDefinitivo({ formulaId: dados.formulaId, componenteTipo: dados.componenteTipo, codigoOrigem: dados.codigoOrigem, codigoDestino: dados.produtoDestino.codigo || '', justificativa: dados.justificativa, orcamentoId: dados.orcamentoId, itemRef: dados.itemRef })
    if (!r.ok) return r
  } else {
    const usuario = await usuarioAtual()
    const r = await registrarOverrideOrcamento({
      orcamentoId: dados.orcamentoId, itemRef: dados.itemRef, tipologiaId: dados.tipologiaId || null, formulaId: dados.formulaId || null,
      componenteTipo: dados.componenteTipo, acao: 'substituir', codigoOrigem: dados.codigoOrigem, produtoOrigemId: dados.produtoOrigemId || null,
      codigoDestino: dados.produtoDestino.codigo || null, produtoDestinoId: dados.produtoDestino.id, descricaoDestino: dados.produtoDestino.nome,
      quantidadeOverride: dados.quantidadeOverride ?? null, comprimentoOverrideMm: dados.comprimentoOverrideMm ?? null, justificativa: dados.justificativa,
      criadoPorId: usuario?.id || null, criadoPorNome: usuario?.nome || null,
    })
    if (!r.ok) return r
  }
  return gerarBasePrecificacao(dados.orcamentoId)
}

export async function adicionarComponenteOrcamento(dados: {
  orcamentoId: string; itemRef: string; tipologiaId?: string|null; formulaId?: string|null; componenteTipo: 'perfil'|'acessorio'|'vidro'|'outro'; produto?: ProdutoPrecificacao|null; descricao: string; quantidade: number; comprimentoMm?: number|null; justificativa: string
}) {
  const usuario = await usuarioAtual()
  const r = await registrarOverrideOrcamento({
    orcamentoId: dados.orcamentoId, itemRef: dados.itemRef, tipologiaId: dados.tipologiaId || null, formulaId: dados.formulaId || null,
    componenteTipo: dados.componenteTipo, acao: 'adicionar', codigoDestino: dados.produto?.codigo || null, produtoDestinoId: dados.produto?.id || null,
    descricaoDestino: dados.produto?.nome || dados.descricao, quantidadeOverride: dados.quantidade, comprimentoOverrideMm: dados.comprimentoMm ?? null,
    justificativa: dados.justificativa, criadoPorId: usuario?.id || null, criadoPorNome: usuario?.nome || null,
  })
  if (!r.ok) return r
  return gerarBasePrecificacao(dados.orcamentoId)
}

export async function removerComponenteOrcamento(dados: { orcamentoId: string; itemRef: string; tipologiaId?: string|null; formulaId?: string|null; componenteTipo: 'perfil'|'acessorio'|'vidro'|'outro'; codigoOrigem?: string|null; produtoOrigemId?: string|null; justificativa: string }) {
  const usuario = await usuarioAtual()
  const r = await registrarOverrideOrcamento({
    orcamentoId: dados.orcamentoId, itemRef: dados.itemRef, tipologiaId: dados.tipologiaId || null, formulaId: dados.formulaId || null,
    componenteTipo: dados.componenteTipo, acao: 'remover', codigoOrigem: dados.codigoOrigem || null, produtoOrigemId: dados.produtoOrigemId || null,
    justificativa: dados.justificativa, criadoPorId: usuario?.id || null, criadoPorNome: usuario?.nome || null,
  })
  if (!r.ok) return r
  return gerarBasePrecificacao(dados.orcamentoId)
}

export async function recalcularResumoPrecificacao(orcamentoId: string, pacoteId: string) {
  const [{ data: orc }, { data: politicas }, { data: comps }, { data: barras }, { data: cortes }, { data: produtos }] = await Promise.all([
    supabase.from('orcamentos').select('id,itens,margem_padrao_pct,cobrar_sobra_padrao').eq('id', orcamentoId).single(),
    supabase.from('orcamento_item_precificacao').select('*').eq('orcamento_id', orcamentoId),
    supabase.from('orcamento_precificacao_componentes').select('*').eq('orcamento_id', orcamentoId).eq('excluido', false),
    supabase.from('pacote_tecnico_barras').select('*').eq('pacote_id', pacoteId),
    supabase.from('pacote_tecnico_cortes').select('*,pacote_tecnico_barras!inner(pacote_id)').eq('pacote_tecnico_barras.pacote_id', pacoteId),
    supabase.from('produtos').select('id,peso_kg_m').eq('ativo', true),
  ])
  if (!orc) return { ok: false as const, error: 'Orçamento não encontrado.' }
  const cfg = await carregarConfigs()
  const margemGeral = num(orc.margem_padrao_pct, cfg.margemPadrao)
  const sobraGeral = Boolean(orc.cobrar_sobra_padrao)
  const itens = Array.isArray(orc.itens) ? orc.itens : []
  const pMap = new Map((politicas || []).map((p: any) => [p.item_ref, p]))
  const pesoMap = new Map((produtos || []).map((p: any) => [p.id, num(p.peso_kg_m)]))
  const refs = itens.map((item: any, idx: number) => itemRef(item, idx))
  const custos = new Map<string, { produtivo: number; extras: number; sobra: number }>()
  refs.forEach(ref => custos.set(ref, { produtivo: 0, extras: 0, sobra: 0 }))
  let custoGlobal = 0; let vendaGlobal = 0
  const catsExtras = new Set(['mao_obra','instalacao','deslocamento','frete','pintura','terceiro','consumivel'])

  for (const c of comps || []) {
    const custo = num(c.custo_total)
    if (!c.item_ref || !custos.has(c.item_ref)) {
      custoGlobal += custo; vendaGlobal += margemVenda(custo, margemGeral); continue
    }
    const item = custos.get(c.item_ref)!
    if (catsExtras.has(c.categoria)) item.extras += custo
    else item.produtivo += custo
  }

  const cortesPorBarra = new Map<string, any[]>()
  for (const c of cortes || []) {
    const arr = cortesPorBarra.get(c.barra_id) || []; arr.push(c); cortesPorBarra.set(c.barra_id, arr)
  }
  let sobraTotalCusto = 0; let sobraCobrada = 0
  for (const b of barras || []) {
    if (b.fonte_tipo !== 'barra_nova' || num(b.sobra_final_mm) <= 0) continue
    const pesoM = pesoMap.get(b.produto_id) || 0
    if (pesoM <= 0 || pesoM >= 50 || cfg.precoKg <= 0) continue
    const custoSobra = (num(b.sobra_final_mm) / 1000) * pesoM * (cfg.precoKg + cfg.pinturaKg)
    sobraTotalCusto += custoSobra
    const barraCortes = cortesPorBarra.get(b.id) || []
    const elegiveis = barraCortes.filter((c: any) => {
      const pol: any = pMap.get(c.item_ref)
      const cobrar = pol ? (pol.sobra_herda_geral ? sobraGeral : Boolean(pol.cobrar_sobra)) : sobraGeral
      return c.item_ref && custos.has(c.item_ref) && cobrar
    })
    const totalCompr = elegiveis.reduce((s: number, c: any) => s + num(c.comprimento_mm), 0)
    if (totalCompr <= 0) continue
    for (const c of elegiveis) {
      const parte = custoSobra * (num(c.comprimento_mm) / totalCompr)
      custos.get(c.item_ref)!.sobra += parte; sobraCobrada += parte
    }
  }

  let valorTotal = vendaGlobal; let custoProdutivoTotal = custoGlobal
  for (const ref of refs) {
    const pol: any = pMap.get(ref) || {}
    const margem = pol.margem_herda_geral === false ? num(pol.margem_pct, margemGeral) : margemGeral
    const c = custos.get(ref) || { produtivo: 0, extras: 0, sobra: 0 }
    const base = c.produtivo + c.extras
    const venda = margemVenda(base, margem) + c.sobra
    valorTotal += venda; custoProdutivoTotal += base
    await supabase.from('orcamento_item_precificacao').update({
      custo_produtivo: c.produtivo,
      custo_extras: c.extras,
      custo_sobra: c.sobra,
      custo_total: base + c.sobra,
      preco_venda: venda,
    }).eq('orcamento_id', orcamentoId).eq('item_ref', ref)
    await supabase.from('orcamento_precificacao_componentes').update({ margem_pct: margem }).eq('orcamento_id', orcamentoId).eq('item_ref', ref)
  }
  for (const c of comps || []) {
    const pol: any = c.item_ref ? pMap.get(c.item_ref) : null
    const margem = pol && pol.margem_herda_geral === false ? num(pol.margem_pct, margemGeral) : margemGeral
    await supabase.from('orcamento_precificacao_componentes').update({ preco_venda: margemVenda(num(c.custo_total), margem), margem_pct: margem }).eq('id', c.id)
  }

  const otimizado = custoProdutivoTotal + sobraTotalCusto
  await supabase.from('orcamentos').update({
    valor_estimado: valorTotal,
    custo_estimado: otimizado,
    custo_otimizado: otimizado,
    custo_sobra_cobrada: sobraCobrada,
    otimizacao_orcamento: {
      pacote_id: pacoteId,
      barras_novas: (barras || []).filter((b: any) => b.fonte_tipo === 'barra_nova').length,
      sobras_reaproveitadas: (barras || []).filter((b: any) => b.fonte_tipo === 'sobra_estoque').length,
      sobra_total_mm: (barras || []).reduce((s: number, b: any) => s + num(b.sobra_final_mm), 0),
      custo_sobra_total: sobraTotalCusto,
      custo_sobra_cobrada: sobraCobrada,
      margem_geral_pct: margemGeral,
      atualizado_em: new Date().toISOString(),
    },
  }).eq('id', orcamentoId)
  return { ok: true as const, valorTotal, custoOtimizado: otimizado, sobraCobrada }
}
