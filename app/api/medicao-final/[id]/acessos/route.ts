import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { gerarTokenAcessoMedicao, hashTokenAcessoMedicao } from '@/lib/medicaoAcessoExternoServer'

type UsuarioAcesso = { id: string; nome: string; role: string; empresa_id: string }

async function usuarioAutenticado(req: NextRequest): Promise<UsuarioAcesso | null> {
  const auth = req.headers.get('authorization') || ''
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : ''
  if (!token) return null

  const { data: authData, error: authError } = await supabaseAdmin.auth.getUser(token)
  if (authError || !authData.user) return null

  const { data } = await supabaseAdmin
    .from('usuarios')
    .select('id, nome, role, empresa_id')
    .eq('id', authData.user.id)
    .maybeSingle()

  return data?.empresa_id ? data as UsuarioAcesso : null
}

async function nivelAcessoMedicao(usuario: UsuarioAcesso): Promise<'oculto' | 'consulta' | 'edicao'> {
  if (usuario.role === 'master') return 'edicao'

  const { data: setor } = await supabaseAdmin
    .from('setores')
    .select('id')
    .eq('rota', '/producao/medicao-final')
    .eq('ativo', true)
    .maybeSingle()

  if (!setor) return 'oculto'

  const { data: permissao } = await supabaseAdmin
    .from('permissoes')
    .select('nivel')
    .eq('usuario_id', usuario.id)
    .eq('setor_id', setor.id)
    .maybeSingle()

  return (permissao?.nivel as 'oculto' | 'consulta' | 'edicao' | undefined) || 'oculto'
}

async function medicaoDaEmpresa(id: string, empresaId: string) {
  const { data } = await supabaseAdmin
    .from('medicoes_finais')
    .select('id, status_operacional')
    .eq('id', id)
    .eq('empresa_id', empresaId)
    .maybeSingle()
  return data || null
}

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const usuario = await usuarioAutenticado(req)
  if (!usuario) return NextResponse.json({ error: 'Nao autenticado' }, { status: 401 })
  const nivel = await nivelAcessoMedicao(usuario)
  if (nivel === 'oculto') return NextResponse.json({ error: 'Sem permissao para acessar a Medicao Final.' }, { status: 403 })
  if (!await medicaoDaEmpresa(params.id, usuario.empresa_id)) return NextResponse.json({ error: 'Medicao nao encontrada.' }, { status: 404 })

  const { data, error } = await supabaseAdmin
    .from('medicao_acessos_externos')
    .select('id, medicao_id, nome_convidado, telefone_convidado, expira_em, revogado_em, primeiro_acesso_em, ultimo_acesso_em, criado_por_nome, created_at')
    .eq('empresa_id', usuario.empresa_id)
    .eq('medicao_id', params.id)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: 'Nao foi possivel listar os acessos.' }, { status: 500 })
  return NextResponse.json({ acessos: data || [], podeEditar: nivel === 'edicao' })
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const usuario = await usuarioAutenticado(req)
  if (!usuario) return NextResponse.json({ error: 'Nao autenticado' }, { status: 401 })
  if (await nivelAcessoMedicao(usuario) !== 'edicao') {
    return NextResponse.json({ error: 'Voce nao tem permissao de edicao para gerar links de Medicao Final.' }, { status: 403 })
  }

  const body = await req.json().catch(() => ({}))
  const nome = String(body?.nome || '').trim()
  const telefone = String(body?.telefone || '').trim() || null
  const diasBrutos = Number(body?.diasValidade || 7)
  const dias = Number.isFinite(diasBrutos) ? Math.min(30, Math.max(1, diasBrutos)) : 7

  if (!nome) return NextResponse.json({ error: 'Informe o nome de quem vai fazer a medicao.' }, { status: 400 })

  const medicao = await medicaoDaEmpresa(params.id, usuario.empresa_id)
  if (!medicao) return NextResponse.json({ error: 'Medicao nao encontrada.' }, { status: 404 })
  if (!['liberado', 'em_medicao', 'com_pendencia'].includes(medicao.status_operacional || '')) {
    return NextResponse.json({ error: 'Libere a Medicao Final antes de gerar um link externo.' }, { status: 409 })
  }

  const token = gerarTokenAcessoMedicao()
  const tokenHash = hashTokenAcessoMedicao(token)
  const expiraEm = new Date(Date.now() + dias * 24 * 60 * 60 * 1000).toISOString()

  const { data, error } = await supabaseAdmin
    .from('medicao_acessos_externos')
    .insert({
      empresa_id: usuario.empresa_id,
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

  return NextResponse.json({ acesso: data, url: `${req.nextUrl.origin}/medicao-final/acesso/${token}` })
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const usuario = await usuarioAutenticado(req)
  if (!usuario) return NextResponse.json({ error: 'Nao autenticado' }, { status: 401 })
  if (await nivelAcessoMedicao(usuario) !== 'edicao') {
    return NextResponse.json({ error: 'Voce nao tem permissao de edicao para revogar links de Medicao Final.' }, { status: 403 })
  }
  if (!await medicaoDaEmpresa(params.id, usuario.empresa_id)) return NextResponse.json({ error: 'Medicao nao encontrada.' }, { status: 404 })

  const body = await req.json().catch(() => ({}))
  const acessoId = String(body?.acessoId || '')
  if (!acessoId) return NextResponse.json({ error: 'Acesso nao informado.' }, { status: 400 })

  const { error } = await supabaseAdmin
    .from('medicao_acessos_externos')
    .update({ revogado_em: new Date().toISOString() })
    .eq('id', acessoId)
    .eq('empresa_id', usuario.empresa_id)
    .eq('medicao_id', params.id)

  if (error) return NextResponse.json({ error: 'Nao foi possivel revogar o acesso.' }, { status: 500 })
  return NextResponse.json({ ok: true })
}
