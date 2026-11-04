import { NextRequest, NextResponse } from 'next/server'
import { autenticarTenant } from '@/lib/tenantServer'
import { supabaseAdmin as db } from '@/lib/supabaseAdmin'
import { usuarioTemDelegacaoExplicitaServer } from '@/lib/acessoUsuarioServer'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const setorId = 'fazer-orcamento-msanfyvj'
const acaoId = 'comercial.orcamento.corrigir_data_venda'
const uuid = (v: unknown): v is string =>
  typeof v === 'string' && /^[a-f\d]{8}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{12}$/i.test(v)
const erro = (message: string, status = 400) =>
  NextResponse.json({ error: message }, { status, headers: { 'Cache-Control': 'no-store' } })

function dataYmdValida(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const [ano, mes, dia] = value.split('-').map(Number)
  const d = new Date(Date.UTC(ano, mes - 1, dia))
  return d.getUTCFullYear() === ano && d.getUTCMonth() + 1 === mes && d.getUTCDate() === dia
}

export async function POST(req: NextRequest) {
  const usuario = await autenticarTenant(req)
  if (!usuario) return erro('Sessão inválida.', 401)
  const corpo = await req.json().catch(() => null)
  const id = corpo?.id
  const dataVenda = corpo?.data_venda
  const dataEsperada = corpo?.data_anterior
  const motivo = typeof corpo?.motivo === 'string' ? corpo.motivo.trim() : ''
  if (!uuid(id) || !dataYmdValida(dataVenda) || !dataYmdValida(dataEsperada) || motivo.length < 8 || motivo.length > 1000) {
    return erro('Informe o card, uma data válida e o motivo da correção (8 a 1000 caracteres).')
  }

  try {
    const autorizado = await usuarioTemDelegacaoExplicitaServer({
      usuarioId: usuario.id, role: usuario.role, empresaId: usuario.empresa_id,
      setorId, acaoId,
    })
    if (!autorizado) return erro('Somente o Master ou usuário autorizado pode corrigir a data de venda.', 403)
    const { data, error } = await db.rpc('corrigir_data_venda_kanban_comercial_v1', {
      p_empresa: usuario.empresa_id,
      p_usuario: usuario.id,
      p_orcamento: id,
      p_data: dataVenda,
      p_motivo: motivo,
      p_data_esperada: dataEsperada,
    })
    if (error) {
      console.error('[data de venda kanban]', { code: error.code, message: error.message })
      const esperado = /data|motivo|igual|card|coluna|venda|autoriz|orçamento|usuário|retirado|correção/i.test(error.message)
      return erro(esperado ? error.message : 'Não foi possível corrigir a data. Nenhum registro foi alterado.', esperado ? 409 : 503)
    }
    return NextResponse.json(data, { headers: { 'Cache-Control': 'no-store' } })
  } catch (e) {
    console.error('[data de venda kanban] falha', e)
    return erro('Não foi possível validar esta alteração. Nenhum registro foi alterado.', 503)
  }
}
