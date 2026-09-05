import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { gerarTokenAcessoAssistencia, hashTokenAcessoAssistencia } from '@/lib/assistenciaAcessoExternoServer'

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

  if (!data?.empresa_id) return null
  return data as UsuarioAcesso
}

async function podeGerenciarAssistencia(usuario: UsuarioAcesso, assistenciaId: string) {
  const { data: assistencia } = await supabaseAdmin
    .from('assistencias')
    .select('id, criado_por_id')
    .eq('empresa_id', usuario.empresa_id)
    .eq('id', assistenciaId)
    .maybeSingle()

  if (!assistencia) return { existe: false, permitido: false }
  if (usuario.role === 'master') return { existe: true, permitido: true }

  const { data: configRow } = await supabaseAdmin
    .from('configuracoes_gerais')
    .select('valor')
    .eq('empresa_id', usuario.empresa_id)
    .eq('chave', `home_usuario:${usuario.id}`)
    .maybeSingle()

  let podeVerTodas = false
  if (configRow?.valor) {
    try {
      const config = typeof configRow.valor === 'string' ? JSON.parse(configRow.valor) : configRow.valor
      podeVerTodas = config?.assistenciasEscopo === 'todas'
    } catch {
      podeVerTodas = false
    }
  }

  return {
    existe: true,
    permitido: podeVerTodas || assistencia.criado_por_id === usuario.id,
  }
}

async function validarEscopo(usuario: UsuarioAcesso, assistenciaId: string) {
  const acesso = await podeGerenciarAssistencia(usuario, assistenciaId)
  if (!acesso.existe) {
    return NextResponse.json({ error: 'Assistencia nao encontrada.' }, { status: 404 })
  }
  if (!acesso.permitido) {
    return NextResponse.json({ error: 'Sem permissao para esta assistencia.' }, { status: 403 })
  }
  return null
}

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const usuario = await usuarioAutenticado(req)
  if (!usuario) return NextResponse.json({ error: 'Nao autenticado' }, { status: 401 })
  const bloqueio = await validarEscopo(usuario, params.id)
  if (bloqueio) return bloqueio

  const { data, error } = await supabaseAdmin
    .from('assistencia_acessos_externos')
    .select('id, assistencia_id, nome_tecnico, telefone_tecnico, expira_em, revogado_em, primeiro_acesso_em, ultimo_acesso_em, criado_por_nome, created_at')
    .eq('assistencia_id', params.id)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: 'Nao foi possivel listar os links.' }, { status: 500 })
  return NextResponse.json({ acessos: data || [] })
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const usuario = await usuarioAutenticado(req)
  if (!usuario) return NextResponse.json({ error: 'Nao autenticado' }, { status: 401 })
  const bloqueio = await validarEscopo(usuario, params.id)
  if (bloqueio) return bloqueio

  const body = await req.json().catch(() => ({}))
  const nome = String(body?.nome || '').trim()
  const telefone = String(body?.telefone || '').trim() || null
  const diasBrutos = Number(body?.diasValidade || 7)
  const dias = Number.isFinite(diasBrutos) ? Math.min(30, Math.max(1, diasBrutos)) : 7

  if (!nome) return NextResponse.json({ error: 'Informe o nome do tecnico.' }, { status: 400 })

  const token = gerarTokenAcessoAssistencia()
  const tokenHash = hashTokenAcessoAssistencia(token)
  const expiraEm = new Date(Date.now() + dias * 24 * 60 * 60 * 1000).toISOString()

  const { data, error } = await supabaseAdmin
    .from('assistencia_acessos_externos')
    .insert({
      assistencia_id: params.id,
      token_hash: tokenHash,
      nome_tecnico: nome,
      telefone_tecnico: telefone,
      expira_em: expiraEm,
      criado_por_id: usuario.id,
      criado_por_nome: usuario.nome,
    })
    .select('id, nome_tecnico, telefone_tecnico, expira_em, created_at')
    .single()

  if (error || !data) {
    return NextResponse.json({ error: 'Nao foi possivel gerar o link.' }, { status: 500 })
  }

  return NextResponse.json({
    acesso: data,
    url: `${req.nextUrl.origin}/assistencia/acesso/${token}`,
  })
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const usuario = await usuarioAutenticado(req)
  if (!usuario) return NextResponse.json({ error: 'Nao autenticado' }, { status: 401 })
  const bloqueio = await validarEscopo(usuario, params.id)
  if (bloqueio) return bloqueio

  const body = await req.json().catch(() => ({}))
  const acessoId = String(body?.acessoId || '')
  if (!acessoId) return NextResponse.json({ error: 'Acesso nao informado.' }, { status: 400 })

  const { error } = await supabaseAdmin
    .from('assistencia_acessos_externos')
    .update({ revogado_em: new Date().toISOString() })
    .eq('id', acessoId)
    .eq('assistencia_id', params.id)

  if (error) return NextResponse.json({ error: 'Nao foi possivel revogar o link.' }, { status: 500 })
  return NextResponse.json({ ok: true })
}