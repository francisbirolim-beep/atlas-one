import { supabase } from './supabase'
import type { LinhaPlanoCorte } from './planoCortePerfis'

export type VidroCatalogoPlano = {
  id: string
  codigo: string | null
  nome: string
}

export type LinhaVidroPlano = {
  vidro: string
  largura_base_mm: number
  altura_base_mm: number
  folga_largura_mm: number
  folga_altura_mm: number
  largura_corte_mm: number
  altura_corte_mm: number
  quantidade: number
  referencia_tecnica: string
}

export type ResultadoVidroPlano = {
  linha: LinhaVidroPlano | null
  aviso: string | null
}

const TIPOLOGIA_PC3_SUPREMA = 'dce9da1d-7e03-4c1c-ad1b-2f101b51a52e'

function normalizar(valor: string | null | undefined) {
  return String(valor || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
}

/**
 * Lista produtos que ja estejam organizados como vidro no cadastro.
 * O campo continua livre na tela para nao bloquear operacao enquanto o
 * catalogo de vidros ainda estiver incompleto.
 */
export async function listarVidrosPlanoCorte(): Promise<VidroCatalogoPlano[]> {
  const { data, error } = await supabase
    .from('produtos')
    .select('id,codigo,nome,categoria,grupo')
    .eq('ativo', true)
    .order('nome')

  if (error) {
    console.error('Erro ao carregar vidros do plano de corte:', error)
    return []
  }

  return ((data as Array<{
    id: string
    codigo?: string | null
    nome?: string | null
    categoria?: string | null
    grupo?: string | null
  }>) || [])
    .filter(item => item.nome && (
      normalizar(item.categoria).includes('vidro') ||
      normalizar(item.grupo).includes('vidro')
    ))
    .map(item => ({
      id: item.id,
      codigo: item.codigo || null,
      nome: String(item.nome),
    }))
}

function linhaBaguete(
  linhas: LinhaPlanoCorte[],
  eixo: 'L' | 'H'
): LinhaPlanoCorte | null {
  const candidatas = linhas.filter(item => item.codigo.toUpperCase() === 'SU102' && item.eixo === eixo)
  if (candidatas.length !== 1) return null
  return candidatas[0]
}

function quantidadeVidrosPorEsquadria(horizontal: LinhaPlanoCorte, vertical: LinhaPlanoCorte) {
  if (!horizontal.quantidade || !vertical.quantidade) return null
  const porHorizontal = horizontal.quantidade / 2
  const porVertical = vertical.quantidade / 2
  if (!Number.isInteger(porHorizontal) || !Number.isInteger(porVertical)) return null
  if (porHorizontal <= 0 || porHorizontal !== porVertical) return null
  return porHorizontal
}

/**
 * Gera a lista de vidro apenas quando existe uma referencia tecnica validada.
 *
 * PC3 Suprema: as medidas-base sao os baguetes SU102 horizontal e vertical.
 * A folga informada pelo operador e subtraida da largura/altura base. A
 * quantidade de panos e inferida por 2 baguetes de cada eixo por vidro.
 *
 * Nao existe fallback usando a largura/altura total da esquadria, pois isso
 * inventaria uma medida de vidro para tipologias ainda nao validadas.
 */
export function gerarVidroPlanoCorte(params: {
  tipologiaId: string
  linhasPlano: LinhaPlanoCorte[]
  vidro: string
  folgaLarguraMm: number | null
  folgaAlturaMm: number | null
  quantidadeEsquadrias: number
}): ResultadoVidroPlano {
  const vidro = params.vidro.trim()
  if (!vidro) return { linha: null, aviso: 'Selecione ou informe o vidro para gerar a lista de vidros.' }
  if (params.folgaLarguraMm == null || params.folgaAlturaMm == null) {
    return { linha: null, aviso: 'Escolha a folga do vidro na largura e na altura.' }
  }
  if (params.folgaLarguraMm < 0 || params.folgaAlturaMm < 0) {
    return { linha: null, aviso: 'As folgas do vidro nao podem ser negativas.' }
  }

  if (params.tipologiaId !== TIPOLOGIA_PC3_SUPREMA) {
    return {
      linha: null,
      aviso: 'Esta tipologia ainda nao possui regra tecnica validada para gerar a medida do vidro automaticamente.',
    }
  }

  const horizontal = linhaBaguete(params.linhasPlano, 'L')
  const vertical = linhaBaguete(params.linhasPlano, 'H')
  if (!horizontal || !vertical) {
    return {
      linha: null,
      aviso: 'Nao foi possivel localizar os baguetes SU102 horizontal e vertical validados para calcular o vidro.',
    }
  }

  const quantidadePorEsquadria = quantidadeVidrosPorEsquadria(horizontal, vertical)
  if (!quantidadePorEsquadria) {
    return {
      linha: null,
      aviso: 'A quantidade de vidros nao pode ser inferida com seguranca a partir dos baguetes desta configuracao.',
    }
  }

  const larguraCorte = horizontal.tamanho - params.folgaLarguraMm
  const alturaCorte = vertical.tamanho - params.folgaAlturaMm
  if (larguraCorte <= 0 || alturaCorte <= 0) {
    return { linha: null, aviso: 'A folga informada deixou a medida do vidro invalida.' }
  }

  const quantidadeEsquadrias = Math.max(1, Math.floor(params.quantidadeEsquadrias || 1))

  return {
    linha: {
      vidro,
      largura_base_mm: horizontal.tamanho,
      altura_base_mm: vertical.tamanho,
      folga_largura_mm: params.folgaLarguraMm,
      folga_altura_mm: params.folgaAlturaMm,
      largura_corte_mm: larguraCorte,
      altura_corte_mm: alturaCorte,
      quantidade: quantidadePorEsquadria * quantidadeEsquadrias,
      referencia_tecnica: 'Baguetes SU102 (horizontal + vertical)',
    },
    aviso: null,
  }
}
