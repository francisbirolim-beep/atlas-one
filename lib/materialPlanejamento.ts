import { supabase } from './supabase'
import type { Usuario } from './tipos'
import { calcularFormulaCorteIsolada, calcularFormulasCorte, type TipologiaFormulasCorte } from './formulasCorteEngine'
import { calcularAcessoriosTecnicos } from './formulasAcessoriosEngine'
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
  custo_wvetro?: number | null
  venda_wvetro?: number | null
  wvetro_dados?: Record<string, any> | null
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
  id?: string
  tipologia_id: string
  configuracao_label?: string | null
  versao?: number | null
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
  unidade_origem?: string | null
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

function folhasDoItem(item: any) {
  const candidatos = [
    item?.folhas,
    item?.numero_folhas,
    item?.qtd_folhas,
    item?.variaveis?.numero_folhas,
    item?.variaveis?.folhas,
    item?.variaveis?.Folhas,
  ]
  for (const candidato of candidatos) {
    const valor = Math.floor(n(candidato))
    if (valor > 0) return valor
  }
  return 1
}

async function carregarProdutosTecnicos(codigos?: string[]) {
  const codigosUnicos = Array.from(new Set((codigos || []).map(codigoKey).filter(Boolean)))
  const produtos: ProdutoTecnico[] = []

  // O catálogo da Esquadrifácio já passa de 1.000 itens. Uma leitura sem filtro
  // fica sujeita ao limite padrão do PostgREST e fazia códigos válidos "sumirem"
  // da composição. Para cálculo técnico buscamos somente os códigos usados nas
  // fórmulas selecionadas, em lotes pequenos.
  if (codigosUnicos.length) {
    for (let i = 0; i < codigosUnicos.length; i += 150) {
      const lote = codigosUnicos.slice(i, i + 150)
      const { data } = await supabase
        .from('produtos')
        .select('id,codigo,nome,categoria,unidade,unidade_origem,tamanho_barra_mm,custo,preco')
        .eq('ativo', true)
        .in('codigo', lote)
      produtos.push(...((data || []) as ProdutoTecnico[]))
    }
  } else {
    // Mantém compatibilidade para chamadas sem uma receita conhecida,
    // paginando para não truncar o catálogo.
    const tamanhoPagina = 1000
    for (let inicio = 0; ; inicio += tamanhoPagina) {
      const { data } = await supabase
        .from('produtos')
        .select('id,codigo,nome,categoria,unidade,unidade_origem,tamanho_barra_mm,custo,preco')
        .eq('ativo', true)
        .not('codigo', 'is', null)
        .range(inicio, inicio + tamanhoPagina - 1)
      const pagina = (data || []) as ProdutoTecnico[]
      produtos.push(...pagina)
      if (pagina.length < tamanhoPagina) break
    }
  }

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
  const itensVenda = Array.isArray(atual?.itens_snapshot) ? atual.itens_snapshot : (venda.itens_snapshot || [])
  const configVenda = atual?.config_snapshot || venda.config_snapshot || {}

  if (origem === 'medicao_final') {
    const { data: medicao } = await supabase
      .from('medicoes_finais')
      .select('id,status_operacional,aprovado_em')
      .eq('orcamento_id', orcamento.id)
      .eq('tipo_medicao', 'tipologia')
      .eq('status_operacional', 'aprovado')
      .order('aprovado_em', { ascending: false, nullsFirst: false })
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (!medicao?.id) {
      return {
        venda,
        itens: [],
        config: configVenda,
        cliente_id: venda.cliente_id || orcamento.cliente_id,
        obra_id: venda.obra_id || orcamento.obra_id,
        custo_previsto: venda.custo_previsto,
      }
    }

    const { data: itensMedicao } = await supabase
      .from('medicao_itens')
      .select('id,ordem,descricao,ambiente,quantidade,medido,status_medicao,contramarco,producao_largura_mm,producao_altura_mm,largura_baixo_mm,largura_meio_mm,largura_cima_mm,altura_direita_mm,altura_meio_mm,altura_esquerda_mm')
      .eq('medicao_id', medicao.id)
      .eq('medido', true)
      .order('ordem', { ascending: true })

    const listaMedida = Array.isArray(itensMedicao) ? itensMedicao : []
    const usaBlocosDeOrdem = listaMedida.some((item: any) => Number(item?.ordem || 0) >= 100)

    const menorPositiva = (valores: unknown[]) => {
      const validos = valores.map(Number).filter(v => Number.isFinite(v) && v > 0)
      return validos.length ? Math.min(...validos) : 0
    }

    const itensFinais = listaMedida.flatMap((med: any) => {
      const ordem = Math.max(0, Math.floor(Number(med?.ordem || 0)))
      const indice = usaBlocosDeOrdem ? Math.floor(ordem / 100) : ordem
      const base = itensVenda[indice]
      if (!base) return []

      const largura = Number(med?.producao_largura_mm) > 0
        ? Number(med.producao_largura_mm)
        : menorPositiva([med?.largura_baixo_mm, med?.largura_meio_mm, med?.largura_cima_mm])
      const altura = Number(med?.producao_altura_mm) > 0
        ? Number(med.producao_altura_mm)
        : menorPositiva([med?.altura_direita_mm, med?.altura_meio_mm, med?.altura_esquerda_mm])

      if (largura <= 0 || altura <= 0) return []

      return [{
        ...base,
        ambiente: med?.ambiente || base?.ambiente || null,
        descricao: med?.descricao || base?.descricao || null,
        contramarco: med?.contramarco || base?.contramarco || null,
        largura_mm: largura,
        altura_mm: altura,
        quantidade: 1,
        medicao_final: {
          medicao_id: medicao.id,
          medicao_item_id: med.id,
          largura_mm: largura,
          altura_mm: altura,
          larguras_mm: [med?.largura_baixo_mm, med?.largura_meio_mm, med?.largura_cima_mm],
          alturas_mm: [med?.altura_direita_mm, med?.altura_meio_mm, med?.altura_esquerda_mm],
          aprovado_em: medicao.aprovado_em || null,
        },
      }]
    })

    return {
      venda,
      itens: itensFinais,
      config: configVenda,
      cliente_id: venda.cliente_id || orcamento.cliente_id,
      obra_id: venda.obra_id || orcamento.obra_id,
      custo_previsto: venda.custo_previsto,
    }
  }

  return {
    venda,
    itens: itensVenda,
    config: configVenda,
    cliente_id: venda.cliente_id || orcamento.cliente_id,
    obra_id: venda.obra_id || orcamento.obra_id,
    custo_previsto: venda.custo_previsto,
  }
}

function candidatosCodigoWvetro(raw: any) {
  const codigo = String(raw?.Codigo || raw?.codigo || '').trim()
  const seuCodigo = String(raw?.SeuCodigo || raw?.seuCodigo || '').trim()
  const antesParenteses = codigo.split('(')[0]?.trim()
  const dentroParenteses = codigo.match(/\(([^)]+)\)/)?.[1]?.trim() || ''
  return Array.from(new Set([seuCodigo, codigo, antesParenteses, dentroParenteses].filter(Boolean)))
}

function produtoWvetro(raw: any, produtos: Map<string, ProdutoTecnico>) {
  for (const codigo of candidatosCodigoWvetro(raw)) {
    const produto = produtos.get(codigoKey(codigo))
    if (produto) return produto
  }
  return null
}

function materiaisDoOrcamentoWvetro(
  pacoteId: string,
  item: any,
  indice: number,
  produtos: Map<string, ProdutoTecnico>,
  corRef: string | null,
  ordemInicial: number,
) {
  const comp = item?.wvetro_composicao
  if (!comp || typeof comp !== 'object') return { linhas: [] as any[], proximaOrdem: ordemInicial }

  const grupos: Array<{ categoria: 'perfil' | 'acessorio' | 'vidro'; lista: any[] }> = [
    { categoria: 'perfil', lista: Array.isArray(comp.perfis) ? comp.perfis : [] },
    { categoria: 'acessorio', lista: Array.isArray(comp.acessorios) ? comp.acessorios : [] },
    { categoria: 'vidro', lista: Array.isArray(comp.vidros) ? comp.vidros : [] },
  ]
  const linhas: any[] = []
  let ordem = ordemInicial

  for (const grupo of grupos) {
    for (const raw of grupo.lista) {
      const produto = produtoWvetro(raw, produtos)
      const quantidade = grupo.categoria === 'vidro'
        ? Math.max(0, n(raw?.M2 ?? raw?.M2Arred ?? raw?.Qtde, 0))
        : Math.max(0, n(raw?.Qtde ?? raw?.Quantidade, 0))
      const medidaM = grupo.categoria === 'perfil' ? Math.max(0, n(raw?.Medida, 0)) : 0
      const comprimentoMm = medidaM > 0 ? Math.round(medidaM * 1000) : null
      const codigo = String(raw?.Codigo || raw?.SeuCodigo || produto?.codigo || '').trim() || null
      const descricao = String(raw?.Nome || raw?.Especificacao || produto?.nome || codigo || 'Componente W.Vetro').trim()
      const unidade = grupo.categoria === 'vidro'
        ? 'M2'
        : (produto?.unidade_origem || produto?.unidade || (grupo.categoria === 'perfil' ? 'UN' : 'UN'))
      const detalhes = [
        raw?.Posicao ? `posição ${raw.Posicao}` : '',
        raw?.Corte ? `corte ${raw.Corte}` : '',
        raw?.CustoVlr ? `custo W.Vetro R$ ${raw.CustoVlr}` : '',
        raw?.VendaVlr ? `venda W.Vetro R$ ${raw.VendaVlr}` : '',
      ].filter(Boolean).join(' · ')

      linhas.push({
        pacote_id: pacoteId,
        item_ref: itemRef(item, indice),
        categoria: grupo.categoria,
        produto_id: produto?.id || null,
        codigo,
        descricao,
        unidade,
        cor_ref: String(raw?.Cor || corRef || '').trim() || null,
        quantidade_tecnica: quantidade,
        quantidade_ajustada: quantidade,
        comprimento_corte_mm: comprimentoMm,
        comprimento_barra_mm: grupo.categoria === 'perfil' ? Math.max(0, n(produto?.tamanho_barra_mm, 0)) || null : null,
        origem_calculo: 'receita',
        status_calculo: quantidade > 0 ? 'calculado' : 'pendente_formula',
        incluido_manual: false,
        excluido: false,
        justificativa_ajuste: detalhes
          ? `Copiado do orçamento W.Vetro: ${detalhes}.`
          : 'Copiado diretamente da composição do orçamento W.Vetro.',
        custo_wvetro: n(raw?.CustoVlr) || null,
        venda_wvetro: n(raw?.VendaVlr) || null,
        wvetro_dados: raw,
        ordem: ordem++,
      })
    }
  }

  return { linhas, proximaOrdem: ordem }
}

function materiaisReferenciaWvetro(
  pacoteId: string,
  item: any,
  indice: number,
  referencia: any,
  qtdItem: number,
  corRef: string | null,
  ordemInicial: number,
) {
  const componentes = Array.isArray(referencia?.componentes) ? referencia.componentes : []
  let ordem = ordemInicial
  const linhas: any[] = []
  for (const c of componentes) {
    const tipo = String(c?.tipo || '').toLowerCase()
    const categoria = tipo === 'perfil' ? 'perfil' : tipo === 'acessorio' ? 'acessorio' : tipo === 'vidro' ? 'vidro' : 'outro'
    const quantidadeRef = Math.max(0, n(c?.quantidadeMedia ?? c?.quantidadeMax ?? c?.quantidadeMin, 0))
    const quantidade = quantidadeRef * qtdItem
    const medidaRef = Math.max(0, n(c?.medidaMax ?? c?.medidaMin, 0))
    const comprimentoMm = categoria === 'perfil' && medidaRef > 0 ? medidaRef * 1000 : null
    const unidade = categoria === 'vidro' ? 'M2' : (c?.unidadeAtlas || c?.unidadeOrigem || (categoria === 'perfil' ? 'BR' : 'UN'))
    linhas.push({
      pacote_id: pacoteId,
      item_ref: itemRef(item, indice),
      categoria,
      produto_id: c?.produtoId || null,
      codigo: c?.codigo || c?.codigoWvetro || null,
      descricao: c?.nome || c?.codigo || c?.codigoWvetro || 'Componente W.Vetro',
      unidade,
      cor_ref: corRef,
      quantidade_tecnica: quantidade,
      quantidade_ajustada: quantidade,
      comprimento_corte_mm: comprimentoMm,
      comprimento_barra_mm: categoria === 'perfil' ? Math.max(0, n(c?.tamanhoBarraMm, 0)) || null : null,
      origem_calculo: 'receita',
      status_calculo: quantidade > 0 ? 'manual' : 'pendente_formula',
      incluido_manual: false,
      excluido: false,
      justificativa_ajuste: quantidade > 0
        ? 'Composição preservada da referência W.Vetro. Quantidade/medida histórica usada no orçamento até homologação da fórmula dinâmica Atlas.'
        : 'Componente existe na referência W.Vetro, mas sem quantidade histórica suficiente.',
      ordem: ordem++,
    })
  }
  return { linhas, proximaOrdem: ordem }
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
 * Somente fórmulas com status validada entram como cálculo automático.
 * No orçamento de simulação, uma fórmula validada pode ser usada como referência
 * W.Vetro mesmo se ainda estiver inativa para produção. Nos demais fluxos, além
 * de validada ela precisa estar ativa. Fórmulas em validação continuam pendentes.
 */
export async function gerarPacoteTecnico(
  orcamentoId: string,
  origem: PacoteTecnico['origem'],
  usuario: Usuario | null,
  opcoes: {
    perdaCorteMm?: number
    minimoSobraReaproveitavelMm?: number
    referenciasWvetro?: Record<string, any>
  } = {}
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
    ? await supabase
        .from('engenharia_tipologia_formulas_corte')
        .select('id,tipologia_id,configuracao_label,versao,variaveis,pecas,acessorios,vidro,status,ativo')
        .in('tipologia_id', tipologiaIds)
        .order('versao', { ascending: false })
    : { data: [] as any[] }

  const formulaMapa = new Map<string, FormulaRow>()
  for (const f of (formulas.data || []) as FormulaRow[]) {
    const atual = formulaMapa.get(f.tipologia_id)
    const liberadaParaOrigem =
      f.status === 'validada' &&
      (origem === 'orcamento_simulacao' || f.ativo === true)

    if (!liberadaParaOrigem) continue
    if (!atual) {
      formulaMapa.set(f.tipologia_id, f)
      continue
    }

    // No orçamento, uma fórmula validada pode ser usada como referência W.Vetro
    // mesmo ainda não estando ativa para produção. Entre fórmulas válidas, prioriza
    // a ativa e depois a maior versão.
    const atualAtiva = atual.ativo === true
    const candidataAtiva = f.ativo === true
    const atualVersao = n(atual.versao)
    const candidataVersao = n(f.versao)
    if ((candidataAtiva && !atualAtiva) || (candidataAtiva === atualAtiva && candidataVersao > atualVersao)) {
      formulaMapa.set(f.tipologia_id, f)
    }
  }
  const codigosFormula = Array.from(formulaMapa.values()).flatMap(formula => [
    ...(Array.isArray(formula.pecas) ? formula.pecas.map((p: any) => String(p?.codigo || '')) : []),
    ...(Array.isArray(formula.acessorios) ? formula.acessorios.map((a: any) => String(a?.codigo || '')) : []),
  ]).filter(Boolean)
  const codigosWvetro = itens.flatMap((item: any) => {
    const comp = item?.wvetro_composicao
    if (!comp || typeof comp !== 'object') return []
    const raws = [
      ...(Array.isArray(comp.perfis) ? comp.perfis : []),
      ...(Array.isArray(comp.acessorios) ? comp.acessorios : []),
      ...(Array.isArray(comp.vidros) ? comp.vidros : []),
    ]
    return raws.flatMap((raw: any) => candidatosCodigoWvetro(raw))
  })
  const produtos = await carregarProdutosTecnicos([...codigosFormula, ...codigosWvetro])

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

    // Na Medição Final, a composição W.Vetro histórica não pode carregar
    // comprimentos calculados com a medida comercial antiga. Recalcula pelas
    // fórmulas técnicas validadas usando as medidas finais do campo.
    const diretoWvetro = origem === 'medicao_final'
      ? { linhas: [] as any[], proximaOrdem: ordem }
      : materiaisDoOrcamentoWvetro(pacote.id, item, indice, produtos, corRef, ordem)
    if (diretoWvetro.linhas.length) {
      materiais.push(...diretoWvetro.linhas)
      ordem = diretoWvetro.proximaOrdem
      continue
    }

    if (!tipologiaId || !formula || formula.status !== 'validada') {
      const referencia = tipologiaId ? opcoes.referenciasWvetro?.[String(tipologiaId)] : null
      const fallback = materiaisReferenciaWvetro(pacote.id, item, indice, referencia, qtdItem, corRef, ordem)
      if (fallback.linhas.length) {
        materiais.push(...fallback.linhas)
        ordem = fallback.proximaOrdem
      } else {
        materiais.push(linhaPendente(pacote.id, item, indice, 'Perfis: fórmula técnica desta tipologia ainda não está validada.'))
        materiais.push(linhaPendente(pacote.id, item, indice, 'Acessórios: conferir/complementar manualmente antes da compra.', 'acessorio'))
      }
      continue
    }
    if (largura <= 0 || altura <= 0) {
      materiais.push(linhaPendente(pacote.id, item, indice, 'Perfis: medidas insuficientes para calcular cortes.'))
      continue
    }

    let resultadosPerfis: Array<{ codigo: string; tamanho: number; grupo?: string }> = []
    try {
      const resultados = calcularFormulasCorte({
        tipologia_id: formula.tipologia_id,
        variaveis: Array.isArray(formula.variaveis) ? formula.variaveis : [],
        pecas: Array.isArray(formula.pecas) ? formula.pecas : [],
      }, largura, altura, (item?.variaveis || {}) as Record<string, string>)

      resultadosPerfis = resultados.map(peca => ({
        codigo: peca.codigo,
        tamanho: peca.tamanho,
        grupo: peca.grupo,
      }))

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
      const resultadosAcessorios = calcularAcessoriosTecnicos(
        acessorios,
        largura,
        altura,
        folhasDoItem(item),
        resultadosPerfis,
        (item?.variaveis || {}) as Record<string, string>,
      )

      for (let acessorioIndice = 0; acessorioIndice < acessorios.length; acessorioIndice += 1) {
        const acessorio = acessorios[acessorioIndice]
        const resultadoAcessorio = resultadosAcessorios[acessorioIndice]
        if (resultadoAcessorio?.ativo === false) continue

        const produto = produtos.get(codigoKey(acessorio?.codigo))
        const statusValidado = acessorio?.status === 'validada'
        const formulaCalculada =
          statusValidado &&
          !resultadoAcessorio?.erro &&
          typeof resultadoAcessorio?.valor === 'number' &&
          Number.isFinite(resultadoAcessorio.valor)

        let quantidade = formulaCalculada
          ? Number(resultadoAcessorio?.valor)
          : n(acessorio?.quantidade_referencia)
        quantidade *= qtdItem

        const justificativa = !statusValidado
          ? `Referência técnica com status ${acessorio?.status || 'pendente'}; confirmar antes da compra.`
          : resultadoAcessorio?.erro
            ? `Fórmula do acessório não pôde ser calculada: ${resultadoAcessorio.erro}`
            : !formulaCalculada && acessorio?.formula_quantidade
              ? 'Fórmula do acessório não retornou quantidade válida.'
              : !produto?.id
                ? 'Código sem produto correspondente no cadastro.'
                : null

        materiais.push({
          pacote_id: pacote.id,
          item_ref: itemRef(item, indice),
          categoria: 'acessorio',
          produto_id: produto?.id || null,
          codigo: acessorio?.codigo || null,
          descricao: acessorio?.descricao || produto?.nome || acessorio?.codigo || 'Acessório pendente',
          unidade: acessorio?.unidade || produto?.unidade_origem || produto?.unidade || 'UN',
          cor_ref: acessorio?.cor || corRef,
          quantidade_tecnica: Math.max(0, quantidade),
          quantidade_ajustada: Math.max(0, quantidade),
          comprimento_corte_mm: null,
          comprimento_barra_mm: null,
          origem_calculo: 'formula',
          status_calculo: statusValidado && formulaCalculada && produto?.id ? 'calculado' : 'pendente_formula',
          incluido_manual: false,
          excluido: false,
          justificativa_ajuste: justificativa,
          ordem: ordem++,
        })
      }
    }

    const vidro = formula.vidro && typeof formula.vidro === 'object' ? formula.vidro : null
    if (vidro?.formula_largura && vidro?.formula_altura) {
      try {
        const larguraVidro = calcularFormulaCorteIsolada(String(vidro.formula_largura), largura, altura, formula.variaveis?.some(v => v.chave === 'numero_folhas') ? folhasDoItem(item) : undefined)
        const alturaVidro = calcularFormulaCorteIsolada(String(vidro.formula_altura), largura, altura, formula.variaveis?.some(v => v.chave === 'numero_folhas') ? folhasDoItem(item) : undefined)
        const qtdVidro = Math.max(1, formula.variaveis?.some(v => v.chave === 'numero_folhas') ? folhasDoItem(item) : n(vidro.quantidade, 1)) * qtdItem
        const areaVidroM2 = (larguraVidro / 1000) * (alturaVidro / 1000) * qtdVidro
        const emOrcamento = origem === 'orcamento_simulacao'
        materiais.push({
          pacote_id: pacote.id,
          item_ref: itemRef(item, indice),
          categoria: 'vidro',
          produto_id: null,
          codigo: 'VIDRO',
          descricao: emOrcamento
            ? `${qtdVidro} vidro(s) ${Math.round(larguraVidro)} × ${Math.round(alturaVidro)} mm`
            : `Vidro ${Math.round(larguraVidro)} × ${Math.round(alturaVidro)} mm`,
          unidade: emOrcamento ? 'M2' : 'UN',
          cor_ref: String(item?.variaveis?.vidro || item?.vidro || '').trim() || null,
          quantidade_tecnica: emOrcamento ? areaVidroM2 : qtdVidro,
          quantidade_ajustada: emOrcamento ? areaVidroM2 : qtdVidro,
          comprimento_corte_mm: null,
          comprimento_barra_mm: null,
          origem_calculo: 'formula',
          status_calculo: emOrcamento || origem === 'medicao_final' ? 'calculado' : 'pendente_formula',
          incluido_manual: false,
          excluido: false,
          justificativa_ajuste: emOrcamento
            ? 'Dimensão usada para orçamento comercial. Compra/corte definitivo continua condicionado à Medição Final aprovada.'
            : origem === 'medicao_final'
              ? null
              : 'Dimensão provisória. Compra/corte do vidro só é liberado após Medição Final aprovada.',
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

export async function gerarPacoteMedicaoFinal(
  orcamentoId: string,
  usuario: Usuario | null,
): Promise<{ ok: true; pacote: PacoteTecnico } | { ok: false; error: string }> {
  const gerado = await gerarPacoteTecnico(orcamentoId, 'medicao_final', usuario, {
    perdaCorteMm: 0,
    minimoSobraReaproveitavelMm: 300,
  })
  if (!gerado.ok) return gerado

  await supabase
    .from('pacotes_tecnicos')
    .update({ status: 'substituido' })
    .eq('orcamento_id', orcamentoId)
    .eq('origem', 'medicao_final')
    .neq('id', gerado.pacote.id)
    .neq('status', 'substituido')

  return gerado
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