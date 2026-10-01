import { calcularFormulasCorte, calcularFormulaCorteIsolada, resolverFormulaCondicional, type OpcoesEscolhidas, type TipologiaFormulasCorte } from '@/lib/formulasCorteEngine'
import { calcularAcessoriosTecnicos } from '@/lib/formulasAcessoriosEngine'
import type { AcessorioFormulaCorte, VidroFormulaCorte } from '@/lib/engenhariaFormulasCorte'

export type WVetroPerfilTecnico = {
  Codigo?: string
  Cor?: string
  Nome?: string
  Qtde?: string | number
  Medida?: string | number
  Posicao?: string
}

export type WVetroVidroTecnico = {
  Codigo?: string
  Qtde?: string | number
  Largura?: string | number
  Altura?: string | number
  Especificacao?: string
}

export type WVetroAcessorioTecnico = {
  Codigo?: string
  Cor?: string
  Nome?: string
  Qtde?: string | number
}

export type WVetroItemTecnico = {
  Codigo?: string
  Nome?: string
  Linha?: string
  Modelo?: string
  Qtde?: string | number
  Largura: string | number
  Altura: string | number
  Perfil?: WVetroPerfilTecnico[]
  Vidros?: WVetroVidroTecnico[]
  Acessorios?: WVetroAcessorioTecnico[]
}

export type FormulaAtlasComparacao = TipologiaFormulasCorte & {
  vidro?: VidroFormulaCorte
  acessorios?: AcessorioFormulaCorte[]
  configuracao_label?: string
}


export type OpcaoTecnicaInferida = {
  chave: string
  valor: string
  origem: 'composicao_wvetro' | 'primeira_opcao' | 'livre_sem_evidencia'
  evidencia: string
}

function normalizarCodigo(v: unknown) {
  return String(v || '').trim().toUpperCase()
}

export function inferirOpcoesTecnicasWVetro(
  item: WVetroItemTecnico,
  formula: FormulaAtlasComparacao,
  overrides: OpcoesEscolhidas = {}
): { opcoes: OpcoesEscolhidas; inferencias: OpcaoTecnicaInferida[] } {
  const perfis = item.Perfil || []
  const acessorios = item.Acessorios || []
  const codigosPerfil = new Set(perfis.map(p => normalizarCodigo(p.Codigo)).filter(Boolean))
  const codigosAcessorio = new Set(acessorios.map(a => normalizarCodigo(a.Codigo)).filter(Boolean))
  const nomesAcessorio = acessorios.map(a => String(a.Nome || '').toUpperCase())
  const opcoes: OpcoesEscolhidas = {}
  const inferencias: OpcaoTecnicaInferida[] = []

  const registrar = (chave: string, valor: string, origem: OpcaoTecnicaInferida['origem'], evidencia: string) => {
    opcoes[chave] = valor
    inferencias.push({ chave, valor, origem, evidencia })
  }

  for (const variavel of formula.variaveis || []) {
    const override = overrides[variavel.chave]
    if (override != null && String(override).trim() !== '') {
      registrar(variavel.chave, String(override), 'composicao_wvetro', 'Valor informado manualmente no comparador.')
      continue
    }

    let valor = ''
    let evidencia = ''
    switch (variavel.chave) {
      case 'contramarco':
        valor = codigosPerfil.has('CM200') ? 'cm200' : 'sem'
        evidencia = codigosPerfil.has('CM200') ? 'Perfil CM200 presente.' : 'Nenhum perfil CM200 presente na composição.'
        break
      case 'arremate':
        valor = codigosPerfil.has('MP347') ? 'interno' : 'sem'
        evidencia = codigosPerfil.has('MP347') ? 'Perfil MP347 presente.' : 'MP347 ausente.'
        break
      case 'trilho':
        valor = codigosPerfil.has('TMC') ? 'macarrao' : (variavel.opcoes.includes('convencional') ? 'convencional' : '')
        evidencia = codigosPerfil.has('TMC') ? 'Perfil TMC presente.' : 'TMC ausente.'
        break
      case 'fechamento':
        if (codigosAcessorio.has('FRA820') || codigosAcessorio.has('CON409')) {
          valor = 'fechadura'; evidencia = 'FRA820/CON409 presentes.'
        } else if (nomesAcessorio.some(n => n.includes('CONCHA'))) {
          valor = 'concha'; evidencia = 'Acessório de concha identificado.'
        }
        break
      case 'mao_amigo_largura': {
        const largos = ['SU243','SU242','SU289','SU290']
        valor = largos.some(x => codigosPerfil.has(x)) ? 'largo' : 'comum'
        evidencia = valor === 'largo' ? 'Código de mão-de-amigo larga presente.' : 'Composição usa códigos de mão-de-amigo comum.'
        break
      }
      case 'reforco_mao_amigo': {
        const pares: Array<[string,string,string]> = [
          ['SU289','SU290','interno_externo'],
          ['SU289','SU242','interno'],
          ['SU243','SU290','externo'],
          ['SU243','SU242','sem_reforco'],
          ['SU047','SU049','interno_externo'],
          ['SU047','SU041','interno'],
          ['SU040','SU049','externo'],
          ['SU040','SU041','sem_reforco'],
        ]
        const achado = pares.find(([a,b]) => codigosPerfil.has(a) && codigosPerfil.has(b))
        if (achado) {
          valor = achado[2]
          evidencia = `Par ${achado[0]} + ${achado[1]} presente.`
        }
        break
      }
      case 'roldana':
        if (codigosAcessorio.has('RPCS100') || nomesAcessorio.some(n => n.includes('100 KG'))) {
          valor = '100'; evidencia = 'Roldana RPCS100/100 kg presente.'
        } else if ([...codigosAcessorio].some(c => c.includes('200')) || nomesAcessorio.some(n => n.includes('200 KG'))) {
          valor = '200'; evidencia = 'Roldana 200 kg identificada.'
        }
        break
      case 'montante_lateral':
        if (codigosPerfil.has('SU280')) { valor = 'largo'; evidencia = 'SU280 presente (montante com reforço de aba).' }
        else if (codigosPerfil.has('SU245') || codigosPerfil.has('SU039')) { valor = 'estreito'; evidencia = codigosPerfil.has('SU245') ? 'SU245 presente (montante lateral sem reforço de aba).' : 'SU039 presente.' }
        break
      case 'puxador':
        valor = nomesAcessorio.some(n => n.includes('PUXADOR')) ? 'sim' : 'sem'
        evidencia = valor === 'sim' ? 'Acessório de puxador presente.' : 'Nenhum puxador identificado.'
        break
      case 'cor': {
        const cor = perfis.find(p => String(p.Cor || '').trim())?.Cor || acessorios.find(a => String(a.Cor || '').trim())?.Cor
        if (cor) { valor = String(cor); evidencia = 'Cor lida da composição W.Vetro.' }
        break
      }
      case 'vidro': {
        const esp = item.Vidros?.find(v => String(v.Especificacao || '').trim())?.Especificacao
        if (esp) { valor = String(esp); evidencia = 'Especificação lida do vidro W.Vetro.' }
        break
      }
    }

    if (valor && (variavel.opcoes.length === 0 || variavel.opcoes.includes(valor))) {
      registrar(variavel.chave, valor, 'composicao_wvetro', evidencia || 'Inferido da composição.')
    } else if (variavel.opcoes.length > 0) {
      registrar(variavel.chave, variavel.opcoes[0], 'primeira_opcao', 'Sem evidência suficiente; primeira opção usada apenas para simulação.')
    } else {
      registrar(variavel.chave, '', 'livre_sem_evidencia', 'Campo livre sem evidência suficiente na composição.')
    }
  }

  return { opcoes, inferencias }
}

export type StatusComparacao =
  | 'igual'
  | 'medida_diferente'
  | 'quantidade_diferente'
  | 'ausente_atlas'
  | 'ausente_wvetro'
  | 'regra_pendente_atlas'

export type LinhaComparacao = {
  tipo: 'perfil' | 'vidro' | 'acessorio'
  codigo: string
  eixo?: string | null
  descricao?: string | null
  status: StatusComparacao
  wvetro?: { quantidade?: number | null; medida_mm?: number | null; largura_mm?: number | null; altura_mm?: number | null }
  atlas?: { quantidade?: number | null; medida_mm?: number | null; largura_mm?: number | null; altura_mm?: number | null }
  diferenca_mm?: number | null
  observacao?: string | null
}

function n(v: unknown): number | null {
  const x = Number(String(v ?? '').replace(',', '.'))
  return Number.isFinite(x) ? x : null
}

function qtd(v: unknown): number {
  return n(v) ?? 0
}

function quantidadeItem(item: WVetroItemTecnico): number {
  const valor = qtd(item.Qtde)
  return valor > 0 ? valor : 1
}

function mmDeMetros(v: unknown): number | null {
  const x = n(v)
  return x == null ? null : Math.round(x * 1000 * 1000) / 1000
}

function mm(v: unknown): number | null {
  const x = n(v)
  return x == null ? null : Math.round(x * 1000) / 1000
}

function key(codigo: string, eixo?: string | null) {
  return `${codigo.trim().toUpperCase()}|${String(eixo || '').trim().toUpperCase()}`
}

function tolerancia(a: number | null | undefined, b: number | null | undefined, limite = 1): boolean {
  if (a == null || b == null) return a == null && b == null
  return Math.abs(a - b) <= limite
}

function compararPerfis(
  formula: FormulaAtlasComparacao,
  item: WVetroItemTecnico,
  opcoes: Record<string, string>,
): { linhas: LinhaComparacao[]; perfisAtlas: Array<{ codigo: string; tamanho: number; quantidade?: number; eixo?: 'L' | 'H'; descricao?: string; grupo?: string }> } {
  const largura = Number(item.Largura)
  const altura = Number(item.Altura)
  const multiplicador = quantidadeItem(item)
  const calculados = calcularFormulasCorte(formula, largura, altura, opcoes)
  const linhas: LinhaComparacao[] = []

  const wMap = new Map<string, { codigo: string; eixo: string; descricao: string; quantidade: number; medidas: number[] }>()
  for (const p of item.Perfil || []) {
    const codigo = String(p.Codigo || '').trim()
    if (!codigo) continue
    const eixo = String(p.Posicao || '').trim().toUpperCase()
    const k = key(codigo, eixo)
    const atual = wMap.get(k) || { codigo, eixo, descricao: String(p.Nome || ''), quantidade: 0, medidas: [] }
    atual.quantidade += qtd(p.Qtde) / multiplicador
    const medida = mmDeMetros(p.Medida)
    if (medida != null) atual.medidas.push(medida)
    wMap.set(k, atual)
  }

  const aMap = new Map<string, { codigo: string; eixo: string; descricao: string; quantidade: number; medidas: number[] }>()
  for (const p of calculados) {
    const codigo = String(p.codigo || '').trim()
    const eixo = String(p.eixo || '').trim().toUpperCase()
    const k = key(codigo, eixo)
    const atual = aMap.get(k) || { codigo, eixo, descricao: String(p.descricao || ''), quantidade: 0, medidas: [] }
    atual.quantidade += Number(p.quantidade || 1)
    atual.medidas.push(mm(p.tamanho) || 0)
    aMap.set(k, atual)
  }

  const keys = new Set([...wMap.keys(), ...aMap.keys()])
  for (const k of keys) {
    const w = wMap.get(k)
    const a = aMap.get(k)
    if (!a && w) {
      linhas.push({
        tipo: 'perfil', codigo: w.codigo, eixo: w.eixo || null, descricao: w.descricao,
        status: 'ausente_atlas',
        wvetro: { quantidade: w.quantidade, medida_mm: w.medidas[0] ?? null },
        observacao: 'Componente presente na composição W.Vetro e ausente na fórmula Atlas selecionada.',
      })
      continue
    }
    if (!w && a) {
      linhas.push({
        tipo: 'perfil', codigo: a.codigo, eixo: a.eixo || null, descricao: a.descricao,
        status: 'ausente_wvetro',
        atlas: { quantidade: a.quantidade, medida_mm: a.medidas[0] ?? null },
        observacao: 'Componente calculado pelo Atlas e ausente nesta amostra W.Vetro.',
      })
      continue
    }
    if (!w || !a) continue

    const wMedida = w.medidas[0] ?? null
    const aMedida = a.medidas[0] ?? null
    const qtdIgual = Math.abs(w.quantidade - a.quantidade) < 0.0001
    const medidaIgual = tolerancia(wMedida, aMedida, 1)
    const status: StatusComparacao = !qtdIgual
      ? 'quantidade_diferente'
      : !medidaIgual
        ? 'medida_diferente'
        : 'igual'

    const nominal = String(a.eixo || w.eixo || '').toUpperCase() === 'H' ? altura : largura
    const codigoNormalizado = normalizarCodigo(a.codigo || w.codigo)
    const possivelMedidaComercialWVetro =
      status === 'medida_diferente' &&
      wMedida != null &&
      aMedida != null &&
      ['SU001', 'TMC'].includes(codigoNormalizado) &&
      wMedida > nominal + 100 &&
      aMedida <= nominal + 50

    linhas.push({
      tipo: 'perfil', codigo: a.codigo, eixo: a.eixo || null, descricao: a.descricao || w.descricao,
      status,
      wvetro: { quantidade: w.quantidade, medida_mm: wMedida },
      atlas: { quantidade: a.quantidade, medida_mm: aMedida },
      diferenca_mm: wMedida != null && aMedida != null ? Number((aMedida - wMedida).toFixed(3)) : null,
      observacao: possivelMedidaComercialWVetro
        ? 'A medida W.Vetro excede a dimensão nominal do vão e destoa das demais amostras desta tipologia. Tratar como possível sobra/aproveitamento/cobrança até validar; não usar automaticamente como fórmula de corte.'
        : null,
    })
  }

  return { linhas, perfisAtlas: calculados }
}

function compararVidro(formula: FormulaAtlasComparacao, item: WVetroItemTecnico, opcoes: OpcoesEscolhidas): LinhaComparacao[] {
  const vidro = formula.vidro || {}
  const multiplicador = quantidadeItem(item)
  const w = (item.Vidros || [])[0]
  if (!w && !vidro.formula_largura && !vidro.formula_altura) return []
  if (w && !vidro.formula_largura && !vidro.formula_altura) {
    return [{
      tipo: 'vidro', codigo: String(w.Codigo || 'VIDRO'), descricao: w.Especificacao || 'Vidro',
      status: 'ausente_atlas',
      wvetro: { quantidade: qtd(w.Qtde) / multiplicador, largura_mm: mm(w.Largura), altura_mm: mm(w.Altura) },
      observacao: 'W.Vetro possui vidro, mas a configuração Atlas não possui fórmula de vidro.',
    }]
  }
  const formulaL = vidro.formula_largura
    ? resolverFormulaCondicional(vidro.formula_largura, vidro.condicoes_largura, opcoes)
    : null
  const formulaH = vidro.formula_altura
    ? resolverFormulaCondicional(vidro.formula_altura, vidro.condicoes_altura, opcoes)
    : null

  if (!w) {
    return [{
      tipo: 'vidro', codigo: 'VIDRO', descricao: 'Vidro',
      status: 'ausente_wvetro',
      atlas: {
        quantidade: Number(vidro.quantidade || 1),
        largura_mm: formulaL ? calcularFormulaCorteIsolada(formulaL, Number(item.Largura), Number(item.Altura)) : null,
        altura_mm: formulaH ? calcularFormulaCorteIsolada(formulaH, Number(item.Largura), Number(item.Altura)) : null,
      },
    }]
  }

  const aL = formulaL ? calcularFormulaCorteIsolada(formulaL, Number(item.Largura), Number(item.Altura)) : null
  const aH = formulaH ? calcularFormulaCorteIsolada(formulaH, Number(item.Largura), Number(item.Altura)) : null
  const wL = mm(w.Largura)
  const wH = mm(w.Altura)
  const qtdW = qtd(w.Qtde) / multiplicador
  const qtdIgual = Math.abs(qtdW - Number(vidro.quantidade || 1)) < 0.0001
  const medidaIgual = tolerancia(wL, aL, 1) && tolerancia(wH, aH, 1)

  return [{
    tipo: 'vidro', codigo: String(w.Codigo || 'VIDRO'), descricao: w.Especificacao || 'Vidro',
    status: !qtdIgual ? 'quantidade_diferente' : !medidaIgual ? 'medida_diferente' : 'igual',
    wvetro: { quantidade: qtd(w.Qtde) / multiplicador, largura_mm: wL, altura_mm: wH },
    atlas: { quantidade: Number(vidro.quantidade || 1), largura_mm: aL, altura_mm: aH },
    diferenca_mm: wL != null && aL != null ? Number((aL - wL).toFixed(3)) : null,
  }]
}

function compararAcessorios(
  formula: FormulaAtlasComparacao,
  item: WVetroItemTecnico,
  perfisAtlas: Array<{ codigo: string; tamanho: number; grupo?: string }>,
  opcoes: OpcoesEscolhidas,
): LinhaComparacao[] {
  const multiplicador = quantidadeItem(item)
  const wMap = new Map<string, { codigo: string; descricao: string; quantidade: number }>()
  for (const a of item.Acessorios || []) {
    const codigo = String(a.Codigo || '').trim()
    if (!codigo) continue
    const k = codigo.toUpperCase()
    const atual = wMap.get(k) || { codigo, descricao: String(a.Nome || ''), quantidade: 0 }
    atual.quantidade += qtd(a.Qtde) / multiplicador
    wMap.set(k, atual)
  }

  const defs = formula.acessorios || []
  if (!defs.length) {
    return [...wMap.values()].map(w => ({
      tipo: 'acessorio' as const,
      codigo: w.codigo,
      descricao: w.descricao,
      status: 'ausente_atlas' as const,
      wvetro: { quantidade: w.quantidade },
      observacao: 'A configuração Atlas ainda não possui fórmula de acessórios.',
    }))
  }

  const folhas = Math.max(1, Number(String(item.Modelo || item.Nome || '').match(/(\d+)\s*FOLH/i)?.[1] || 1))
  const resultados = calcularAcessoriosTecnicos(defs, Number(item.Largura), Number(item.Altura), folhas, perfisAtlas, opcoes)
  const aMap = new Map<string, { codigo: string; descricao: string; quantidade: number | null; regraPendente: boolean }>()
  defs.forEach((def, i) => {
    const resultado = resultados[i]
    if (resultado?.ativo === false) return
    const k = String(def.codigo || '').toUpperCase()
    if (!k) return
    const regraPendente = resultado?.valor == null && !String(def.formula_quantidade || '').trim()
    const quantidade = resultado?.valor ?? def.quantidade_referencia ?? null
    const atual = aMap.get(k)
    if (!atual) {
      aMap.set(k, {
        codigo: def.codigo,
        descricao: String(def.descricao || ''),
        quantidade,
        regraPendente,
      })
      return
    }
    atual.quantidade = atual.quantidade == null || quantidade == null
      ? atual.quantidade ?? quantidade
      : atual.quantidade + quantidade
    atual.regraPendente = atual.regraPendente || regraPendente
    if (!atual.descricao && def.descricao) atual.descricao = def.descricao
  })

  const linhas: LinhaComparacao[] = []
  const keys = new Set([...wMap.keys(), ...aMap.keys()])
  for (const k of keys) {
    const w = wMap.get(k)
    const a = aMap.get(k)
    if (!a && w) {
      linhas.push({ tipo: 'acessorio', codigo: w.codigo, descricao: w.descricao, status: 'ausente_atlas', wvetro: { quantidade: w.quantidade } })
      continue
    }
    if (!w && a) {
      linhas.push({ tipo: 'acessorio', codigo: a.codigo, descricao: a.descricao, status: 'ausente_wvetro', atlas: { quantidade: a.quantidade } })
      continue
    }
    if (!w || !a) continue
    const igual = a.quantidade != null && Math.abs(w.quantidade - a.quantidade) < 0.0001
    linhas.push({
      tipo: 'acessorio', codigo: a.codigo, descricao: a.descricao || w.descricao,
      status: a.regraPendente ? 'regra_pendente_atlas' : igual ? 'igual' : 'quantidade_diferente',
      wvetro: { quantidade: w.quantidade },
      atlas: { quantidade: a.quantidade },
      observacao: a.regraPendente
        ? 'O Atlas conhece este acessório e possui quantidade de referência, mas a fórmula de consumo ainda não foi validada.'
        : null,
    })
  }
  return linhas
}

export function compararItemWVetroComFormulaAtlas(params: {
  item: WVetroItemTecnico
  formula: FormulaAtlasComparacao
  opcoes?: Record<string, string>
}) {
  const { item, formula, opcoes = {} } = params
  const perfis = compararPerfis(formula, item, opcoes)
  const linhas = [
    ...perfis.linhas,
    ...compararVidro(formula, item, opcoes),
    ...compararAcessorios(formula, item, perfis.perfisAtlas, opcoes),
  ]

  const resumo = linhas.reduce((acc, linha) => {
    acc.total += 1
    acc[linha.status] = (acc[linha.status] || 0) + 1
    return acc
  }, { total: 0, igual: 0, medida_diferente: 0, quantidade_diferente: 0, ausente_atlas: 0, ausente_wvetro: 0, regra_pendente_atlas: 0 } as Record<string, number>)

  return {
    item: {
      codigo: item.Codigo || null,
      nome: item.Nome || null,
      linha: item.Linha || null,
      modelo: item.Modelo || null,
      largura_mm: Number(item.Largura),
      altura_mm: Number(item.Altura),
      quantidade: quantidadeItem(item),
    },
    formula: {
      tipologia_id: formula.tipologia_id,
      configuracao_label: formula.configuracao_label || null,
    },
    resumo,
    linhas,
    aprovado: resumo.medida_diferente === 0 && resumo.quantidade_diferente === 0 && resumo.ausente_atlas === 0 && resumo.ausente_wvetro === 0 && resumo.regra_pendente_atlas === 0,
  }
}
