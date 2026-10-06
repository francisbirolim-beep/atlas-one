import { NextRequest, NextResponse } from 'next/server'
import { autenticarUsuarioWVetro } from '@/lib/wvetroAcessoServer'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { nomesClientesCompativeis } from '@/lib/wvetroClienteIdentidade'
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

  const body = await req.json().catch(() => ({})) as Record<string, unknown>
  const clienteId = String(body.clienteId || '').trim()
  if (!clienteId) return NextResponse.json({ error: 'Cliente não informado.' }, { status: 400 })

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

  const chamadas: Array<{ inicio: string; fim: string; numerosWvetro?: string[]; rotulo: string }> = [
    { inicio: inicioRecenteYmd, fim: fimRecenteYmd, rotulo: 'recentes' },
  ]
  for (const [data, numeros] of Array.from(porData.entries()).slice(0, 100)) {
    chamadas.push({ inicio: data, fim: data, numerosWvetro: Array.from(numeros), rotulo: data })
  }

  let lidos = 0
  let criados = 0
  let atualizados = 0
  let semAlteracao = 0
  let ignoradosClienteDivergente = 0
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
    cliente: cliente.nome,
    historicos: historicosCompativeis.length,
    historicosIgnoradosNomeDivergente: historicosIgnorados,
    sincronizados: lidos,
    criados,
    atualizados,
    semAlteracao,
    ignoradosClienteDivergente,
    orcamentosDisponiveis: (orcamentos || []).length,
    numerosWvetro,
    falhas,
  }, { status: falhas.length === chamadas.length ? 502 : 200 })
}
