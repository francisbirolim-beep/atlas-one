import { NextRequest, NextResponse } from 'next/server'
import { autenticarUsuarioWVetro } from '@/lib/wvetroAcessoServer'
import { usuarioPodeAcaoServer } from '@/lib/acessoUsuarioServer'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { nomesClientesCompativeis } from '@/lib/wvetroClienteIdentidade'
import { validarPeriodoWVetro } from '@/lib/wvetroOperacionalConsultaServer'
import { sincronizar } from '../sincronizar/route'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Sincronização do Cliente 360: nunca abre uma sincronização geral.
// O nome vindo do W.Vetro é a identidade principal; documento/telefone não
// autorizam misturar nomes incompatíveis.

function dataIso(v: unknown) {
  const s = String(v ?? '').trim()
  const m = s.match(/^(\d{4}-\d{2}-\d{2})/)
  return m ? m[1] : null
}

function dataYmd(d: Date) {
  return d.toISOString().slice(0, 10)
}

export async function POST(req: NextRequest) {
  const usuario = await autenticarUsuarioWVetro(req)
  if (!usuario) return NextResponse.json({ error: 'Sessão inválida ou sem acesso à integração W.Vetro.' }, { status: 401 })

  // Mesmo controle de permissão do Cliente 360: edição de orçamento, sem exigir Master.
  // A chamada global de sincronização permanece exclusiva do Master.
  const permitido = await usuarioPodeAcaoServer({
    usuarioId: usuario.id,
    role: usuario.role,
    setorId: 'fazer-orcamento-msanfyvj',
    acaoId: 'comercial.orcamento.editar',
    empresaId: usuario.empresa_id,
    minimo: 'edicao',
  })
  if (!permitido) return NextResponse.json({ error: 'Sem permissão para sincronizar orçamentos W.Vetro.' }, { status: 403 })

  const body = await req.json().catch(() => ({})) as Record<string, unknown>
  const clienteId = String(body.clienteId || '').trim()
  if (!clienteId) return NextResponse.json({ error: 'Cliente não informado.' }, { status: 400 })

  // Pesquisa histórica paginada: cada chamada só lê uma janela segura de até sete dias.
  const inicioSolicitado = String(body.inicio || '').trim()
  const fimSolicitado = String(body.fim || '').trim()
  if (!!inicioSolicitado !== !!fimSolicitado) {
    return NextResponse.json({ error: 'Informe início e fim para pesquisar o histórico.' }, { status: 400 })
  }
  if (inicioSolicitado) {
    try {
      validarPeriodoWVetro(inicioSolicitado, fimSolicitado, 7)
      if (fimSolicitado > dataYmd(new Date())) throw new Error('Não é permitido pesquisar datas futuras.')
    } catch (e) {
      return NextResponse.json({ error: e instanceof Error ? e.message : 'Período W.Vetro inválido.' }, { status: 400 })
    }
  }

  const { data: cliente, error: clienteError } = await supabaseAdmin
    .from('clientes')
    .select('id,nome')
    .eq('id', clienteId)
    .eq('empresa_id', usuario.empresa_id)
    .maybeSingle()

  if (clienteError) return NextResponse.json({ error: clienteError.message }, { status: 500 })
  if (!cliente) return NextResponse.json({ error: 'Cliente não encontrado nesta empresa.' }, { status: 404 })

  const { data: historicos, error: historicoError } = await supabaseAdmin
    .from('wvetro_historico_comercial')
    .select('numero_wvetro,tipo_registro,data_emissao,data_venda,status_vinculo,somente_historico,cliente_nome_origem')
    .eq('cliente_id', clienteId)
    .eq('status_vinculo', 'seguro')
    .eq('somente_historico', true)
    .order('data_emissao', { ascending: false })
    .limit(500)

  if (historicoError) return NextResponse.json({ error: historicoError.message }, { status: 500 })

  const historicosCompativeis = (historicos || []).filter((h: any) =>
    nomesClientesCompativeis(h.cliente_nome_origem, cliente.nome),
  )
  const historicosIgnorados = (historicos || []).length - historicosCompativeis.length

  const fimRecente = new Date()
  const inicioRecente = new Date()
  inicioRecente.setDate(inicioRecente.getDate() - 6)
  const inicioRecenteYmd = dataYmd(inicioRecente)
  const fimRecenteYmd = dataYmd(fimRecente)

  const porData = new Map<string, Set<string>>()
  for (const h of historicosCompativeis) {
    const numero = String((h as any).numero_wvetro || '').trim()
    const data = dataIso((h as any).tipo_registro === 'venda_historica_pedido'
      ? ((h as any).data_venda || (h as any).data_emissao)
      : ((h as any).data_emissao || (h as any).data_venda))
    if (!numero || !data) continue
    // A janela recente já será conferida diretamente na API W.Vetro.
    if (data >= inicioRecenteYmd && data <= fimRecenteYmd) continue
    if (!porData.has(data)) porData.set(data, new Set())
    porData.get(data)!.add(numero)
  }

  const chamadas: Array<{ inicio: string; fim: string; numerosWvetro?: string[]; rotulo: string }> = inicioSolicitado
    ? [{ inicio: inicioSolicitado, fim: fimSolicitado, rotulo: `${inicioSolicitado} a ${fimSolicitado}` }]
    : [{ inicio: inicioRecenteYmd, fim: fimRecenteYmd, rotulo: 'recentes' }]
  // No fluxo normal preserva a conferência das datas antigas já vinculadas.
  // Na pesquisa histórica consulta somente a janela solicitada, sem repetir semanas anteriores.
  if (!inicioSolicitado) {
    for (const [data, numeros] of Array.from(porData.entries()).slice(0, 100)) {
      chamadas.push({ inicio: data, fim: data, numerosWvetro: Array.from(numeros), rotulo: data })
    }
  }

  let lidos = 0
  let criados = 0
  let atualizados = 0
  let semAlteracao = 0
  let ignoradosClienteDivergente = 0
  let bloqueadosOutroCliente = 0
  let revisoesHumanasPendentes = 0
  const falhas: Array<{ periodo: string; erro: string }> = []

  for (const chamada of chamadas) {
    const interna = new NextRequest(new URL('/api/integracoes/wvetro/orcamentos/sincronizar', req.nextUrl.origin), {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        inicio: chamada.inicio,
        fim: chamada.fim,
        ...(chamada.numerosWvetro ? { numerosWvetro: chamada.numerosWvetro } : {}),
        clienteAlvoId: clienteId,
        forcar: true,
        modo: 'corrigir_tudo',
      }),
    })
    const resposta = await sincronizar(interna, usuario, 7)
    const json = await resposta.json().catch(() => ({})) as Record<string, any>
    if (!resposta.ok) {
      falhas.push({ periodo: chamada.rotulo, erro: String(json.error || `Falha HTTP ${resposta.status}`) })
      continue
    }
    lidos += Number(json.lidos || 0)
    criados += Number(json.criados || 0)
    atualizados += Number(json.atualizados || 0)
    semAlteracao += Number(json.semAlteracao || 0)
    ignoradosClienteDivergente += Number(json.ignoradosClienteDivergente || 0)
    bloqueadosOutroCliente += (Array.isArray(json.resultados) ? json.resultados : []).filter((x: any) => x?.acao === 'bloqueado_outro_cliente').length
    revisoesHumanasPendentes += (Array.isArray(json.resultados) ? json.resultados : []).filter((x: any) => x?.acao === 'revisao_humana_necessaria').length
  }

  const { data: orcamentos, error: orcamentosError } = await supabaseAdmin
    .from('orcamentos')
    .select('id,numero,wvetro_fluxo,modo_entrada,created_at')
    .eq('empresa_id', usuario.empresa_id)
    .eq('cliente_id', clienteId)
    .contains('wvetro_fluxo', { origem: 'wvetro_api' })
    .neq('modo_entrada', 'wvetro_api_vinculado')
    .order('created_at', { ascending: false })

  if (orcamentosError) return NextResponse.json({ error: orcamentosError.message }, { status: 500 })

  const numerosWvetro = Array.from(new Set(
    (orcamentos || [])
      .map((o: any) => String(o?.wvetro_fluxo?.numero || '').trim())
      .filter(Boolean),
  ))

  return NextResponse.json({
    ok: falhas.length === 0,
    clienteId,
    periodoPesquisado: inicioSolicitado ? { inicio: inicioSolicitado, fim: fimSolicitado } : null,
    cliente: cliente.nome,
    historicos: historicosCompativeis.length,
    historicosIgnoradosNomeDivergente: historicosIgnorados,
    sincronizados: lidos,
    criados,
    atualizados,
    semAlteracao,
    ignoradosClienteDivergente,
    bloqueadosOutroCliente,
    revisoesHumanasPendentes,
    orcamentosDisponiveis: (orcamentos || []).length,
    numerosWvetro,
    falhas,
  }, { status: falhas.length === chamadas.length ? 502 : 200 })
}