import { createHash } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
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

const ONE_TIME_TOKEN_SHA256 = 'be2e29c943772a8acf8e8379805f09c19945927afacd6cede7d1d4b777448b5d'

function autorizado(req: NextRequest) {
  const token = String(req.nextUrl.searchParams.get('token') || '')
  if (!token) return false
  return createHash('sha256').update(token).digest('hex') === ONE_TIME_TOKEN_SHA256
}

function dataOk(v: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v + 'T12:00:00Z'))
}

function datas(inicio: string, fim: string) {
  const out: string[] = []
  const d = new Date(inicio + 'T12:00:00Z')
  const limite = new Date(fim + 'T12:00:00Z')
  while (d <= limite) {
    out.push(d.toISOString().slice(0, 10))
    d.setUTCDate(d.getUTCDate() + 1)
  }
  return out
}

export async function GET(req: NextRequest) {
  if (!autorizado(req)) return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 })

  const acao = String(req.nextUrl.searchParams.get('acao') || 'resumo')
  try {
    if (acao === 'imagens') {
      const lotes: any[] = []
      for (let i = 0; i < 4; i += 1) {
        const lote = await processarPendenciasImagensWVetro(30)
        lotes.push(lote)
        if (lote.processados === 0 || lote.restantes === 0) break
      }
      return NextResponse.json({
        ok: true,
        acao,
        lotes: lotes.length,
        processados: lotes.reduce((n, l) => n + Number(l.processados || 0), 0),
        copiadas: lotes.reduce((n, l) => n + Number(l.copiadas || 0), 0),
        preservadas: lotes.reduce((n, l) => n + Number(l.preservadas || 0), 0),
        erros: lotes.reduce((n, l) => n + Number(l.erros || 0), 0),
        restantes: lotes.length ? Number(lotes[lotes.length - 1].restantes || 0) : 0,
      })
    }

    if (acao === 'catalogos') {
      const linhas = await sincronizarLinhasApiWVetro()
      const [perfis, acessorios, esquadrias] = await Promise.all([
        descobrirEImportarCatalogoWVetro('P'),
        descobrirEImportarCatalogoWVetro('A'),
        sincronizarCatalogoEsquadriasWVetro(),
      ])
      const tipologias = await materializarReferenciasTipologiasWVetroPendentes()
      const mapeamento = await mapearReferenciasComponentesExatas()
      const custos = await sincronizarCustosProdutosWVetro()
      return NextResponse.json({
        ok: true, acao, linhas, catalogos: { perfis, acessorios, esquadrias },
        tipologias, mapeamento, custos, resumo: await resumoBaseTecnicaWVetro(),
      })
    }

    if (acao === 'periodo') {
      const inicio = String(req.nextUrl.searchParams.get('inicio') || '')
      const fim = String(req.nextUrl.searchParams.get('fim') || '')
      if (!dataOk(inicio) || !dataOk(fim) || inicio > fim || datas(inicio, fim).length > 7) {
        return NextResponse.json({ error: 'Período inválido; use no máximo 7 dias.' }, { status: 400 })
      }
      const resultados = []
      for (const data of datas(inicio, fim)) resultados.push(await processarBaseTecnicaWVetroDia(data))
      const tipologias = await materializarReferenciasTipologiasWVetroPendentes()
      return NextResponse.json({ ok: true, acao, inicio, fim, resultados, tipologias, resumo: await resumoBaseTecnicaWVetro() })
    }

    if (acao === 'pendencias-explicitas') {
      const datas = String(req.nextUrl.searchParams.get('datas') || '')
        .split(',')
        .map(v => v.trim())
        .filter(dataOk)
        .slice(0, 10)
      if (!datas.length) return NextResponse.json({ error: 'Informe ao menos uma data válida.' }, { status: 400 })

      const resultados: any[] = []
      for (const data of datas) {
        try {
          const resultado = await processarBaseTecnicaWVetroDia(data)
          const agora = new Date().toISOString()
          const { error: erroUpdate } = await supabaseAdmin
            .from('wvetro_base_tecnica_pendencias')
            .update({ status: 'resolvida', resultado, resolvido_em: agora, atualizado_em: agora })
            .eq('data', data)
            .eq('status', 'pendente')
          if (erroUpdate) throw erroUpdate
          resultados.push({ data, ok: true, resultado })
        } catch (e) {
          const mensagem = e instanceof Error ? e.message : 'Falha ao reprocessar.'
          await supabaseAdmin
            .from('wvetro_base_tecnica_pendencias')
            .update({ erro: mensagem, atualizado_em: new Date().toISOString() })
            .eq('data', data)
            .eq('status', 'pendente')
          resultados.push({ data, ok: false, erro: mensagem })
        }
      }

      const { count: restantes } = await supabaseAdmin
        .from('wvetro_base_tecnica_pendencias')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'pendente')

      await materializarReferenciasTipologiasWVetroPendentes()
      await mapearReferenciasComponentesExatas()
      await sincronizarCustosProdutosWVetro()
      return NextResponse.json({
        ok: true, acao, processadas: resultados.length, restantes: restantes || 0,
        resultados, resumo: await resumoBaseTecnicaWVetro(),
      })
    }

    if (acao === 'pendencias') {
      const limite = Math.min(7, Math.max(1, Number(req.nextUrl.searchParams.get('limite') || 3)))
      const { data: pendencias, error } = await supabaseAdmin
        .from('wvetro_base_tecnica_pendencias')
        .select('*')
        .eq('status', 'pendente')
        .order('data', { ascending: true })
        .limit(limite)
      if (error) throw error

      const resultados: any[] = []
      for (const p of pendencias || []) {
        const tentativas = Number(p.tentativas || 0) + 1
        try {
          const resultado = await processarBaseTecnicaWVetroDia(String(p.data))
          const agora = new Date().toISOString()
          const { error: erroUpdate } = await supabaseAdmin
            .from('wvetro_base_tecnica_pendencias')
            .update({ status: 'resolvida', resultado, tentativas, resolvido_em: agora, atualizado_em: agora })
            .eq('id', p.id)
            .eq('status', 'pendente')
          if (erroUpdate) throw erroUpdate
          resultados.push({ data: p.data, ok: true, resultado })
        } catch (e) {
          const mensagem = e instanceof Error ? e.message : 'Falha ao reprocessar.'
          await supabaseAdmin
            .from('wvetro_base_tecnica_pendencias')
            .update({ erro: mensagem, tentativas, atualizado_em: new Date().toISOString() })
            .eq('id', p.id)
          resultados.push({ data: p.data, ok: false, erro: mensagem })
        }
      }

      const { count: restantes } = await supabaseAdmin
        .from('wvetro_base_tecnica_pendencias')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'pendente')

      await materializarReferenciasTipologiasWVetroPendentes()
      await mapearReferenciasComponentesExatas()
      await sincronizarCustosProdutosWVetro()
      return NextResponse.json({
        ok: true, acao, processadas: resultados.length, restantes: restantes || 0,
        resultados, resumo: await resumoBaseTecnicaWVetro(),
      })
    }

    if (acao === 'consolidar') {
      const tipologias = await materializarReferenciasTipologiasWVetroPendentes()
      const mapeamento = await mapearReferenciasComponentesExatas()
      const custos = await sincronizarCustosProdutosWVetro()
      return NextResponse.json({ ok: true, acao, tipologias, mapeamento, custos, resumo: await resumoBaseTecnicaWVetro() })
    }

    return NextResponse.json({ ok: true, acao: 'resumo', resumo: await resumoBaseTecnicaWVetro() })
  } catch (e) {
    console.error('Refresh one-time W.Vetro:', e)
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Falha no refresh W.Vetro.' }, { status: 500 })
  }
}
