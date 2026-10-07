import { NextRequest, NextResponse } from 'next/server'
import { autenticarSchedulerWVetro } from '@/lib/wvetroSchedulerServer'
import { descobrirEImportarCatalogoWVetro } from '@/lib/wvetroCatalogoCompletoServer'
import {
  mapearReferenciasComponentesExatas,
  materializarReferenciasTipologiasWVetroPendentes,
  processarBaseTecnicaWVetroDia,
  resumoBaseTecnicaWVetro,
  sincronizarCatalogoEsquadriasWVetro,
  sincronizarCustosProdutosWVetro,
} from '@/lib/wvetroBaseTecnicaServer'
import { sincronizarLinhasApiWVetro } from '@/lib/wvetroAuditoriaServer'
import { processarPendenciasImagensWVetro } from '@/lib/wvetroImagensServer'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

function dataLocal(offsetDias = 0) {
  const agora = new Date()
  const base = new Date(agora.getTime() + offsetDias * 86400000)
  const partes = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(base)
  const valor = Object.fromEntries(partes.map(p => [p.type, p.value]))
  return valor.year + '-' + valor.month + '-' + valor.day
}

function texto(...valores: unknown[]) {
  for (const valor of valores) {
    const s = String(valor ?? '').trim()
    if (s) return s
  }
  return ''
}

function objeto(valor: unknown): Record<string, any> {
  return valor && typeof valor === 'object' && !Array.isArray(valor)
    ? valor as Record<string, any>
    : {}
}

function dataIso(valor: unknown) {
  const s = texto(valor)
  const m = s.match(/^(\d{4}-\d{2}-\d{2})/)
  return m ? m[1] : null
}

async function garantirFilaValidacaoOrcamentosOperacionais(usuario: {
  id: string
  nome?: string | null
  empresa_id: string
}) {
  const { data: orcamentos, error } = await supabaseAdmin
    .from('orcamentos')
    .select('id,empresa_id,cliente_id,cliente_nome,valor_estimado,status,created_at,updated_at,itens,wvetro_fluxo,modo_entrada')
    .eq('empresa_id', usuario.empresa_id)
    .contains('wvetro_fluxo', { origem: 'wvetro_api' })
    .neq('modo_entrada', 'wvetro_api_vinculado')
    .is('cliente_id', null)
    .limit(500)

  if (error) throw error

  const candidatos = (orcamentos || [])
    .map((orcamento: any) => {
      const fluxo = objeto(orcamento.wvetro_fluxo)
      const payload = objeto(fluxo.payload_bruto)
      const numero = texto(fluxo.numero, payload.Nro, payload.OrcamentoId, payload.Orcamentoid)
      return { orcamento, fluxo, payload, numero }
    })
    .filter((x: any) => !!x.numero)

  const numeros = Array.from(new Set(candidatos.map((x: any) => x.numero)))
  if (!numeros.length) return { analisados: 0, inseridos: 0, jaExistentes: 0, numerosInseridos: [] as string[] }

  const { data: historicos, error: historicoError } = await supabaseAdmin
    .from('wvetro_historico_comercial')
    .select('numero_wvetro')
    .eq('empresa_id', usuario.empresa_id)
    .in('numero_wvetro', numeros)

  if (historicoError) throw historicoError

  const existentes = new Set((historicos || []).map((h: any) => texto(h.numero_wvetro)).filter(Boolean))
  const faltantes = candidatos.filter((x: any) => !existentes.has(x.numero))

  const rows = faltantes.map(({ orcamento, fluxo, payload, numero }: any) => {
    const itensPayload = Array.isArray(payload.Itens)
      ? payload.Itens
      : Array.isArray(payload.itens)
        ? payload.itens
        : Array.isArray(orcamento.itens)
          ? orcamento.itens
          : []

    const dataEmissao = dataIso(
      fluxo.data_referencia,
      payload.DtEmissao,
      payload.Data,
      orcamento.created_at,
    )

    const nomeCliente = texto(
      fluxo.cliente_nome_wvetro,
      payload.ClienteNome,
      payload.PessoaNome,
      payload.NomeCliente,
      payload.RazaoSocial,
      orcamento.cliente_nome,
    )

    return {
      empresa_id: usuario.empresa_id,
      cliente_id: null,
      tipo_registro: 'orcamento_historico',
      chave_externa: 'operacional:' + numero,
      numero_wvetro: numero,
      situacao_wvetro: texto(fluxo.situacao, payload.Situacao, payload.Status) || null,
      data_emissao: dataEmissao,
      data_venda: null,
      valor_total: Number(orcamento.valor_estimado || payload.Total || payload.ValorBruto || 0) || null,
      cliente_nome_origem: nomeCliente || null,
      cliente_documento_origem: texto(payload.PessoaCPFCNPJ, payload.ClienteCPFCNPJ, payload.CPFCNPJ, payload.Documento) || null,
      cliente_codigo_origem: texto(fluxo.cliente_codigo_wvetro, payload.ClienteCodigo, payload.PessoaCodigo, payload.PessoaId, payload.ClienteId) || null,
      metodo_identidade: 'candidato_operacional',
      status_vinculo: 'revisao',
      itens: itensPayload,
      payload_origem: {
        fonte: 'orcamento_operacional_atlas',
        orcamento_atlas_id: orcamento.id,
        numero_wvetro: numero,
        payload_hash: fluxo.payload_hash || null,
      },
      dados_origem: {
        candidato_operacional: true,
        origem_operacional_atlas: true,
      },
      somente_historico: true,
      importado_por_id: usuario.id,
      importado_por_nome: usuario.nome || null,
      updated_at: new Date().toISOString(),
    }
  })

  if (rows.length) {
    const { error: insertError } = await supabaseAdmin
      .from('wvetro_historico_comercial')
      .upsert(rows, {
        onConflict: 'empresa_id,tipo_registro,chave_externa',
        ignoreDuplicates: true,
      })
    if (insertError) throw insertError
  }

  return {
    analisados: candidatos.length,
    inseridos: rows.length,
    jaExistentes: candidatos.length - rows.length,
    numerosInseridos: rows.map((r: any) => r.numero_wvetro),
  }
}

async function processarFilaImagensAte(deadlineMs: number) {
  const lotes: Array<{
    processados: number
    copiadas: number
    preservadas: number
    erros: number
    indisponiveis: number
    invalidas: number
    semImagem: number
    restantes: number
  }> = []

  // O plano Hobby permite cron diário. Consumimos vários lotes na mesma execução,
  // mas preservamos uma margem para a função terminar e responder antes de 300 s.
  for (let i = 0; i < 4; i += 1) {
    if (Date.now() >= deadlineMs - 20_000) break
    const lote = await processarPendenciasImagensWVetro(30)
    lotes.push(lote)
    if (lote.processados === 0 || lote.restantes === 0) break
  }

  return {
    lotes: lotes.length,
    processados: lotes.reduce((n, l) => n + l.processados, 0),
    copiadas: lotes.reduce((n, l) => n + l.copiadas, 0),
    preservadas: lotes.reduce((n, l) => n + l.preservadas, 0),
    erros: lotes.reduce((n, l) => n + l.erros, 0),
    indisponiveis: lotes.reduce((n, l) => n + l.indisponiveis, 0),
    invalidas: lotes.reduce((n, l) => n + l.invalidas, 0),
    semImagem: lotes.reduce((n, l) => n + l.semImagem, 0),
    restantes: lotes.length ? lotes[lotes.length - 1].restantes : null,
  }
}

export async function GET(req: NextRequest) {
  const usuario = await autenticarSchedulerWVetro(req)
  if (!usuario) return NextResponse.json({ error: 'Scheduler não autorizado.' }, { status: 401 })

  const inicioExecucao = Date.now()
  const hoje = dataLocal(0)
  const ontem = dataLocal(-1)

  try {
    // Antes de observar os orçamentos do dia, atualiza os catálogos completos.
    // Assim novas linhas, perfis, acessórios e tipologias do W.Vetro não ficam
    // esperando aparecer em uma venda/orçamento para entrar na base do Atlas.
    const linhas = await sincronizarLinhasApiWVetro()
    const [perfis, acessorios, esquadrias] = await Promise.all([
      descobrirEImportarCatalogoWVetro('P'),
      descobrirEImportarCatalogoWVetro('A'),
      sincronizarCatalogoEsquadriasWVetro(),
    ])

    const resultados = []
    for (const data of [ontem, hoje]) {
      resultados.push(await processarBaseTecnicaWVetroDia(data))
    }

    const filaValidacao = await garantirFilaValidacaoOrcamentosOperacionais(usuario)
      .catch((e) => ({
        analisados: 0,
        inseridos: 0,
        jaExistentes: 0,
        numerosInseridos: [] as string[],
        erro: e instanceof Error ? e.message : 'Falha ao manter fila de validação W.Vetro.',
      }))

    const tipologias = await materializarReferenciasTipologiasWVetroPendentes()
    const mapeamento = await mapearReferenciasComponentesExatas()
    const custos = await sincronizarCustosProdutosWVetro()
    const resumo = await resumoBaseTecnicaWVetro()

    // Imagens são uma etapa auxiliar: falha de uma URL não pode interromper
    // catálogo, histórico, custos ou materialização de tipologias.
    const imagens = await processarFilaImagensAte(inicioExecucao + 270_000)
      .catch((e) => ({
        lotes: 0,
        processados: 0,
        copiadas: 0,
        preservadas: 0,
        erros: 0,
        indisponiveis: 0,
        invalidas: 0,
        semImagem: 0,
        restantes: null,
        erro: e instanceof Error ? e.message : 'Falha ao processar fila de imagens.',
      }))

    const catalogos = { linhas, perfis, acessorios, esquadrias }

    await supabaseAdmin.from('agente_memorias').insert({
      empresa_id: usuario.empresa_id,
      usuario_id: usuario.id,
      chave: 'atlas_operacional:v1:wvetro',
      valor: JSON.stringify({
        versao: 4,
        dominio: 'wvetro',
        tipo: 'observacao_tecnica_diaria',
        periodo: { inicio: ontem, fim: hoje },
        catalogos,
        resultados,
        filaValidacao,
        tipologias,
        mapeamento,
        custos,
        imagens,
        resumo,
        evidencia: 'observado',
        registrado_em: new Date().toISOString(),
      }),
    })

    return NextResponse.json({
      ok: true,
      periodo: { inicio: ontem, fim: hoje },
      catalogos,
      resultados,
      filaValidacao,
      tipologias,
      mapeamento,
      custos,
      imagens,
      resumo,
      seguranca: {
        fonte: 'W.Vetro',
        regra: 'Catálogos completos + observação técnica; fórmulas e receitas continuam exigindo validação.',
      },
    })
  } catch (e) {
    console.error('Atualização diária W.Vetro:', e)
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Falha na atualização diária W.Vetro.' }, { status: 500 })
  }
}
