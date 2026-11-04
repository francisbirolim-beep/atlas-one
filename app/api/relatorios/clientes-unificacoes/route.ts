import { NextRequest, NextResponse } from 'next/server'
import { autenticarTenant } from '@/lib/tenantServer'
import { podeUnificarClientes } from '@/lib/clienteUnificacaoAcessoServer'
import { supabaseAdmin as db } from '@/lib/supabaseAdmin'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
const resposta = (data: unknown, status = 200) =>
  NextResponse.json(data, { status, headers: { 'Cache-Control': 'private, no-store' } })

export async function GET(req: NextRequest) {
  const usuario = await autenticarTenant(req)
  if (!usuario) return resposta({ error: 'Sessão inválida.' }, 401)
  if (!await podeUnificarClientes(usuario)) return resposta({ error: 'Relatório restrito à gestão autorizada de clientes.' }, 403)
  const pagina = Math.max(0, Math.min(10000, Number(req.nextUrl.searchParams.get('pagina')) || 0))
  try {
    const { data, error, count } = await db.from('cliente_mesclagens')
      .select('id,cliente_origem_id,cliente_destino_id,cliente_origem_snapshot,cliente_destino_snapshot,mesclado_por_nome,mesclado_em,vinculos_movidos', { count: 'exact' })
      .eq('empresa_id', usuario.empresa_id)
      .order('mesclado_em', { ascending: false })
      .range(pagina * 100, pagina * 100 + 99)
    if (error) throw error
    const ids = Array.from(new Set((data || []).map(r => r.cliente_origem_id)))
    const motivos = new Map<string, string>()
    if (ids.length) {
      const r = await db.from('cadastros_status_auditoria')
        .select('registro_id,motivo,alterado_em').eq('empresa_id', usuario.empresa_id)
        .eq('cadastro', 'clientes').in('registro_id', ids)
        .order('alterado_em', { ascending: false }).limit(300)
      // Legado sem log de motivo continua visivel. Nao expor inativacoes desvinculadas.
      if (!r.error) for (const item of r.data || []) {
        if (typeof item.motivo === 'string' && item.motivo.startsWith('Unificado em ')
            && !motivos.has(item.registro_id)) motivos.set(item.registro_id, item.motivo)
      }
    }
    return resposta({ total: count || 0, pagina, registros: (data || []).map(r => ({
      id: r.id, origemId: r.cliente_origem_id, destinoId: r.cliente_destino_id,
      nomeOrigem: (r.cliente_origem_snapshot as any)?.nome || 'Cadastro não identificado',
      nomeDestino: (r.cliente_destino_snapshot as any)?.nome || 'Cadastro não identificado',
      data: r.mesclado_em, usuario: r.mesclado_por_nome || 'Não registrado',
      vinculos: r.vinculos_movidos, motivo: motivos.get(r.cliente_origem_id) || '',
    })) })
  } catch (e) {
    console.error('[Relatorio unificacoes clientes]', e)
    return resposta({ error: 'Não foi possível consultar o histórico de unificações.' }, 503)
  }
}
