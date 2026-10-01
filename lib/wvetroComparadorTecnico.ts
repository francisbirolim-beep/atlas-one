import { calcularFormulasCorte, calcularFormulaCorteIsolada, resolverFormulaCondicional, type OpcoesEscolhidas, type TipologiaFormulasCorte } from '@/lib/formulasCorteEngine'
import { calcularAcessoriosTecnicos } from '@/lib/formulasAcessoriosEngine'
import type { AcessorioFormulaCorte, VidroFormulaCorte } from '@/lib/engenhariaFormulasCorte'

export type WVetroPerfilTecnico = {
  Codigo?: string
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
  Nome?: string
  Qtde?: string | number
}

export type WVetroItemTecnico = {
  Codigo?: string
  Nome?: string
  Linha?: string
  Modelo?: string
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

export type StatusComparacao =
  | 'igual'
  | 'medida_diferente'
  | 'quantidade_diferente'
  | 'ausente_atlas'
  | 'ausente_wvetro'

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
): { linhas: LinhaComparacao[]; perfisAtlas: Array<{ codigo: string; tamanho: number; quantidade?: number; eixo?: 'L' | 'H'; descricao?: string }> } {
  const largura = Number(item.Largura)
  const altura = Number(item.Altura)
  const calculados = calcularFormulasCorte(formula, largura, altura, opcoes)
  const linhas: LinhaComparacao[] = []

  const wMap = new Map<string, { codigo: string; eixo: string; descricao: string; quantidade: number; medidas: number[] }>()
  for (const p of item.Perfil || []) {
    const codigo = String(p.Codigo || '').trim()
    if (!codigo) continue
    const eixo = String(p.Posicao || '').trim().toUpperCase()
    const k = key(codigo, eixo)
    const atual = wMap.get(k) || { codigo, eixo, descricao: String(p.Nome || ''), quantidade: 0, medidas: [] }
    atual.quantidade += qtd(p.Qtde)
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

    linhas.push({
      tipo: 'perfil', codigo: a.codigo, eixo: a.eixo || null, descricao: a.descricao || w.descricao,
      status,
      wvetro: { quantidade: w.quantidade, medida_mm: wMedida },
      atlas: { quantidade: a.quantidade, medida_mm: aMedida },
      diferenca_mm: wMedida != null && aMedida != null ? Number((aMedida - wMedida).toFixed(3)) : null,
    })
  }

  return { linhas, perfisAtlas: calculados }
}

function compararVidro(formula: FormulaAtlasComparacao, item: WVetroItemTecnico, opcoes: OpcoesEscolhidas): LinhaComparacao[] {
  const vidro = formula.vidro || {}
  const w = (item.Vidros || [])[0]
  if (!w && !vidro.formula_largura && !vidro.formula_altura) return []
  if (w && !vidro.formula_largura && !vidro.formula_altura) {
    return [{
      tipo: 'vidro', codigo: String(w.Codigo || 'VIDRO'), descricao: w.Especificacao || 'Vidro',
      status: 'ausente_atlas',
      wvetro: { quantidade: qtd(w.Qtde), largura_mm: mm(w.Largura), altura_mm: mm(w.Altura) },
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
  const qtdIgual = Math.abs(qtd(w.Qtde) - Number(vidro.quantidade || 1)) < 0.0001
  const medidaIgual = tolerancia(wL, aL, 1) && tolerancia(wH, aH, 1)

  return [{
    tipo: 'vidro', codigo: String(w.Codigo || 'VIDRO'), descricao: w.Especificacao || 'Vidro',
    status: !qtdIgual ? 'quantidade_diferente' : !medidaIgual ? 'medida_diferente' : 'igual',
    wvetro: { quantidade: qtd(w.Qtde), largura_mm: wL, altura_mm: wH },
    atlas: { quantidade: Number(vidro.quantidade || 1), largura_mm: aL, altura_mm: aH },
    diferenca_mm: wL != null && aL != null ? Number((aL - wL).toFixed(3)) : null,
  }]
}

function compararAcessorios(
  formula: FormulaAtlasComparacao,
  item: WVetroItemTecnico,
  perfisAtlas: Array<{ codigo: string; tamanho: number }>,
  opcoes: OpcoesEscolhidas,
): LinhaComparacao[] {
  const wMap = new Map<string, { codigo: string; descricao: string; quantidade: number }>()
  for (const a of item.Acessorios || []) {
    const codigo = String(a.Codigo || '').trim()
    if (!codigo) continue
    const k = codigo.toUpperCase()
    const atual = wMap.get(k) || { codigo, descricao: String(a.Nome || ''), quantidade: 0 }
    atual.quantidade += qtd(a.Qtde)
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
  const aMap = new Map<string, { codigo: string; descricao: string; quantidade: number | null }>()
  defs.forEach((def, i) => {
    const resultado = resultados[i]
    if (resultado?.ativo === false) return
    const k = String(def.codigo || '').toUpperCase()
    if (!k) return
    const quantidade = resultado?.valor ?? def.quantidade_referencia ?? null
    const atual = aMap.get(k)
    if (!atual) {
      aMap.set(k, {
        codigo: def.codigo,
        descricao: String(def.descricao || ''),
        quantidade,
      })
      return
    }
    atual.quantidade = atual.quantidade == null || quantidade == null
      ? atual.quantidade ?? quantidade
      : atual.quantidade + quantidade
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
      status: igual ? 'igual' : 'quantidade_diferente',
      wvetro: { quantidade: w.quantidade },
      atlas: { quantidade: a.quantidade },
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
  }, { total: 0, igual: 0, medida_diferente: 0, quantidade_diferente: 0, ausente_atlas: 0, ausente_wvetro: 0 } as Record<string, number>)

  return {
    item: {
      codigo: item.Codigo || null,
      nome: item.Nome || null,
      linha: item.Linha || null,
      modelo: item.Modelo || null,
      largura_mm: Number(item.Largura),
      altura_mm: Number(item.Altura),
    },
    formula: {
      tipologia_id: formula.tipologia_id,
      configuracao_label: formula.configuracao_label || null,
    },
    resumo,
    linhas,
    aprovado: resumo.medida_diferente === 0 && resumo.quantidade_diferente === 0 && resumo.ausente_atlas === 0 && resumo.ausente_wvetro === 0,
  }
}
