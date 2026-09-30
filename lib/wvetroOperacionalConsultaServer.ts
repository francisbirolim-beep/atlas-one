import {
  buscarPedidoWVetro,
  listarContasWVetro,
  listarCoresWVetro,
  listarExtratoWVetro,
  listarInstalacoesWVetro,
  listarItensNotaEntradaWVetro,
  listarLinhasWVetro,
  listarLotesProducaoWVetro,
  listarMetasWVetro,
  listarMovimentosEstoqueWVetro,
  listarNotasEntradaWVetro,
  listarOrcamentosWVetro,
  listarPedidosWVetro,
  listarPessoasWVetro,
  listarPlanoContasWVetro,
  listarProducaoProjetoWVetro,
  listarTiposPessoaWVetro,
  listarTitulosBaixadosWVetro,
  listarTitulosWVetro,
  listarVendedoresWVetro,
  listarVidrosWVetro,
} from '@/lib/wvetroApi'
import { WVetroOperacionalRecurso } from '@/lib/wvetroOperacionalMap'

export type WVetroOperacionalConsultaParams = {
  inicio?: string
  fim?: string
  pessoaId?: string
  tipoPessoa?: string
  vendedorId?: string
  linhaId?: string
  ano?: number
  mes?: number
  id?: string
  nfId?: string
  tipo?: string
  produtoCodigo?: string
  corNome?: string
  tituloTipo?: string
  contaNro?: string
  loteNro?: string
  programacaoNro?: string
  produzido?: boolean
}

function dataIsoValida(valor?: string): valor is string {
  if (!valor || !/^\d{4}-\d{2}-\d{2}$/.test(valor)) return false
  return !Number.isNaN(new Date(`${valor}T00:00:00Z`).getTime())
}

export function validarPeriodoWVetro(
  inicio?: string,
  fim?: string,
  limiteDias = 7,
) {
  if (!dataIsoValida(inicio) || !dataIsoValida(fim)) {
    throw new Error('Informe inicio e fim no formato YYYY-MM-DD.')
  }

  const inicioMs = new Date(`${inicio}T00:00:00Z`).getTime()
  const fimMs = new Date(`${fim}T00:00:00Z`).getTime()
  const dias = Math.floor((fimMs - inicioMs) / 86_400_000)

  if (dias < 0) throw new Error('A data final não pode ser anterior à data inicial.')
  if (dias > limiteDias) {
    throw new Error(`A API W.Vetro deve ser consultada em lotes de no máximo ${limiteDias} dias.`)
  }

  return { inicio, fim, dias }
}

export function recursoWVetroExigePeriodo(recurso: WVetroOperacionalRecurso) {
  return [
    'orcamentos',
    'pedidos',
    'notas_entrada',
    'estoque_movimentos',
    'titulos',
    'titulos_baixados',
    'extrato',
    'lotes_producao',
    'producao_projeto',
    'instalacoes',
  ].includes(recurso)
}

export async function consultarRecursoOperacionalWVetro(
  recurso: WVetroOperacionalRecurso,
  params: WVetroOperacionalConsultaParams = {},
) {
  if (recurso === 'pessoas') {
    return listarPessoasWVetro({
      pessoaId: params.pessoaId,
      tipoPessoa: params.tipoPessoa,
    })
  }

  if (recurso === 'tipos_pessoa') return listarTiposPessoaWVetro()
  if (recurso === 'vendedores') return listarVendedoresWVetro(params.vendedorId)
  if (recurso === 'linhas') return listarLinhasWVetro()
  if (recurso === 'cores') return listarCoresWVetro()
  if (recurso === 'vidros') return listarVidrosWVetro()

  if (recurso === 'pedido') {
    if (!params.id) throw new Error('Informe id do orçamento/pedido W.Vetro.')
    return buscarPedidoWVetro(params.id)
  }

  if (recurso === 'metas') {
    const ano = Number(params.ano)
    const mes = Number(params.mes)
    if (!Number.isInteger(ano) || !Number.isInteger(mes) || mes < 1 || mes > 12) {
      throw new Error('Informe ano e mes válidos.')
    }

    return listarMetasWVetro({
      vendedorId: params.vendedorId,
      linhaId: params.linhaId,
      ano,
      mes,
    })
  }

  if (recurso === 'itens_nf') {
    if (!params.nfId) throw new Error('Informe nfId.')
    return listarItensNotaEntradaWVetro(params.nfId)
  }

  if (recurso === 'contas') return listarContasWVetro(params.contaNro)
  if (recurso === 'plano_contas') return listarPlanoContasWVetro()

  const periodo = validarPeriodoWVetro(params.inicio, params.fim, 7)

  if (recurso === 'orcamentos') return listarOrcamentosWVetro(periodo.inicio, periodo.fim)
  if (recurso === 'pedidos') return listarPedidosWVetro(periodo.inicio, periodo.fim)
  if (recurso === 'notas_entrada') return listarNotasEntradaWVetro(periodo.inicio, periodo.fim)

  if (recurso === 'estoque_movimentos') {
    return listarMovimentosEstoqueWVetro(periodo.inicio, periodo.fim, {
      tipo: params.tipo,
      produtoCodigo: params.produtoCodigo,
      corNome: params.corNome,
    })
  }

  if (recurso === 'titulos') {
    return listarTitulosWVetro(periodo.inicio, periodo.fim, params.tituloTipo)
  }

  if (recurso === 'titulos_baixados') {
    return listarTitulosBaixadosWVetro(periodo.inicio, periodo.fim, params.tituloTipo)
  }

  if (recurso === 'extrato') {
    return listarExtratoWVetro(periodo.inicio, periodo.fim, {
      contaNro: params.contaNro,
      tipo: params.tipo,
    })
  }

  if (recurso === 'lotes_producao') {
    return listarLotesProducaoWVetro({
      loteNro: params.loteNro,
      inicio: periodo.inicio,
      fim: periodo.fim,
      produzido: params.produzido,
    })
  }

  if (recurso === 'producao_projeto') {
    return listarProducaoProjetoWVetro({
      loteNro: params.loteNro,
      inicio: periodo.inicio,
      fim: periodo.fim,
    })
  }

  if (recurso === 'instalacoes') {
    return listarInstalacoesWVetro({
      programacaoNro: params.programacaoNro,
      inicio: periodo.inicio,
      fim: periodo.fim,
    })
  }

  throw new Error('Recurso operacional não reconhecido.')
}
