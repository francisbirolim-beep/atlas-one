import { createHash } from 'crypto'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { WVetroOperacionalRecurso } from '@/lib/wvetroOperacionalMap'

export type WVetroRegistroStaging = {
  recurso: WVetroOperacionalRecurso
  chaveExterna: string
  dataReferencia: string | null
  payload: Record<string, unknown>
  payloadHash: string
}

type ExecucaoResumo = {
  id: string
  lidos: number
  novos: number
  repetidos: number
  erros: number
}

function objeto(valor: unknown): Record<string, unknown> | null {
  return valor && typeof valor === 'object' && !Array.isArray(valor)
    ? (valor as Record<string, unknown>)
    : null
}

function texto(valor: unknown) {
  return String(valor ?? '').trim()
}

function dataIso(valor: unknown): string | null {
  const bruto = texto(valor)
  if (!bruto) return null
  const match = bruto.match(/^(\d{4}-\d{2}-\d{2})/)
  return match ? match[1] : null
}

function normalizarParaHash(valor: unknown): unknown {
  if (Array.isArray(valor)) return valor.map(normalizarParaHash)
  const obj = objeto(valor)
  if (!obj) return valor

  return Object.keys(obj)
    .sort((a, b) => a.localeCompare(b, 'en'))
    .reduce<Record<string, unknown>>((acc, chave) => {
      acc[chave] = normalizarParaHash(obj[chave])
      return acc
    }, {})
}

export function hashPayloadWVetro(payload: unknown) {
  return createHash('sha256')
    .update(JSON.stringify(normalizarParaHash(payload)))
    .digest('hex')
}

function primeiraColecao(payload: unknown): unknown[] {
  if (Array.isArray(payload)) return payload
  const obj = objeto(payload)
  if (!obj) return []

  const nomes = [
    'ListPessoa',
    'ListPessoas',
    'ListVendedor',
    'ListVendedores',
    'ListPedidos',
    'ListNF',
    'ListNFs',
    'ListItens',
    'SDTTitulos',
    'sdtMovimentoEstoque',
    'sdtContas',
    'sdtPlanoContas',
    'sdtExtrato',
    'sdtMetas',
    'Lotes',
    'Projetos',
    'Instalacoes',
  ]

  for (const nome of nomes) {
    const valor = obj[nome]
    if (Array.isArray(valor)) return valor
  }

  const arrays = Object.values(obj).filter(Array.isArray)
  if (arrays.length === 1) return arrays[0] as unknown[]

  // Alguns endpoints por chave retornam um único objeto.
  return [payload]
}

function chaveComFallback(prefixo: string, valores: unknown[]) {
  const partes = valores.map(texto).filter(Boolean)
  return partes.length ? `${prefixo}:${partes.join(':')}` : ''
}

export function chaveExternaWVetro(
  recurso: WVetroOperacionalRecurso,
  payload: Record<string, unknown>,
): string {
  switch (recurso) {
    case 'pessoas':
      return chaveComFallback('pessoa', [payload.PessoaId, payload.PessoaCodigo, payload.PessoaCPFCNPJ])
    case 'vendedores':
      return chaveComFallback('vendedor', [payload.VendedorId, payload.VendedorCPFCNPJ, payload.VendedorEmail])
    case 'orcamentos':
      return chaveComFallback('orcamento', [payload.Nro, payload.ClienteCodigo])
    case 'pedidos':
      return chaveComFallback('pedido', [payload.Nro, payload.ClienteCodigo])
    case 'pedido':
      return chaveComFallback('pedido', [payload.Nro, payload.OrcamentoId, payload.Orcamentoid])
    case 'metas':
      return chaveComFallback('meta', [
        payload.id,
        payload.VendedorId,
        payload.LinhaId,
        payload.Ano,
        payload.Mes,
      ])
    case 'notas_entrada':
      return chaveComFallback('nf', [
        payload.NFCompraId,
        payload.NFCompraChaveNFe,
        payload.NFCompraFornecedorId,
        payload.NFCompraNro,
        payload.NFCompraSerie,
      ])
    case 'itens_nf':
      return chaveComFallback('nfitem', [
        payload.ItemNFCompraId,
        payload.ProdutoId,
        payload.ProdutoCodigo,
      ])
    case 'estoque_movimentos':
      return chaveComFallback('estoque', [
        payload.MovimentoEstoqueDtLancamento,
        payload.MovimentoEstoqueDocumento,
        payload.MovimentoEstoqueTipo,
        payload.ProdutoId,
        payload.CorEstoqueId,
        payload.LocalEstoqueId,
        payload.MovimentoEstoqueQtde,
      ])
    case 'titulos':
      return chaveComFallback('titulo', [payload.TituloId])
    case 'titulos_baixados':
      return chaveComFallback('titulo-baixa', [payload.TituloId, payload.TituloDtBaixa, payload.TituloVlrRecebido])
    case 'contas':
      return chaveComFallback('conta', [payload.id, payload.contaNro])
    case 'plano_contas':
      return chaveComFallback('plano', [payload.id, payload.codigo])
    case 'extrato':
      return chaveComFallback('extrato', [
        payload.id,
        payload.contaId,
        payload.data,
        payload.documento,
        payload.valor,
        payload.tipo,
      ])
    case 'lotes_producao':
      return chaveComFallback('lote', [payload.id, payload.nro])
    case 'producao_projeto':
      return chaveComFallback('producao-projeto', [payload.id, payload.loteId, payload.orcamento])
    case 'instalacoes':
      return chaveComFallback('instalacao', [payload.ProgInstalacaoId, payload.ProgInstalacaoNro])
    case 'linhas':
      return chaveComFallback('linha', [payload.LinhaId, payload.LinhaNome])
    case 'cores':
      return chaveComFallback('cor', [payload.CorId, payload.CorNome])
    case 'vidros':
      return chaveComFallback('vidro', [payload.VidroId, payload.CorId, payload.CorNome, payload.Descricao])
    case 'tipos_pessoa':
      return chaveComFallback('tipo-pessoa', [payload.TipoClienteId, payload.id, payload.codigo, payload.descricao])
    default:
      return ''
  }
}

export function dataReferenciaWVetro(
  recurso: WVetroOperacionalRecurso,
  payload: Record<string, unknown>,
): string | null {
  switch (recurso) {
    case 'orcamentos':
    case 'pedidos':
    case 'pedido':
      return dataIso(payload.DtVenda) || dataIso(payload.DtEmissao) || dataIso(payload.Data)
    case 'notas_entrada':
      return dataIso(payload.NFCompraDtEntrada) || dataIso(payload.NFCompraDtEmissao)
    case 'estoque_movimentos':
      return dataIso(payload.MovimentoEstoqueDtLancamento) || dataIso(payload.MovimentoEstoqueDt)
    case 'titulos':
      return dataIso(payload.TituloDtVencimento) || dataIso(payload.TituloDtEmissao)
    case 'titulos_baixados':
      return dataIso(payload.TituloDtBaixa) || dataIso(payload.TituloDtVencimento)
    case 'extrato':
      return dataIso(payload.data)
    case 'lotes_producao':
      return dataIso(payload.dataprogramacao) || dataIso(payload.prevInicio)
    case 'producao_projeto':
      return dataIso(payload.dataProduzido)
    case 'instalacoes':
      return dataIso(payload.ProgInstalacaoDt) || dataIso(payload.DtInicio)
    default:
      return null
  }
}

export function transformarPayloadWVetroEmStaging(
  recurso: WVetroOperacionalRecurso,
  payload: unknown,
): { registros: WVetroRegistroStaging[]; semChave: Record<string, unknown>[] } {
  const registros: WVetroRegistroStaging[] = []
  const semChave: Record<string, unknown>[] = []

  for (const item of primeiraColecao(payload)) {
    const obj = objeto(item)
    if (!obj) continue

    const chaveExterna = chaveExternaWVetro(recurso, obj)
    if (!chaveExterna) {
      semChave.push(obj)
      continue
    }

    registros.push({
      recurso,
      chaveExterna,
      dataReferencia: dataReferenciaWVetro(recurso, obj),
      payload: obj,
      payloadHash: hashPayloadWVetro(obj),
    })
  }

  return { registros, semChave }
}

export async function criarExecucaoWVetroOperacional(params: {
  recurso: WVetroOperacionalRecurso
  periodoInicio?: string | null
  periodoFim?: string | null
  criadoPorId?: string | null
  criadoPorNome?: string | null
}) {
  const { data, error } = await supabaseAdmin
    .from('wvetro_operacional_execucoes')
    .insert({
      recurso: params.recurso,
      periodo_inicio: params.periodoInicio || null,
      periodo_fim: params.periodoFim || null,
      cursor_data: params.periodoInicio || null,
      status: 'em_andamento',
      criado_por_id: params.criadoPorId || null,
      criado_por_nome: params.criadoPorNome || null,
      iniciado_em: new Date().toISOString(),
    })
    .select('id')
    .single()

  if (error || !data?.id) {
    throw new Error(`Não foi possível iniciar a execução operacional W.Vetro: ${error?.message || 'sem id'}`)
  }

  return String(data.id)
}

export async function salvarStagingWVetroOperacional(params: {
  execucaoId: string
  recurso: WVetroOperacionalRecurso
  payload: unknown
}): Promise<ExecucaoResumo> {
  const { registros, semChave } = transformarPayloadWVetroEmStaging(params.recurso, params.payload)
  let novos = 0
  let repetidos = 0
  let erros = semChave.length

  for (const registro of registros) {
    const { data: existente, error: erroBusca } = await supabaseAdmin
      .from('wvetro_operacional_raw')
      .select('id')
      .eq('recurso', registro.recurso)
      .eq('chave_externa', registro.chaveExterna)
      .eq('payload_hash', registro.payloadHash)
      .maybeSingle()

    if (erroBusca) {
      erros += 1
      continue
    }

    if (existente?.id) {
      repetidos += 1
      continue
    }

    const { count, error: erroVersao } = await supabaseAdmin
      .from('wvetro_operacional_raw')
      .select('id', { count: 'exact', head: true })
      .eq('recurso', registro.recurso)
      .eq('chave_externa', registro.chaveExterna)

    if (erroVersao) {
      erros += 1
      continue
    }

    const { error: erroInsert } = await supabaseAdmin
      .from('wvetro_operacional_raw')
      .insert({
        execucao_id: params.execucaoId,
        recurso: registro.recurso,
        chave_externa: registro.chaveExterna,
        data_referencia: registro.dataReferencia,
        versao: (count || 0) + 1,
        payload: registro.payload,
        payload_hash: registro.payloadHash,
      })

    if (erroInsert) erros += 1
    else novos += 1
  }

  for (const item of semChave) {
    await supabaseAdmin.from('wvetro_operacional_pendencias').insert({
      execucao_id: params.execucaoId,
      recurso: params.recurso,
      tipo: 'captura',
      motivo: 'Registro sem chave externa segura.',
      contexto: { payload: item },
      status: 'pendente',
    })
  }

  const lidos = registros.length + semChave.length
  const status = erros > 0 ? 'erro' : 'concluida'
  const agora = new Date().toISOString()

  const { error: erroExecucao } = await supabaseAdmin
    .from('wvetro_operacional_execucoes')
    .update({
      status,
      total_lidos: lidos,
      total_novos: novos,
      total_erros: erros,
      ultima_mensagem: `${novos} novos, ${repetidos} repetidos, ${erros} erro(s)/pendência(s).`,
      erro: erros > 0 ? 'A execução terminou com pendências; revisar wvetro_operacional_pendencias.' : null,
      updated_at: agora,
      finalizado_em: agora,
    })
    .eq('id', params.execucaoId)

  if (erroExecucao) {
    throw new Error(`Staging salvo, mas falhou ao finalizar a execução: ${erroExecucao.message}`)
  }

  return { id: params.execucaoId, lidos, novos, repetidos, erros }
}
