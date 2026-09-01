import { supabase } from './supabase'
import type { Usuario } from './tipos'
import { calcularFormulaCorteIsolada, calcularFormulasCorte, type TipologiaFormulasCorte } from './formulasCorteEngine'
import { agruparCompraDeBarras, otimizarPerfis, type CortePerfil, type SobraPerfilDisponivel } from './aproveitamentoPerfis'

export type PacoteTecnico = {
  id: string
  orcamento_id?: string | null
  venda_obra_id?: string | null
  cliente_id?: string | null
  obra_id?: string | null
  origem: 'orcamento_simulacao' | 'projeto_conferido' | 'revisao' | 'medicao_final'
  versao: number
  status: string
  perda_corte_mm: number
  minimo_sobra_reaproveitavel_mm: number
  custo_previsto?: number | null
  custo_otimizado?: number | null
  snapshot_itens: any[]
  observacoes?: string | null
  created_at: string
  updated_at: string
}

export type MaterialPacote = {
  id: string
  pacote_id: string
  item_ref?: string | null
  categoria: 'perfil' | 'acessorio' | 'vidro' | 'outro' | 'contramarco'
  produto_id?: string | null
  codigo?: string | null
  descricao: string
  unidade: string
  cor_ref?: string | null
  quantidade_tecnica: number
  quantidade_ajustada: number
  comprimento_corte_mm?: number | null
  comprimento_barra_mm?: number | null
  origem_calculo: string
  status_calculo: 'calculado' | 'pendente_formula' | 'manual'
  incluido_manual: boolean
  excluido: boolean
  justificativa_ajuste?: string | null
  ordem: number
}

export type SobraPerfil = SobraPerfilDisponivel & {
  status: string
  local_id?: string | null
  endereco_id?: string | null
  obra_origem_id?: string | null
  pacote_reserva_id?: string | null
  obra_reserva_id?: string | null
  custo_residual?: number | null
  observacoes?: string | null
}

export type CompraPacote = {
  id: string
  pacote_id: string
  material_id?: string | null
  categoria: string
  produto_id?: string | null
  codigo?: string | null
  descricao: string
  unidade: string
  comprimento_barra_mm?: number | null
  quantidade_calculada: number
  quantidade_ajustada: number
  fornecedor_id?: string | null
  origem: 'automatico' | 'manual'
  excluido: boolean
  justificativa_ajuste?: string | null
  status: string
}

export type SeparacaoPacote = {
  id: string
  pacote_id: string
  material_id?: string | null
  produto_id: string
  tipo_origem: 'barra_inteira_estoque' | 'sobra_estoque' | 'manual'
  estoque_reserva_id?: string | null
  sobra_estoque_id?: string | null
  local_id?: string | null
  endereco_id?: string | null
  quantidade: number
  comprimento_disponivel_mm?: number | null
  comprimento_utilizado_mm?: number | null
  status: string
  observacoes?: string | null
}

type FormulaRow = {
  tipologia_id: string
  variaveis: TipologiaFormulasCorte['variaveis']
  pecas: TipologiaFormulasCorte['pecas']
  acessorios?: any[] | null
  vidro?: any | null
  status: string
  ativo: boolean
}

type ProdutoTecnico = {
  id: string
  codigo?: string | null
  nome: string
  categoria: string
  unidade?: string | null
  tamanho_barra_mm?: number | null
  custo?: number | null
  preco?: number | null
}

function n(v: any, fallback = 0) {
  const valor = Number(v)
  return Number.isFinite(valor) ? valor : fallback
}

function codigoKey(v?: string | null) {
  return (v || '').trim().toUpperCase()
}

function semContramarco(valor?: string | null) {
  const v = (valor || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim()
  return ['sem', 'nao', 'não', 'false', '0', 'sem contramarco', 'sem_contramarco'].includes(v)
}

function pecaEhContramarco(codigo?: string, descricao?: string) {
  return /^CM\d+/i.test(codigo || '') || /contramarco/i.test(descricao || '')
}

function itemRef(item: any, indice: number) {
  return String(item?.id || `item-${indice + 1}`)
}

async function carregarProdutosTecnicos() {
  const { data } = await supabase
    .from('produtos')
    .select('id,codigo,nome,categoria,unidade,tamanho_barra_mm,custo,preco')
    .eq('ativo', true)
    .not('codigo', 'is', null)
  const produtos = (data || []) as ProdutoTecnico[]
  const mapa = new Map<string, ProdutoTecnico>()
  produtos.forEach(p => { if (p.codigo) mapa.set(codigoKey(p.codigo), p) })
  return mapa
}

async function estadoAtualDoOrcamento(orcamento: any, origem: PacoteTecnico['origem']) {
  const { data: venda } = await supabase
    .from('vendas_obras')
    .select('id,cliente_id,obra_id,itens_snapshot,config_snapshot,custo_previsto')
    .eq('orcamento_id', orcamento.id)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()

  if (!venda || origem === 'orcamento_simulacao') {
    return {
      venda: null,
      itens: Array.isArray(orcamento.itens) ? orcamento.itens : [],
      config: { contramarco: orcamento.contramarco, acabamento: orcamento.acabamento },
      cliente_id: orcamento.cliente_id,
      obra_id: orcamento.obra_id,
      custo_previsto: null,
    }
  }

  const { data: estado } = await supabase.rpc('fn_venda_estado_atual_v1', { p_venda_obra_id: venda.id })
  const atual: any = estado || {}
  return {
    venda,
    itens: Array.isArray(atual?.itens_snapshot) ? atual.itens_snapshot : (venda.itens_snapshot || []),
    config: atual?.config_snapshot || venda.config_snapshot || {},
    cliente_id: venda.cliente_id || orcamento.cliente_id,
    obra_id: venda.obra_id || orcamento.obra_id,
    custo_previsto: venda.custo_previsto,
  }
}

function linhaPendente(pacoteId: string, item: any, indice: number, descricao: string, categoria: MaterialPacote['categoria'] = 'perfil') {
  return {
    pacote_id: pacoteId,
    item_ref: itemRef(item, indice),
    categoria,
    produto_id: null,
    codigo: null,
    descricao,
    unidade: categoria === 'perfil' ? 'MM' : 'UN',
    cor_ref: item?.cor || null,
    quantidade_tecnica: 0,
    quantidade_ajustada: 0,
    comprimento_corte_mm: null,
    comprimento_barra_mm: null,
    origem_calculo: 'formula',
    status_calculo: 'pendente_formula',
    incluido_manual: false,
    excluido: false,
    ordem: 999,
  }
}

/**
 * Gera o snapshot técnico a partir do orçamento/venda atual.
 * Somente fórmulas com status `validada` entram como cálculo automático.
 * Fórmulas em validação/referência viram pendência editável, nunca compra automática.
 */
export async function gerarPacoteTecnico(
  orcamentoId: string,
  origem: PacoteTecnico['origem'],
  usuario: Usuario | null,
  opcoes: { perdaCorteMm?: number; minimoSobraReaproveitavelMm?: number } = {}
): Promise<{ ok: true; pacote: PacoteTecnico } | { ok: false; error: string }> {
  const { data: orcamento, error: erroOrc } = await supabase
    .from('orcamentos')
    .select('id,cliente_id,obra_id,itens,contramarco,acabamento,valor_estimado')
    .eq('id', orcamentoId)
    .maybeSingle()
  if (erroOrc || !orcamento) return { ok: false, error: 'Orçamento não encontrado.' }

  const estado = await estadoAtualDoOrcamento(orcamento, origem)
  const itens = Array.isArray(estado.itens) ? estado.itens : []
  if (itens.length === 0) return { ok: false, error: 'O orçamento não possui itens estruturados.' }

  const tipologiaIds = Array.from(new Set(itens.map((i: any) => i?.tipologia_id).filter(Boolean))) as string[]
  const formulas = tipologiaIds.length > 0
    ? await supabase.from('engenharia_tipologia_formulas_corte').select('tipologia_id,variaveis,pecas,acessorios,vidro,status,ativo').in('tipologia_id', tipologiaIds).eq('ativo', true)
    : { data: [] as any[] }
  const formulaMapa = new Map<string, FormulaRow>()
  ;((formulas.data || []) as FormulaRow[]).forEach(f => formulaMapa.set(f.tipologia_id, f))
  const produtos = await carregarProdutosTecnicos()

  const { data: versoes } = await supabase
    .from('pacotes_tecnicos')
    .select('versao')
    .eq('orcamento_id', orcamentoId)
    .eq('origem', origem)
    .order('versao', { ascending: false })
    .limit(1)
  const versao = n(versoes?.[0]?.versao, 0) + 1

  const { data: pacoteRaw, error: erroPacote } = await supabase.from('pacotes_tecnicos').insert({
    orcamento_id: orcamentoId,
    venda_obra_id: estado.venda?.id || null,
    cliente_id: estado.cliente_id || null,
    obra_id: estado.obra_id || null,
    origem,
    versao,
    status: 'rascunho',
    perda_corte_mm: Math.max(0, n(opcoes.perdaCorteMm, 0)),
    minimo_sobra_reaproveitavel_mm: Math.max(0, n(opcoes.minimoSobraReaproveitavelMm, 0)),
    custo_previsto: estado.custo_previsto || null,
    snapshot_itens: itens,
    criado_por_id: usuario?.id || null,
    criado_por_nome: usuario?.nome || null,
  }).select().single()
  if (erroPacote || !pacoteRaw) return { ok: false, error: erroPacote?.message || 'Não foi possível criar o pacote técnico.' }
  const pacote = pacoteRaw as PacoteTecnico

  const materiais: any[] = []
  let ordem = 0

  for (let indice = 0; indice < itens.length; indice += 1) {
    const item: any = itens[indice]
    const largura = n(item?.largura_mm)
    const altura = n(item?.altura_mm)
    const qtdItem = Math.max(1, Math.floor(n(item?.quantidade, 1)))
    const tipologiaId = item?.tipologia_id as string | undefined
    const formula = tipologiaId ? formulaMapa.get(tipologiaId) : undefined
    const corRef = item?.cor || estado.config?.acabamento || orcamento.acabamento || null
    const contramarcoAtual = item?.contramarco || estado.config?.contramarco || orcamento.contramarco

    if (!tipologiaId || !formula || formula.status !== 'validada') {
      materiais.push(linhaPendente(pacote.id, item, indice, 'Perfis: fórmula técnica desta tipologia ainda não está validada.'))
      materiais.push(linhaPendente(pacote.id, item, indice, 'Acessórios: conferir/complementar manualmente antes da compra.', 'acessorio'))
      continue
    }
    if (largura <= 0 || altura <= 0) {
      materiais.push(linhaPendente(pacote.id, item, indice, 'Perfis: medidas insuficientes para calcular cortes.'))
      continue
    }

    try {
      const resultados = calcularFormulasCorte({
        tipologia_id: formula.tipologia_id,
        variaveis: Array.isArray(formula.variaveis) ? formula.variaveis : [],
        pecas: Array.isArray(formula.pecas) ? formula.pecas : [],
      }, largura, altura, (item?.variaveis || {}) as Record<string, string>)

      for (const peca of resultados) {
        if (semContramarco(contramarcoAtual) && pecaEhContramarco(peca.codigo, peca.descricao)) continue
        const produto = produtos.get(codigoKey(peca.codigo))
        const quantidade = Math.max(1, n(peca.quantidade, 1)) * qtdItem
        const barra = n(produto?.tamanho_barra_mm)
        materiais.push({
          pacote_id: pacote.id,
          item_ref: itemRef(item, indice),
          categoria: pecaEhContramarco(peca.codigo, peca.descricao) ? 'contramarco' : 'perfil',
          produto_id: produto?.id || null,
          codigo: peca.codigo,
          descricao: peca.descricao || produto?.nome || peca.codigo,
          unidade: 'UN',
          cor_ref: corRef,
          quantidade_tecnica: quantidade,
          quantidade_ajustada: quantidade,
          comprimento_corte_mm: peca.tamanho,
          comprimento_barra_mm: barra || null,
          origem_calculo: 'formula',
          status_calculo: produto?.id && barra > 0 ? 'calculado' : 'pendente_formula',
          incluido_manual: false,
          excluido: false,
          justificativa_ajuste: !produto?.id ? 'Código calculado sem produto correspondente no cadastro.' : barra <= 0 ? 'Perfil sem tamanho de barra cadastrado.' : null,
          ordem: ordem++,
        })
      }
    } catch (erro) {
      materiais.push(linhaPendente(pacote.id, item, indice, `Perfis: ${erro instanceof Error ? erro.message : 'erro no cálculo técnico'}.`))
    }

    const acessorios = Array.isArray(formula.acessorios) ? formula.acessorios : []
    if (acessorios.length === 0) {
      materiais.push(linhaPendente(pacote.id, item, indice, 'Acessórios ainda não validados para esta tipologia.', 'acessorio'))
    } else {
      for (const acessorio of acessorios) {
        const produto = produtos.get(codigoKey(acessorio?.codigo))
        const statusValidado = acessorio?.status === 'validada'
        let quantidade = n(acessorio?.quantidade_referencia)
        if (statusValidado && acessorio?.formula_quantidade) {
          try { quantidade = calcularFormulaCorteIsolada(String(acessorio.formula_quantidade), largura, altura) } catch { /* permanece pendente */ }
        }
        quantidade *= qtdItem
        materiais.push({
          pacote_id: pacote.id,
          item_ref: itemRef(item, indice),
          categoria: 'acessorio',
          produto_id: produto?.id || null,
          codigo: acessorio?.codigo || null,
          descricao: acessorio?.descricao || produto?.nome || acessorio?.codigo || 'Acessório pendente',
          unidade: acessorio?.unidade || produto?.unidade || 'UN',
          cor_ref: acessorio?.cor || corRef,
          quantidade_tecnica: Math.max(0, quantidade),
          quantidade_ajustada: Math.max(0, quantidade),
          comprimento_corte_mm: null,
          comprimento_barra_mm: null,
          origem_calculo: 'formula',
          status_calculo: statusValidado && produto?.id ? 'calculado' : 'pendente_formula',
          incluido_manual: false,
          excluido: false,
          justificativa_ajuste: statusValidado ? (!produto?.id ? 'Código sem produto correspondente no cadastro.' : null) : `Referência técnica com status ${acessorio?.status || 'pendente'}; confirmar antes da compra.`,
          ordem: ordem++,
        })
      }
    }

    const vidro = formula.vidro && typeof formula.vidro === 'object' ? formula.vidro : null
    if (vidro?.formula_largura && vidro?.formula_altura) {
      try {
        const larguraVidro = calcularFormulaCorteIsolada(String(vidro.formula_largura), largura, altura)
        const alturaVidro = calcularFormulaCorteIsolada(String(vidro.formula_altura), largura, altura)
        const qtdVidro = Math.max(1, n(vidro.quantidade, 1)) * qtdItem
        materiais.push({
          pacote_id: pacote.id,
          item_ref: itemRef(item, indice),
          categoria: 'vidro',
          produto_id: null,
          codigo: null,
          descricao: `Vidro provisório ${Math.round(larguraVidro)} × ${Math.round(alturaVidro)} mm`,
          unidade: 'UN',
          cor_ref: null,
          quantidade_tecnica: qtdVidro,
          quantidade_ajustada: qtdVidro,
          comprimento_corte_mm: null,
          comprimento_barra_mm: null,
          origem_calculo: 'formula',
          status_calculo: origem === 'medicao_final' ? 'calculado' : 'pendente_formula',
          incluido_manual: false,
          excluido: false,
          justificativa_ajuste: origem === 'medicao_final' ? null : 'Dimensão provisória. Compra/corte do vidro só é liberado após Medição Final aprovada.',
          ordem: ordem++,
        })
      } catch {
        materiais.push(linhaPendente(pacote.id, item, indice, 'Vidro: fórmula/dimensão ainda pendente de Medição Final.', 'vidro'))
      }
    }
  }

  if (materiais.length > 0) {
    const { error } = await supabase.from('pacote_tecnico_materiais').insert(materiais)
    if (error) return { ok: false, error: error.message }
  }

  await recalcularAproveitamentoPacote(pacote.id, [])
  await supabase.from('pacotes_tecnicos').update({ status: 'calculado' }).eq('id', pacote.id)
  return { ok: true, pacote: { ...pacote, status: 'calculado' } }
}

export async function listarPacotesDaObra(obraId: string): Promise<PacoteTecnico[]> {
  const { data } = await supabase.from('pacotes_tecnicos').select('*').eq('obra_id', obraId).order('created_at', { ascending: false })
  return (data || []) as PacoteTecnico[]
}

export async function carregarPacoteCompleto(pacoteId: string) {
  const [p, m, b, c, s, cp] = await Promise.all([
    supabase.from('pacotes_tecnicos').select('*').eq('id', pacoteId).maybeSingle(),
    supabase.from('pacote_tecnico_materiais').select('*').eq('pacote_id', pacoteId).order('categoria').order('ordem'),
    supabase.from('pacote_tecnico_barras').select('*').eq('pacote_id', pacoteId).order('ordem'),
    supabase.from('pacote_tecnico_cortes').select('*,pacote_tecnico_barras!inner(pacote_id)').eq('pacote_tecnico_barras.pacote_id', pacoteId).order('ordem'),
    supabase.from('pacote_tecnico_separacoes').select('*').eq('pacote_id', pacoteId).neq('status', 'cancelado').order('created_at'),
    supabase.from('pacote_tecnico_compras').select('*').eq('pacote_id', pacoteId).order('categoria').order('created_at'),
  ])
  return {
    pacote: (p.data || null) as PacoteTecnico | null,
    materiais: (m.data || []) as MaterialPacote[],
    barras: (b.data || []) as any[],
    cortes: (c.data || []) as any[],
    separacoes: (s.data || []) as SeparacaoPacote[],
    compras: (cp.data || []) as CompraPacote[],
  }
}

export async function listarSobrasDisponiveis(produtoIds?: string[]): Promise<SobraPerfil[]> {
  let q = supabase.from('estoque_sobras_perfis').select('*').in('status', ['disponivel', 'reservada']).order('produto_id').order('comprimento_mm')
  if (produtoIds?.length) q = q.in('produto_id', produtoIds)
  const { data } = await q
  return (data || []) as SobraPerfil[]
}

export async function recalcularAproveitamentoPacote(pacoteId: string, sobraIds: string[]) {
  const [{ data: pacote }, { data: materiais }, { data: sobras }, { data: separacoes }] = await Promise.all([
    supabase.from('pacotes_tecnicos').select('*').eq('id', pacoteId).maybeSingle(),
    supabase.from('pacote_tecnico_materiais').select('*').eq('pacote_id', pacoteId).in('categoria', ['perfil', 'contramarco']).eq('excluido', false),
    sobraIds.length ? supabase.from('estoque_sobras_perfis').select('*').in('id', sobraIds) : Promise.resolve({ data: [] as any[] }),
    supabase.from('pacote_tecnico_separacoes').select('*').eq('pacote_id', pacoteId).eq('tipo_origem', 'barra_inteira_estoque').neq('status', 'cancelado'),
  ])
  if (!pacote) return { ok: false as const, error: 'Pacote técnico não encontrado.' }

  const cortes: CortePerfil[] = ((materiais || []) as MaterialPacote[])
    .filter(m => m.status_calculo !== 'pendente_formula' && m.produto_id && n(m.comprimento_corte_mm) > 0 && n(m.comprimento_barra_mm) > 0 && n(m.quantidade_ajustada) > 0)
    .map(m => ({
      id: m.id,
      material_id: m.id,
      item_ref: m.item_ref || null,
      produto_id: m.produto_id!,
      codigo: m.codigo || m.descricao,
      cor_ref: m.cor_ref || null,
      comprimento_mm: n(m.comprimento_corte_mm),
      quantidade: n(m.quantidade_ajustada),
      comprimento_barra_mm: n(m.comprimento_barra_mm),
    }))

  const resultado = otimizarPerfis(cortes, (sobras || []) as SobraPerfilDisponivel[], {
    perdaCorteMm: n(pacote.perda_corte_mm),
    minimoSobraReaproveitavelMm: n(pacote.minimo_sobra_reaproveitavel_mm),
  })

  const { data: barrasAntigas } = await supabase.from('pacote_tecnico_barras').select('id').eq('pacote_id', pacoteId)
  if (barrasAntigas?.length) await supabase.from('pacote_tecnico_barras').delete().eq('pacote_id', pacoteId)

  for (let i = 0; i < resultado.barras.length; i += 1) {
    const barra = resultado.barras[i]
    const { data: criada, error } = await supabase.from('pacote_tecnico_barras').insert({
      pacote_id: pacoteId,
      produto_id: barra.produto_id,
      cor_ref: barra.cor_ref || null,
      fonte_tipo: barra.fonte_tipo,
      sobra_estoque_id: barra.sobra_estoque_id || null,
      comprimento_inicial_mm: barra.comprimento_inicial_mm,
      comprimento_usado_mm: barra.comprimento_usado_mm,
      sobra_final_mm: barra.sobra_final_mm,
      reaproveitavel: barra.reaproveitavel,
      ordem: i,
    }).select('id').single()
    if (error || !criada) return { ok: false as const, error: error?.message || 'Erro ao salvar barras.' }
    if (barra.cortes.length) {
      await supabase.from('pacote_tecnico_cortes').insert(barra.cortes.map((corte, ordem) => ({
        barra_id: criada.id,
        material_id: corte.material_id || null,
        item_ref: corte.item_ref || null,
        codigo: corte.codigo,
        comprimento_mm: corte.comprimento_mm,
        perda_corte_mm: corte.perda_corte_mm,
        ordem,
      })))
    }
  }

  // Recria somente linhas automáticas de perfis. Itens manuais são preservados.
  await supabase.from('pacote_tecnico_compras').delete().eq('pacote_id', pacoteId).eq('categoria', 'perfil').eq('origem', 'automatico')
  await supabase.from('pacote_tecnico_compras').delete().eq('pacote_id', pacoteId).eq('categoria', 'contramarco').eq('origem', 'automatico')

  const separadasPorProduto = new Map<string, number>()
  ;((separacoes || []) as SeparacaoPacote[]).forEach(s => separadasPorProduto.set(s.produto_id, (separadasPorProduto.get(s.produto_id) || 0) + n(s.quantidade)))
  const compraBarras = agruparCompraDeBarras(resultado)
  const materiaisMapa = new Map<string, MaterialPacote>()
  ;((materiais || []) as MaterialPacote[]).forEach(m => { if (m.produto_id && !materiaisMapa.has(m.produto_id)) materiaisMapa.set(m.produto_id, m) })

  if (compraBarras.length) {
    await supabase.from('pacote_tecnico_compras').insert(compraBarras.map(item => {
      const material = materiaisMapa.get(item.produto_id)
      const separadas = separadasPorProduto.get(item.produto_id) || 0
      const faltante = Math.max(0, item.quantidade - separadas)
      return {
        pacote_id: pacoteId,
        material_id: material?.id || null,
        categoria: material?.categoria === 'contramarco' ? 'contramarco' : 'perfil',
        produto_id: item.produto_id,
        codigo: item.codigo,
        descricao: material?.descricao || item.codigo,
        unidade: 'BARRA',
        comprimento_barra_mm: item.comprimento_barra_mm,
        quantidade_calculada: item.quantidade,
        quantidade_ajustada: faltante,
        origem: 'automatico',
        status: 'pendente',
      }
    }))
  }

  // Demais materiais calculados entram na lista apenas quando a regra está validada.
  const demais = ((await supabase.from('pacote_tecnico_materiais').select('*').eq('pacote_id', pacoteId).not('categoria', 'in', '(perfil,contramarco)').eq('excluido', false)).data || []) as MaterialPacote[]
  await supabase.from('pacote_tecnico_compras').delete().eq('pacote_id', pacoteId).neq('categoria', 'perfil').neq('categoria', 'contramarco').eq('origem', 'automatico')
  const calculados = demais.filter(m => m.status_calculo === 'calculado' && n(m.quantidade_ajustada) > 0)
  if (calculados.length) {
    await supabase.from('pacote_tecnico_compras').insert(calculados.map(m => ({
      pacote_id: pacoteId,
      material_id: m.id,
      categoria: m.categoria,
      produto_id: m.produto_id || null,
      codigo: m.codigo || null,
      descricao: m.descricao,
      unidade: m.unidade,
      quantidade_calculada: m.quantidade_ajustada,
      quantidade_ajustada: m.quantidade_ajustada,
      origem: 'automatico',
      status: 'pendente',
    })))
  }

  await supabase.from('pacotes_tecnicos').update({ status: 'calculado' }).eq('id', pacoteId)
  return { ok: true as const, resultado }
}

export async function ajustarMaterial(materialId: string, patch: {
  quantidade_ajustada?: number
  comprimento_corte_mm?: number | null
  comprimento_barra_mm?: number | null
  codigo?: string | null
  descricao?: string
  produto_id?: string | null
  justificativa_ajuste: string
}) {
  if (patch.justificativa_ajuste.trim().length < 3) return { ok: false, error: 'Informe o motivo do ajuste.' }
  const { error } = await supabase.from('pacote_tecnico_materiais').update({
    ...patch,
    status_calculo: 'manual',
    justificativa_ajuste: patch.justificativa_ajuste.trim(),
  }).eq('id', materialId)
  return error ? { ok: false, error: error.message } : { ok: true }
}

export async function adicionarMaterialManual(pacoteId: string, dados: {
  categoria: MaterialPacote['categoria']
  produto_id?: string | null
  codigo?: string | null
  descricao: string
  unidade: string
  cor_ref?: string | null
  quantidade: number
  comprimento_corte_mm?: number | null
  comprimento_barra_mm?: number | null
  justificativa: string
}) {
  if (!dados.descricao.trim()) return { ok: false, error: 'Informe o material.' }
  if (dados.justificativa.trim().length < 3) return { ok: false, error: 'Informe o motivo da inclusão.' }
  const { data, error } = await supabase.from('pacote_tecnico_materiais').insert({
    pacote_id: pacoteId,
    categoria: dados.categoria,
    produto_id: dados.produto_id || null,
    codigo: dados.codigo || null,
    descricao: dados.descricao.trim(),
    unidade: dados.unidade || 'UN',
    cor_ref: dados.cor_ref || null,
    quantidade_tecnica: 0,
    quantidade_ajustada: Math.max(0, n(dados.quantidade)),
    comprimento_corte_mm: dados.comprimento_corte_mm || null,
    comprimento_barra_mm: dados.comprimento_barra_mm || null,
    origem_calculo: 'manual',
    status_calculo: 'manual',
    incluido_manual: true,
    excluido: false,
    justificativa_ajuste: dados.justificativa.trim(),
    ordem: 10000,
  }).select().single()
  return error ? { ok: false, error: error.message } : { ok: true, material: data as MaterialPacote }
}

export async function excluirMaterialDoPacote(materialId: string, justificativa: string) {
  if (justificativa.trim().length < 3) return { ok: false, error: 'Informe o motivo da retirada.' }
  const { error } = await supabase.from('pacote_tecnico_materiais').update({ excluido: true, justificativa_ajuste: justificativa.trim() }).eq('id', materialId)
  return error ? { ok: false, error: error.message } : { ok: true }
}

export async function ajustarCompra(compraId: string, quantidade: number, justificativa: string) {
  if (justificativa.trim().length < 3) return { ok: false, error: 'Informe o motivo do ajuste da compra.' }
  const { error } = await supabase.from('pacote_tecnico_compras').update({
    quantidade_ajustada: Math.max(0, n(quantidade)),
    justificativa_ajuste: justificativa.trim(),
  }).eq('id', compraId)
  return error ? { ok: false, error: error.message } : { ok: true }
}

export async function adicionarCompraManual(pacoteId: string, dados: {
  categoria: CompraPacote['categoria']
  produto_id?: string | null
  codigo?: string | null
  descricao: string
  unidade: string
  comprimento_barra_mm?: number | null
  quantidade: number
  justificativa: string
}) {
  if (!dados.descricao.trim() || dados.justificativa.trim().length < 3) return { ok: false, error: 'Informe material e motivo.' }
  const { data, error } = await supabase.from('pacote_tecnico_compras').insert({
    pacote_id: pacoteId,
    categoria: dados.categoria,
    produto_id: dados.produto_id || null,
    codigo: dados.codigo || null,
    descricao: dados.descricao.trim(),
    unidade: dados.unidade || 'UN',
    comprimento_barra_mm: dados.comprimento_barra_mm || null,
    quantidade_calculada: 0,
    quantidade_ajustada: Math.max(0, n(dados.quantidade)),
    origem: 'manual',
    justificativa_ajuste: dados.justificativa.trim(),
    status: 'pendente',
  }).select().single()
  return error ? { ok: false, error: error.message } : { ok: true, compra: data as CompraPacote }
}

export async function separarBarraInteira(pacote: PacoteTecnico, dados: {
  material_id?: string | null
  produto_id: string
  local_id: string
  endereco_id?: string | null
  quantidade: number
  usuario: Usuario | null
  observacoes?: string
}) {
  const quantidade = Math.max(0, n(dados.quantidade))
  if (quantidade <= 0) return { ok: false, error: 'Quantidade inválida.' }
  const { data: reserva, error: erroReserva } = await supabase.from('estoque_reservas').insert({
    produto_id: dados.produto_id,
    local_id: dados.local_id,
    endereco_id: dados.endereco_id || null,
    quantidade,
    status: 'ativa',
    origem_tipo: 'pacote_tecnico',
    origem_id: pacote.id,
    cliente_id: pacote.cliente_id || null,
    observacoes: dados.observacoes || `Separado para pacote técnico ${pacote.id}`,
    criado_por_id: dados.usuario?.id || null,
    criado_por_nome: dados.usuario?.nome || null,
  }).select('id').single()
  if (erroReserva || !reserva) return { ok: false, error: erroReserva?.message || 'Não foi possível reservar o estoque.' }

  const { data, error } = await supabase.from('pacote_tecnico_separacoes').insert({
    pacote_id: pacote.id,
    material_id: dados.material_id || null,
    produto_id: dados.produto_id,
    tipo_origem: 'barra_inteira_estoque',
    estoque_reserva_id: reserva.id,
    local_id: dados.local_id,
    endereco_id: dados.endereco_id || null,
    quantidade,
    status: 'reservado',
    observacoes: dados.observacoes || null,
    criado_por_id: dados.usuario?.id || null,
    criado_por_nome: dados.usuario?.nome || null,
  }).select().single()
  if (error) {
    await supabase.from('estoque_reservas').update({ status: 'cancelada' }).eq('id', reserva.id)
    return { ok: false, error: error.message }
  }
  return { ok: true, separacao: data as SeparacaoPacote }
}

export async function reservarSobraPerfil(pacote: PacoteTecnico, sobra: SobraPerfil, usuario: Usuario | null) {
  if (sobra.status === 'reservada' && sobra.pacote_reserva_id !== pacote.id) return { ok: false, error: 'Esta sobra já está reservada para outro pacote.' }
  const { error: erroSobra } = await supabase.from('estoque_sobras_perfis').update({
    status: 'reservada',
    pacote_reserva_id: pacote.id,
    obra_reserva_id: pacote.obra_id || null,
    reservado_por_id: usuario?.id || null,
    reservado_por_nome: usuario?.nome || null,
    reservado_em: new Date().toISOString(),
  }).eq('id', sobra.id)
  if (erroSobra) return { ok: false, error: erroSobra.message }

  const { data, error } = await supabase.from('pacote_tecnico_separacoes').insert({
    pacote_id: pacote.id,
    produto_id: sobra.produto_id,
    tipo_origem: 'sobra_estoque',
    sobra_estoque_id: sobra.id,
    local_id: sobra.local_id || null,
    endereco_id: sobra.endereco_id || null,
    quantidade: 1,
    comprimento_disponivel_mm: sobra.comprimento_mm,
    status: 'reservado',
    criado_por_id: usuario?.id || null,
    criado_por_nome: usuario?.nome || null,
  }).select().single()
  if (error) {
    await supabase.from('estoque_sobras_perfis').update({ status: 'disponivel', pacote_reserva_id: null, obra_reserva_id: null }).eq('id', sobra.id)
    return { ok: false, error: error.message }
  }
  return { ok: true, separacao: data as SeparacaoPacote }
}
