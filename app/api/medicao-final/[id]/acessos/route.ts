import { NextRequest, NextResponse } from 'next/server'
import { randomBytes } from 'crypto'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { gerarTokenAcessoMedicao, hashTokenAcessoMedicao } from '@/lib/medicaoAcessoExternoServer'

async function usuarioAutenticado(req: NextRequest) {
  const auth = req.headers.get('authorization') || ''
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : ''
  if (!token) return null

  const { data: authData, error: authError } = await supabaseAdmin.auth.getUser(token)
  if (authError || !authData.user) return null

  const { data } = await supabaseAdmin
    .from('usuarios')
    .select('id, nome, role')
    .eq('id', authData.user.id)
    .maybeSingle()

  return data || null
}

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const usuario = await usuarioAutenticado(req)
  if (!usuario) return NextResponse.json({ error: 'Nao autenticado' }, { status: 401 })

  const { data, error } = await supabaseAdmin
    .from('medicao_acessos_externos')
    .select('id, medicao_id, nome_convidado, telefone_convidado, expira_em, revogado_em, primeiro_acesso_em, ultimo_acesso_em, criado_por_nome, created_at')
    .eq('medicao_id', params.id)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: 'Nao foi possivel listar os acessos.' }, { status: 500 })
  return NextResponse.json({ acessos: data || [] })
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const usuario = await usuarioAutenticado(req)
  if (!usuario) return NextResponse.json({ error: 'Nao autenticado' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const nome = String(body?.nome || '').trim()
  const telefone = String(body?.telefone || '').trim() || null
  const dias = Math.min(30, Math.max(1, Number(body?.diasValidade || 7)))

  if (!nome) return NextResponse.json({ error: 'Informe o nome de quem vai fazer a medicao.' }, { status: 400 })

  const { data: medicao } = await supabaseAdmin
    .from('medicoes_finais')
    .select('id, status_operacional')
    .eq('id', params.id)
    .maybeSingle()

  if (!medicao) return NextResponse.json({ error: 'Medicao nao encontrada.' }, { status: 404 })

  const token = gerarTokenAcessoMedicao()
  const tokenHash = hashTokenAcessoMedicao(token)
  const expiraEm = new Date(Date.now() + dias * 24 * 60 * 60 * 1000).toISOString()

  const { data, error } = await supabaseAdmin
    .from('medicao_acessos_externos')
    .insert({
      medicao_id: params.id,
      token_hash: tokenHash,
      nome_convidado: nome,
      telefone_convidado: telefone,
      expira_em: expiraEm,
      criado_por_id: usuario.id,
      criado_por_nome: usuario.nome,
    })
    .select('id, nome_convidado, telefone_convidado, expira_em, created_at')
    .single()

  if (error || !data) {
    return NextResponse.json({ error: 'Nao foi possivel gerar o link externo.' }, { status: 500 })
  }

  const baseUrl = req.nextUrl.origin
  return NextResponse.json({
    acesso: data,
    url: `${baseUrl}/medicao-final/acesso/${token}`,
  })
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const usuario = await usuarioAutenticado(req)
  if (!usuario) return NextResponse.json({ error: 'Nao autenticado' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const acessoId = String(body?.acessoId || '')
  if (!acessoId) return NextResponse.json({ error: 'Acesso nao informado.' }, { status: 400 })

  const { error } = await supabaseAdmin
    .from('medicao_acessos_externos')
    .update({ revogado_em: new Date().toISOString() })
    .eq('id', acessoId)
    .eq('medicao_id', params.id)

  if (error) return NextResponse.json({ error: 'Nao foi possivel revogar o acesso.' }, { status: 500 })
  return NextResponse.json({ ok: true })
}
