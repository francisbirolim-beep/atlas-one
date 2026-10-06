import { NextRequest, NextResponse } from 'next/server'
import { autenticarUsuarioWVetro } from '@/lib/wvetroAcessoServer'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { sincronizar } from '../sincronizar/route'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function dataIso(v: unknown) {
  const s = String(v ?? '').trim()
  const m = s.match(/^(\d{4}-\d{2}-\d{2})/)
  return m ? m[1] : null
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
    .select('numero_wvetro,tipo_registro,data_emissao,data_venda,status_vinculo,somente_historico')
    .eq('cliente_id', clienteId)
    .eq('status_vinculo', 'seguro')
    .eq('somente_historico', true)
    .order('data_emissao', { ascending: false })
    .limit(200)

  if (historicoError) return NextResponse.json({ error: historicoError.message }, { status: 500 })

  const porData = new Map<string, Set<string>>()
  for (const h of historicos || []) {
    const numero = String((h as any).numero_wvetro || '').trim()
    const data = dataIso((h as any).tipo_registro === 'venda_historica_pedido'
      ? ((h as any).data_venda || (h as any).data_emissao)
      : ((h as any).data_emissao || (h as any).data_venda))
    if (!numero || !data) continue
    if (!porData.has(data)) porData.set(data, new Set())
    porData.get(data)!.add(numero)
  }

  if (porData.size === 0) {
    return NextResponse.json({
      ok: true,
      clienteId,
      cliente: cliente.nome,
      historicos: 0,
      sincronizados: 0,
      criados: 0,
      atualizados: 0,
      mensagem: 'Nenhum histórico W.Vetro com vínculo seguro foi encontrado para este cliente.',
    })
  }

  let lidos = 0
  let criados = 0
  let atualizados = 0
  let semAlteracao = 0
  const falhas: Array<{ data: string; erro: string }> = []

  for (const [data, numeros] of Array.from(porData.entries()).slice(0, 80)) {
    const interna = new NextRequest(new URL('/api/integracoes/wvetro/orcamentos/sincronizar', req.nextUrl.origin), {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        inicio: data,
        fim: data,
        numerosWvetro: Array.from(numeros),
        forcar: true,
        modo: 'corrigir_tudo',
      }),
    })
    const resposta = await sincronizar(interna, usuario, 1)
    const json = await resposta.json().catch(() => ({})) as Record<string, any>
    if (!resposta.ok) {
      falhas.push({ data, erro: String(json.error || `Falha HTTP ${resposta.status}`) })
      continue
    }
    lidos += Number(json.lidos || 0)
    criados += Number(json.criados || 0)
    atualizados += Number(json.atualizados || 0)
    semAlteracao += Number(json.semAlteracao || 0)
  }

  const { data: orcamentos, error: orcamentosError } = await supabaseAdmin
    .from('orcamentos')
    .select('id')
    .eq('empresa_id', usuario.empresa_id)
    .eq('cliente_id', clienteId)
    .or('modo_entrada.is.null,modo_entrada.neq.balcao')

  if (orcamentosError) return NextResponse.json({ error: orcamentosError.message }, { status: 500 })

  return NextResponse.json({
    ok: falhas.length === 0,
    clienteId,
    cliente: cliente.nome,
    historicos: (historicos || []).length,
    sincronizados: lidos,
    criados,
    atualizados,
    semAlteracao,
    orcamentosDisponiveis: (orcamentos || []).length,
    falhas,
  }, { status: falhas.length === porData.size ? 502 : 200 })
}
