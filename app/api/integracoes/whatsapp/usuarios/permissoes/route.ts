import { NextRequest, NextResponse } from 'next/server'
import { autenticarTenant } from '@/lib/tenantServer'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const usuario = await autenticarTenant(req)
  if (!usuario) return NextResponse.json({ error: 'Nao autenticado.' }, { status: 401 })
  if (usuario.role !== 'master') {
    return NextResponse.json({ error: 'Somente o Master pode configurar permissoes do WhatsApp.' }, { status: 403 })
  }

  const usuarioId = String(req.nextUrl.searchParams.get('usuarioId') || '')
  if (!usuarioId) {
    return NextResponse.json({ error: 'Usuario nao informado.' }, { status: 400 })
  }

  const { data: alvo, error: alvoError } = await supabaseAdmin
    .from('usuarios')
    .select('id,nome,role,empresa_id')
    .eq('id', usuarioId)
    .eq('empresa_id', usuario.empresa_id)
    .maybeSingle()

  if (alvoError) return NextResponse.json({ error: alvoError.message }, { status: 500 })
  if (!alvo) return NextResponse.json({ error: 'Usuario invalido.' }, { status: 404 })

  const [
    canaisResp,
    permissoesResp,
    gruposResp,
    grupoUsuarioResp,
    responsaveisResp,
  ] = await Promise.all([
    supabaseAdmin
      .from('atendimento_whatsapp_canais')
      .select('id,nome,numero_declarado,numero_conectado,principal,gateway_status,usuario_id,usuario_nome')
      .eq('empresa_id', usuario.empresa_id)
      .eq('ativo', true)
      .order('principal', { ascending: false })
      .order('nivel_hierarquia', { ascending: true })
      .order('nome'),
    supabaseAdmin
      .from('atendimento_whatsapp_permissoes')
      .select('id,canal_id,usuario_id,pode_visualizar,pode_atender,pode_transferir,pode_supervisionar')
      .eq('empresa_id', usuario.empresa_id)
      .eq('usuario_id', usuarioId),
    supabaseAdmin
      .from('atendimento_whatsapp_grupos')
      .select('id,whatsapp_canal_id,grupo_jid,nome,participantes,ativo,sincronizado_em')
      .eq('empresa_id', usuario.empresa_id)
      .eq('ativo', true)
      .order('nome'),
    supabaseAdmin
      .from('atendimento_whatsapp_grupo_permissoes')
      .select('id,grupo_id,usuario_id,nivel,responsavel_principal')
      .eq('empresa_id', usuario.empresa_id)
      .eq('usuario_id', usuarioId),
    supabaseAdmin
      .from('atendimento_whatsapp_grupo_permissoes')
      .select('grupo_id,usuario_id,nivel,responsavel_principal')
      .eq('empresa_id', usuario.empresa_id)
      .eq('responsavel_principal', true),
  ])

  const erro =
    canaisResp.error ||
    permissoesResp.error ||
    gruposResp.error ||
    grupoUsuarioResp.error ||
    responsaveisResp.error

  if (erro) return NextResponse.json({ error: erro.message }, { status: 500 })

  const responsavelIds = [...new Set((responsaveisResp.data || []).map((item: any) => item.usuario_id).filter(Boolean))]
  const nomes = new Map<string,string>()
  if (responsavelIds.length) {
    const { data: usuariosResponsaveis, error: nomesError } = await supabaseAdmin
      .from('usuarios')
      .select('id,nome')
      .eq('empresa_id', usuario.empresa_id)
      .in('id', responsavelIds)
    if (nomesError) return NextResponse.json({ error: nomesError.message }, { status: 500 })
    for (const item of usuariosResponsaveis || []) nomes.set(item.id, item.nome)
  }

  return NextResponse.json({
    ok: true,
    usuario: { id: alvo.id, nome: alvo.nome, role: alvo.role },
    canais: canaisResp.data || [],
    permissoes: permissoesResp.data || [],
    grupos: gruposResp.data || [],
    gruposPermissoes: grupoUsuarioResp.data || [],
    responsaveis: (responsaveisResp.data || []).map((item: any) => ({
      ...item,
      usuario_nome: nomes.get(item.usuario_id) || null,
    })),
  })
}
