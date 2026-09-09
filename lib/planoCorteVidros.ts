import { tokenAtual } from './auth'
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

// Espelho local das 14 referências reais atualmente cadastradas no Atlas/W.Vetro.
// É usado apenas como contingência quando a API não puder responder no carregamento
// inicial da tela. Quando a API responde, a base do banco continua sendo a fonte principal.
const VIDROS_REFERENCIA_FALLBACK: VidroCatalogoPlano[] = [
  { id: 'aef27912-3315-4d86-8aa1-097ce6db0768', codigo: 'VIDRO', nome: 'INCOLOR 06MM - TEMPERADO' },
  { id: '31ac36bb-398a-4bbd-bf03-6516d380800a', codigo: 'VIDRO', nome: 'INCOLOR 08MM - TEMPERADO' },
  { id: 'b76c4369-32f6-486b-8215-b58bb21d98fb', codigo: 'VIDRO', nome: 'MINI-BOREAL 04MM - COMUM' },
  { id: 'f7816717-b18e-4cd4-9bfa-5e3a75ad8e29', codigo: 'VIDRO', nome: 'BOX 8MM TEMPERADO INCOLOR' },
  { id: '174eac69-5355-436b-ad7f-40aa38c25094', codigo: 'VIDRO', nome: 'LAMINADO PRATA REFLETIVO 4+4 LAPIDADO' },
  { id: 'efe1c1e7-89ac-4ce7-aac4-10db3f4f00ca', codigo: 'VIDRO', nome: 'FUME 06MM - TEMPERADO' },
  { id: '93bce7dc-663f-4876-a079-3fe2c6c08169', codigo: 'VIDRO', nome: 'INCOLOR 06MM - COMUM' },
  { id: '635a9cd3-7511-4748-bcd3-df38a822e552', codigo: 'VIDRO', nome: 'ESPELHO 04MM - BISOTE' },
  { id: '0d8b140f-6ed2-4198-b4ef-fc539619bcc5', codigo: 'VIDRO', nome: 'ESPELHO 04MM - LAPIDADO' },
  { id: '1f1a05c5-61ec-4f86-8c78-3491b16e45a5', codigo: 'VIDRO', nome: 'INCOLOR 04MM - COMUM' },
  { id: 'c94fcd60-f26d-4828-8951-088af5d9e2d0', codigo: 'VIDRO', nome: 'INCOLOR 10MM - TEMPERADO' },
  { id: '10ff7b76-5803-428a-a68c-f9802904e438', codigo: 'VIDRO', nome: 'LAMINADO FUME 4+4 - LAPIDADO' },
  { id: '98fefcc8-c23a-48f3-84c0-4e126cfd9137', codigo: 'VIDRO', nome: 'LAMINADO INCOLOR 4+4 LAPIDADO TEMPERADO' },
  { id: 'f1ba376a-f714-48d3-b3fa-4a94ebec391e', codigo: 'VIDRO', nome: 'VIDRO JUMBO 8MM' },
]

/**
 * Catálogo de vidro usado no orçamento/engenharia.
 *
 * A fonte real disponível hoje é wvetro_referencias_vidros, formada a partir
 * dos Vidros[] observados nos pedidos/orçamentos W.Vetro. Essa tabela é lida
 * somente server-side; o client recebe apenas os campos necessários por API.
 *
 * Não confundir com produtos cujo nome menciona "vidro" (perfil, gaxeta,
 * fechadura, suporte etc.). Esses itens não são panos de vidro e não entram
 * neste seletor.
 */
export async function listarVidrosPlanoCorte(): Promise<VidroCatalogoPlano[]> {
  try {
    const token = await tokenAtual()
    if (!token) return VIDROS_REFERENCIA_FALLBACK

    const resposta = await fetch('/api/orcamento/vidros-referencia', {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
    })

    if (!resposta.ok) return VIDROS_REFERENCIA_FALLBACK
    const json = await resposta.json()
    const vidros = Array.isArray(json?.vidros) ? json.vidros as VidroCatalogoPlano[] : []
    return vidros.length ? vidros : VIDROS_REFERENCIA_FALLBACK
  } catch (error) {
    console.error('Erro ao carregar referências de vidro W.Vetro:', error)
    return VIDROS_REFERENCIA_FALLBACK
  }
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
