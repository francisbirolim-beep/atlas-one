import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { processarBaseTecnicaWVetroDia, resumoBaseTecnicaWVetro } from '@/lib/wvetroBaseTecnicaServer'
import { autenticarMasterWVetro } from '@/lib/wvetroAcessoServer'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

async function execucaoPorId(id?: string | null) {
  let query = supabaseAdmin.from('wvetro_base_tecnica_execucoes').select('*')
  if (id) query = query.eq('id', id)
  const { data, error } = await query.order('created_at', { ascending: false }).limit(1).maybeSingle()
  if (error) throw error
  return data || null
}

async function pendenciasDaExecucao(execucaoId: string) {
  const [{ count: pendentes, error: e1 }, { count: resolvidas, error: e2 }, { data: proximas, error: e3 }] = await Promise.all([
    supabaseAdmin.from('wvetro_base_tecnica_pendencias').select('id', { count: 'exact', head: true }).eq('execucao_id', execucaoId).eq('status', 'pendente'),
    supabaseAdmin.from('wvetro_base_tecnica_pendencias').select('id', { count: 'exact', head: true }).eq('execucao_id', execucaoId).eq('status', 'resolvida'),
    supabaseAdmin.from('wvetro_base_tecnica_pendencias').select('id,data,erro,tentativas,status,resultado,atualizado_em').eq('execucao_id', execucaoId).eq('status', 'pendente').order('data', { ascending: true }).limit(20),
  ])
  if (e1) throw e1
  if (e2) throw e2
  if (e3) throw e3
  return { pendentes: pendentes || 0, resolvidas: resolvidas || 0, proximas: proximas || [] }
}

export async function GET(req: NextRequest) {
  if (!await autenticarMasterWVetro(req)) return NextResponse.json({ error: 'Acesso W.Vetro não autorizado para esta empresa.' }, { status: 403 })
  try {
    const execucaoId = req.nextUrl.searchParams.get('execucaoId')
    const execucao = await execucaoPorId(execucaoId)
    if (!execucao) return NextResponse.json({ error: 'Execução histórica não encontrada.' }, { status: 404 })
    return NextResponse.json({
      ok: true,
      execucao,
      pendencias: await pendenciasDaExecucao(execucao.id),
      resumo: await resumoBaseTecnicaWVetro(),
    })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Falha ao consultar pendências W.Vetro.' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  if (!await autenticarMasterWVetro(req)) return NextResponse.json({ error: 'Acesso W.Vetro não autorizado para esta empresa.' }, { status: 403 })
  let body: any = {}
  try { body = await req.json() } catch {}

  try {
    const execucaoId = String(body?.execucaoId || '')
    const dataAlvo = body?.data ? String(body.data) : ''
    if (!execucaoId) return NextResponse.json({ error: 'Execução não informada.' }, { status: 400 })

    const execucao = await execucaoPorId(execucaoId)
    if (!execucao || execucao.id !== execucaoId) return NextResponse.json({ error: 'Execução histórica não encontrada.' }, { status: 404 })

    let query = supabaseAdmin
      .from('wvetro_base_tecnica_pendencias')
      .select('*')
      .eq('execucao_id', execucaoId)
      .eq('status', 'pendente')
    if (dataAlvo) query = query.eq('data', dataAlvo)
    const { data: pendencia, error: erroBusca } = await query.order('data', { ascending: true }).limit(1).maybeSingle()
    if (erroBusca) throw erroBusca

    if (!pendencia) {
      const estado = await pendenciasDaExecucao(execucaoId)
      if (estado.pendentes === 0) {
        await supabaseAdmin.from('wvetro_base_tecnica_execucoes').update({
          dias_pendentes: 0,
          ultima_mensagem: 'Carga histórica concluída e todas as pendências foram reprocessadas.',
          updated_at: new Date().toISOString(),
        }).eq('id', execucaoId)
      }
      return NextResponse.json({ ok: true, concluida: true, pendencias: estado, resumo: await resumoBaseTecnicaWVetro() })
    }

    const tentativas = Number(pendencia.tentativas || 0) + 1
    const iniciadoEm = new Date().toISOString()
    const { error: erroMarca } = await supabaseAdmin.from('wvetro_base_tecnica_pendencias').update({
      tentativas,
      resultado: { reprocessamento_iniciado_em: iniciadoEm },
      atualizado_em: iniciadoEm,
    }).eq('id', pendencia.id).eq('status', 'pendente')
    if (erroMarca) throw erroMarca

    try {
      const resultado = await processarBaseTecnicaWVetroDia(String(pendencia.data))
      const resolvidoEm = new Date().toISOString()
      const { error: erroResolve } = await supabaseAdmin.from('wvetro_base_tecnica_pendencias').update({
        status: 'resolvida',
        resultado,
        resolvido_em: resolvidoEm,
        atualizado_em: resolvidoEm,
      }).eq('id', pendencia.id).eq('status', 'pendente')
      if (erroResolve) throw erroResolve

      const estado = await pendenciasDaExecucao(execucaoId)
      const { data: atualizada, error: erroExecucao } = await supabaseAdmin.from('wvetro_base_tecnica_execucoes').update({
        dias_pendentes: estado.pendentes,
        itens_processados: Number(execucao.itens_processados || 0) + Number(resultado.itens || 0),
        tipologias_processadas: Number(execucao.tipologias_processadas || 0) + Number(resultado.tipologias || 0),
        componentes_processados: Number(execucao.componentes_processados || 0) + Number(resultado.componentes || 0),
        ultima_mensagem: estado.pendentes === 0
          ? `${pendencia.data}: pendência resolvida. Todas as pendências foram reprocessadas.`
          : `${pendencia.data}: pendência resolvida. Restam ${estado.pendentes}.`,
        erro: null,
        updated_at: resolvidoEm,
      }).eq('id', execucaoId).select('*').single()
      if (erroExecucao) throw erroExecucao

      return NextResponse.json({
        ok: true,
        concluida: estado.pendentes === 0,
        resultado,
        data: pendencia.data,
        execucao: atualizada,
        pendencias: estado,
        resumo: await resumoBaseTecnicaWVetro(),
      })
    } catch (e) {
      const mensagem = e instanceof Error ? e.message : 'Falha ao reprocessar pendência.'
      await supabaseAdmin.from('wvetro_base_tecnica_pendencias').update({
        erro: mensagem,
        tentativas,
        resultado: { reprocessamento_falhou_em: new Date().toISOString() },
        atualizado_em: new Date().toISOString(),
      }).eq('id', pendencia.id)
      return NextResponse.json({ error: mensagem, data: pendencia.data, tentativas }, { status: 500 })
    }
  } catch (e) {
    console.error('Erro ao reprocessar pendências W.Vetro:', e)
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Falha ao reprocessar pendências W.Vetro.' }, { status: 500 })
  }
}
