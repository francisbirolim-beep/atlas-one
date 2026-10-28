import { NextRequest, NextResponse } from 'next/server'
import { autenticarTenant } from '@/lib/tenantServer'
import { supabaseAdmin as db } from '@/lib/supabaseAdmin'
import { usuarioTemDelegacaoExplicitaServer } from '@/lib/acessoUsuarioServer'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
const setorId = 'fazer-orcamento-msanfyvj'
const acoes = {
  retirar: 'comercial.orcamento.retirar_card',
  restaurar: 'comercial.orcamento.restaurar_card',
} as const
const erro = (mensagem: string, status = 400) => NextResponse.json({ erro: mensagem }, { status, headers: { 'Cache-Control': 'no-store' } })
const uuid = (v: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v)

type Usuario = NonNullable<Awaited<ReturnType<typeof autenticarTenant>>>
async function permitido(u: Usuario, acao: 'retirar' | 'restaurar') {
  return usuarioTemDelegacaoExplicitaServer({
    usuarioId: u.id, role: u.role, empresaId: u.empresa_id,
    setorId, acaoId: acoes[acao],
  })
}

export async function GET(req: NextRequest) {
  const u = await autenticarTenant(req)
  if (!u) return erro('Sessão inválida.', 401)
  try {
    const [podeRetirar, podeRestaurar] = await Promise.all([permitido(u, 'retirar'), permitido(u, 'restaurar')])
    if (req.nextUrl.searchParams.get('retirados') !== '1') {
      return NextResponse.json({ podeRetirar, podeRestaurar }, { headers: { 'Cache-Control': 'no-store' } })
    }
    if (!podeRestaurar) return erro('Sem permissão para consultar cards retirados.', 403)
    const { data, error } = await db.from('orcamentos')
      .select('id,cliente_nome,coluna_id,kanban_retirado_em,kanban_retirado_motivo,kanban_retirado_por_id')
      .eq('empresa_id', u.empresa_id).not('kanban_retirado_em', 'is', null)
      .order('kanban_retirado_em', { ascending: false }).limit(100)
    if (error) throw error
    const ids=[...new Set((data || []).map(c=>c.kanban_retirado_por_id).filter((id):id is string=>!!id))]
    let nomes=new Map<string,string>()
    if(ids.length){
      const r=await db.from('usuarios').select('id,nome').eq('empresa_id',u.empresa_id).in('id',ids)
      if(r.error)throw r.error
      nomes=new Map((r.data||[]).map(p=>[p.id,p.nome]))
    }
    return NextResponse.json({ podeRetirar, podeRestaurar,
      retirados:(data||[]).map(c=>({...c,usuario_nome:nomes.get(c.kanban_retirado_por_id||'')||'Usuário registrado'}))
    }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (e) {
    console.error('[kanban comercial permissão]', e)
    return erro('Não foi possível validar as permissões dos cards.', 503)
  }
}

export async function POST(req: NextRequest) {
  const u = await autenticarTenant(req)
  if (!u) return erro('Sessão inválida.', 401)
  const b = await req.json().catch(() => null)
  const id = String(b?.id || '')
  const acao = b?.acao === 'retirar' ? 'retirar' : b?.acao === 'restaurar' ? 'restaurar' : null
  const motivo = String(b?.motivo || '').trim()
  if (!uuid(id) || !acao || motivo.length < 8 || motivo.length > 1000) return erro('Card, ação ou motivo inválido (mínimo de 8 caracteres).')
  try {
    if (!await permitido(u, acao)) return erro('Você não recebeu autorização do Master para esta ação.', 403)
    const { data, error } = await db.rpc('alterar_card_kanban_comercial_v1', {
      p_empresa: u.empresa_id, p_usuario: u.id, p_orcamento: id, p_acao: acao, p_motivo: motivo,
    })
    if (error) {
      console.error('[kanban comercial operação]', error)
      const esperado = /já retirado|não está retirado|não encontrado|vinculado|Vendido|autorização|não pode ser retirado/i.test(error.message)
      return erro(esperado ? error.message : 'A operação não foi concluída; nenhum card foi alterado.', esperado ? 409 : 503)
    }
    return NextResponse.json(data, { headers: { 'Cache-Control': 'no-store' } })
  } catch (e) {
    console.error('[kanban comercial retirada]', e)
    return erro('Não foi possível validar a operação. Nenhum card foi alterado.', 503)
  }
}
