import { supabase } from './supabase'
import { calcularFormulasCorte, type TipologiaFormulasCorte } from './formulasCorteEngine'
import { otimizarPerfis, type CortePerfil, type ResultadoAproveitamento } from './aproveitamentoPerfis'

export type ItemSimulacaoAproveitamento = {
  id?: string
  tipologiaId?: string | null
  tipologia_id?: string | null
  largura?: string | number | null
  largura_mm?: string | number | null
  altura?: string | number | null
  altura_mm?: string | number | null
  quantidade?: string | number | null
  cor?: string | null
  variaveis?: Record<string, string>
}

export type SimulacaoAproveitamento = {
  resultado: ResultadoAproveitamento
  perfis: Array<{
    produto_id: string
    codigo: string
    cor_ref?: string | null
    comprimento_barra_mm: number
    cortes: number
    barras_novas: number
    sobra_total_mm: number
  }>
  pendencias: string[]
}

function numero(v: any) {
  if (typeof v === 'string') return Number(v.replace(',', '.'))
  return Number(v)
}
function chaveCodigo(v?: string | null) { return (v || '').trim().toUpperCase() }
function semContramarco(v?: string | null) {
  const x = (v || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase()
  return ['sem', 'nao', 'não', 'false', '0', 'sem contramarco', 'sem_contramarco'].includes(x)
}
function ehContramarco(codigo?: string, descricao?: string) {
  return /^CM\d+/i.test(codigo || '') || /contramarco/i.test(descricao || '')
}

export async function simularAproveitamentoOrcamento(
  itens: ItemSimulacaoAproveitamento[],
  acabamento?: string | null,
  contramarco?: string | null,
  opcoes: { perdaCorteMm?: number; minimoSobraReaproveitavelMm?: number } = {}
): Promise<SimulacaoAproveitamento> {
  const tipologiaIds = Array.from(new Set(itens.map(i => i.tipologiaId || i.tipologia_id).filter(Boolean))) as string[]
  const pendencias: string[] = []
  if (!tipologiaIds.length) {
    return { resultado: otimizarPerfis([]), perfis: [], pendencias: ['Selecione tipologias cadastradas para calcular o aproveitamento.'] }
  }

  const [{ data: formulas }, { data: produtos }] = await Promise.all([
    supabase
      .from('engenharia_tipologia_formulas_corte')
      .select('tipologia_id,variaveis,pecas,status,ativo')
      .in('tipologia_id', tipologiaIds)
      .eq('ativo', true),
    supabase
      .from('produtos')
      .select('id,codigo,nome,categoria,tamanho_barra_mm')
      .eq('ativo', true)
      .eq('categoria', 'perfil')
      .not('codigo', 'is', null),
  ])

  const formulaMap = new Map<string, any>()
  ;(formulas || []).forEach((f: any) => formulaMap.set(f.tipologia_id, f))
  const produtoMap = new Map<string, any>()
  ;(produtos || []).forEach((p: any) => produtoMap.set(chaveCodigo(p.codigo), p))

  const cortes: CortePerfil[] = []
  for (let idx = 0; idx < itens.length; idx += 1) {
    const item = itens[idx]
    const tipologiaId = item.tipologiaId || item.tipologia_id || ''
    const formula = formulaMap.get(tipologiaId)
    if (!formula || formula.status !== 'validada') {
      pendencias.push(`Item ${idx + 1}: fórmula técnica ainda não validada; não entrou na otimização.`)
      continue
    }
    const largura = numero(item.largura_mm ?? item.largura)
    const altura = numero(item.altura_mm ?? item.altura)
    const qtdItem = Math.max(1, Math.floor(numero(item.quantidade) || 1))
    if (!Number.isFinite(largura) || !Number.isFinite(altura) || largura <= 0 || altura <= 0) {
      pendencias.push(`Item ${idx + 1}: medidas insuficientes para calcular os cortes.`)
      continue
    }
    try {
      const calculados = calcularFormulasCorte({
        tipologia_id: tipologiaId,
        variaveis: Array.isArray(formula.variaveis) ? formula.variaveis : [],
        pecas: Array.isArray(formula.pecas) ? formula.pecas : [],
      } as TipologiaFormulasCorte, largura, altura, item.variaveis || {})
      for (let p = 0; p < calculados.length; p += 1) {
        const corte = calculados[p]
        if (semContramarco(contramarco) && ehContramarco(corte.codigo, corte.descricao)) continue
        const produto = produtoMap.get(chaveCodigo(corte.codigo))
        if (!produto) {
          pendencias.push(`${corte.codigo}: perfil calculado não está vinculado ao cadastro de produtos.`)
          continue
        }
        const barra = numero(produto.tamanho_barra_mm)
        if (!Number.isFinite(barra) || barra <= 0) {
          pendencias.push(`${corte.codigo}: tamanho da barra não cadastrado.`)
          continue
        }
        cortes.push({
          id: `${item.id || idx}:${p}`,
          item_ref: item.id || `item-${idx + 1}`,
          produto_id: produto.id,
          codigo: corte.codigo,
          cor_ref: item.cor || acabamento || null,
          comprimento_mm: corte.tamanho,
          quantidade: Math.max(1, Number(corte.quantidade || 1)) * qtdItem,
          comprimento_barra_mm: barra,
        })
      }
    } catch (erro) {
      pendencias.push(`Item ${idx + 1}: ${erro instanceof Error ? erro.message : 'erro no cálculo técnico'}.`)
    }
  }

  const resultado = otimizarPerfis(cortes, [], opcoes)
  const mapa = new Map<string, SimulacaoAproveitamento['perfis'][number]>()
  for (const barra of resultado.barras) {
    const chave = `${barra.produto_id}|${barra.cor_ref || ''}|${barra.comprimento_inicial_mm}`
    const atual = mapa.get(chave) || {
      produto_id: barra.produto_id,
      codigo: barra.codigo,
      cor_ref: barra.cor_ref || null,
      comprimento_barra_mm: barra.comprimento_inicial_mm,
      cortes: 0,
      barras_novas: 0,
      sobra_total_mm: 0,
    }
    atual.cortes += barra.cortes.length
    if (barra.fonte_tipo === 'barra_nova') atual.barras_novas += 1
    atual.sobra_total_mm += barra.sobra_final_mm
    mapa.set(chave, atual)
  }

  return {
    resultado: { ...resultado, pendencias: [...resultado.pendencias, ...pendencias] },
    perfis: Array.from(mapa.values()).sort((a, b) => a.codigo.localeCompare(b.codigo)),
    pendencias: [...resultado.pendencias, ...pendencias],
  }
}
