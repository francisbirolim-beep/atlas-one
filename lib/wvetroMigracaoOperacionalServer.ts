import { createHash } from 'crypto'
import { neonStaging } from '@/lib/neonStaging'
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

function chavePrimeiroDisponivel(prefixo: string, valores: unknown[]) {
  const primeiro = valores.map(texto).find(Boolean)
  return primeiro ? `${prefixo}:${primeiro}` : ''
}

function chaveComposta(prefixo: string, valores: unknown[]) {
  const partes = valores.map(texto).filter(Boolean)
  return partes.length ? `${prefixo}:${partes.join(':')}` : ''
}

export function chaveExternaWVetro(
  recurso: WVetroOperacionalRecurso,
  payload: Record<string, unknown>,
): string {
  switch (recurso) {
    case 'pessoas':
      return chavePrimeiroDisponivel('pessoa', [payload.PessoaId, payload.PessoaCodigo, payload.PessoaCPFCNPJ])
    case 'vendedores':
      return chavePrimeiroDisponivel('vendedor', [payload.VendedorId, payload.VendedorCPFCNPJ, payload.VendedorEmail])
    case 'orcamentos':
      return chavePrimeiroDisponivel('orcamento', [payload.Nro])
    case 'pedidos':
      return chavePrimeiroDisponivel('pedido', [payload.Nro])
    case 'pedido':
      return chavePrimeiroDisponivel('pedido', [payload.OrcamentoId, payload.Orcamentoid, payload.Nro])
    case 'metas':
      return chavePrimeiroDisponivel('meta', [payload.id]) ||
        chaveComposta('meta', [payload.VendedorId, payload.LinhaId, payload.Ano, payload.Mes])
    case 'notas_entrada':
      return chavePrimeiroDisponivel('nf', [payload.NFCompraId, payload.NFCompraChaveNFe]) ||
        chaveComposta('nf', [payload.NFCompraFornecedorId, payload.NFCompraNro, payload.NFCompraSerie])
    case 'itens_nf':
      return chavePrimeiroDisponivel('nfitem', [payload.ItemNFCompraId]) ||
        chaveComposta('nfitem', [payload.NFCompraId, payload.ProdutoId, payload.ProdutoCodigo])
    case 'estoque_movimentos':
      return chaveComposta('estoque', [
        payload.MovimentoEstoqueDtLancamento,
        payload.MovimentoEstoqueDocumento,
        payload.MovimentoEstoqueTipo,
        payload.ProdutoId,
        payload.CorEstoqueId,
        payload.LocalEstoqueId,
        payload.MovimentoEstoqueQtde,
      ])
    case 'titulos':
      return chavePrimeiroDisponivel('titulo', [payload.TituloId])
    case 'titulos_baixados':
      return chavePrimeiroDisponivel('titulo-baixa', [payload.TituloId]) ||
        chaveComposta('titulo-baixa', [payload.TituloDtBaixa, payload.PessoaId, payload.TituloVlrRecebido])
    case 'contas':
      return chavePrimeiroDisponivel('conta', [payload.id, payload.contaNro])
    case 'plano_contas':
      return chavePrimeiroDisponivel('plano', [payload.id, payload.codigo])
    case 'extrato':
      return chavePrimeiroDisponivel('extrato', [payload.id]) ||
        chaveComposta('extrato', [
        payload.id,
        payload.contaId,
        payload.data,
        payload.documento,
        payload.valor,
        payload.tipo,
      ])
    case 'lotes_producao':
      return chavePrimeiroDisponivel('lote', [payload.id, payload.nro])
    case 'producao_projeto':
      return chavePrimeiroDisponivel('producao-projeto', [payload.id]) ||
        chaveComposta('producao-projeto', [payload.loteId, payload.orcamento])
    case 'instalacoes':
      return chavePrimeiroDisponivel('instalacao', [payload.ProgInstalacaoId, payload.ProgInstalacaoNro])
    case 'linhas':
      return chavePrimeiroDisponivel('linha', [payload.LinhaId, payload.LinhaNome])
    case 'cores':
      return chavePrimeiroDisponivel('cor', [payload.CorId, payload.CorNome])
    case 'vidros':
      return chavePrimeiroDisponivel('vidro', [payload.VidroId]) ||
        chaveComposta('vidro', [payload.CorId, payload.CorNome, payload.Descricao])
    case 'tipos_pessoa':
      return chavePrimeiroDisponivel('tipo-pessoa', [payload.TipoClienteId, payload.id, payload.codigo, payload.descricao])
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
  const sql = neonStaging()
  const rows = await sql`
    insert into wvetro_migracao.execucoes (
      recurso, periodo_inicio, periodo_fim, cursor_data, status,
      criado_por_id, criado_por_nome, iniciado_em
    ) values (
      ${params.recurso},
      ${params.periodoInicio || null}::date,
      ${params.periodoFim || null}::date,
      ${params.periodoInicio || null}::date,
      'em_andamento',
      ${params.criadoPorId || null},
      ${params.criadoPorNome || null},
      now()
    )
    returning id
  `

  const id = String((rows[0] as { id?: string } | undefined)?.id || '')
  if (!id) throw new Error('Não foi possível iniciar a execução operacional W.Vetro no Neon.')
  return id
}

export async function salvarStagingWVetroOperacional(params: {
  execucaoId: string
  recurso: WVetroOperacionalRecurso
  payload: unknown
}): Promise<ExecucaoResumo> {
  const sql = neonStaging()
  const { registros, semChave } = transformarPayloadWVetroEmStaging(params.recurso, params.payload)
  let novos = 0
  let repetidos = 0
  let erros = semChave.length

  for (const registro of registros) {
    try {
      const versoes = await sql`
        select coalesce(max(versao), 0)::int as versao
        from wvetro_migracao.raw
        where recurso = ${registro.recurso}
          and chave_externa = ${registro.chaveExterna}
      `
      const proximaVersao = Number((versoes[0] as { versao?: number } | undefined)?.versao || 0) + 1

      const inseridos = await sql`
        insert into wvetro_migracao.raw (
          execucao_id, recurso, chave_externa, data_referencia, versao, payload, payload_hash
        ) values (
          ${params.execucaoId}::uuid,
          ${registro.recurso},
          ${registro.chaveExterna},
          ${registro.dataReferencia}::date,
          ${proximaVersao},
          ${JSON.stringify(registro.payload)}::jsonb,
          ${registro.payloadHash}
        )
        on conflict (recurso, chave_externa, payload_hash) do nothing
        returning id
      `

      if (inseridos.length > 0) novos += 1
      else repetidos += 1
    } catch (error) {
      console.error('Erro ao persistir snapshot W.Vetro no Neon:', error)
      erros += 1
    }
  }

  for (const item of semChave) {
    try {
      await sql`
        insert into wvetro_migracao.pendencias (
          execucao_id, recurso, tipo, motivo, contexto, status
        ) values (
          ${params.execucaoId}::uuid,
          ${params.recurso},
          'captura',
          'Registro sem chave externa segura.',
          ${JSON.stringify({ payload: item })}::jsonb,
          'pendente'
        )
      `
    } catch (error) {
      console.error('Erro ao registrar pendência W.Vetro no Neon:', error)
    }
  }

  const lidos = registros.length + semChave.length
  const status = erros > 0 ? 'erro' : 'concluida'
  const ultimaMensagem = `${novos} novos, ${repetidos} repetidos, ${erros} erro(s)/pendência(s).`
  const mensagemErro = erros > 0
    ? 'A execução terminou com pendências; revisar wvetro_migracao.pendencias.'
    : null

  await sql`
    update wvetro_migracao.execucoes
    set status = ${status},
        total_lidos = ${lidos},
        total_novos = ${novos},
        total_erros = ${erros},
        ultima_mensagem = ${ultimaMensagem},
        erro = ${mensagemErro},
        updated_at = now(),
        finalizado_em = now()
    where id = ${params.execucaoId}::uuid
  `

  return { id: params.execucaoId, lidos, novos, repetidos, erros }
}
