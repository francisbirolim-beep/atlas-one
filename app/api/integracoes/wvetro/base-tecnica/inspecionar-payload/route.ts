import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { listarOrcamentosWVetro, listarPedidosWVetro } from '@/lib/wvetroApi'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 30

// Endpoint de DIAGNÓSTICO temporário, só leitura. Não grava nada, não participa da
// carga histórica (PR #306) — só chama a API W.Vetro para UM dia e devolve as chaves
// brutas de um item de orçamento/pedido, para investigar se existem campos de
// variável (largura, altura, tipo de abertura etc.) que a extração atual não usa.
// Pode ser removido depois da investigação.

async function master(req: NextRequest) {
  const token = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '').trim()
  if (!token) return null
  const { data, error } = await supabaseAdmin.auth.getUser(token)
  if (error || !data?.user) return null
  const { data: usuario } = await supabaseAdmin.from('usuarios').select('id,nome,role').eq('id', data.user.id).maybeSingle()
  return usuario?.role === 'master' ? usuario : null
}

function achatarChaves(obj: unknown, prefixo = '', out: Set<string> = new Set()): Set<string> {
  if (Array.isArray(obj)) {
    obj.slice(0, 1).forEach(v => achatarChaves(v, `${prefixo}[]`, out))
    return out
  }
  if (obj && typeof obj === 'object') {
    for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
      const caminho = prefixo ? `${prefixo}.${k}` : k
      out.add(caminho)
      achatarChaves(v, caminho, out)
    }
  }
  return out
}

export async function GET(req: NextRequest) {
  if (!await master(req)) return NextResponse.json({ error: 'Área restrita ao Master.' }, { status: 403 })

  const { searchParams } = new URL(req.url)
  const data = searchParams.get('data')
  if (!data || !/^\d{4}-\d{2}-\d{2}$/.test(data)) {
    return NextResponse.json({ error: 'Informe ?data=AAAA-MM-DD com pelo menos um orçamento/pedido conhecido.' }, { status: 400 })
  }

  try {
    const [pedidos, orcamentos] = await Promise.all([
      listarPedidosWVetro<unknown>(data, data),
      listarOrcamentosWVetro<unknown>(data, data),
    ])

    return NextResponse.json({
      data,
      pedidos: {
        tipo: Array.isArray(pedidos) ? 'array' : typeof pedidos,
        tamanho: Array.isArray(pedidos) ? pedidos.length : null,
        chavesRaiz: pedidos && typeof pedidos === 'object' ? Object.keys(pedidos as object) : null,
        amostra: Array.isArray(pedidos) ? pedidos[0] ?? null : pedidos,
        chavesAchatadasDaAmostra: Array.from(achatarChaves(Array.isArray(pedidos) ? pedidos[0] : pedidos)).slice(0, 200),
      },
      orcamentos: {
        tipo: Array.isArray(orcamentos) ? 'array' : typeof orcamentos,
        tamanho: Array.isArray(orcamentos) ? orcamentos.length : null,
        chavesRaiz: orcamentos && typeof orcamentos === 'object' ? Object.keys(orcamentos as object) : null,
        amostra: Array.isArray(orcamentos) ? orcamentos[0] ?? null : orcamentos,
        chavesAchatadasDaAmostra: Array.from(achatarChaves(Array.isArray(orcamentos) ? orcamentos[0] : orcamentos)).slice(0, 200),
      },
    })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Falha ao consultar a API W.Vetro.' }, { status: 500 })
  }
}
