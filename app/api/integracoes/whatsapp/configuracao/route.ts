import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { autenticarTenant } from '@/lib/tenantServer'

export const dynamic = 'force-dynamic'

async function autenticarMaster(req: NextRequest) {
  const usuario = await autenticarTenant(req)
  return usuario?.role === 'master' ? usuario : null
}

export async function GET(req: NextRequest) {
  const usuario = await autenticarMaster(req)
  if (!usuario) {
    return NextResponse.json({ error: 'Acesso restrito ao Master.' }, { status: 403 })
  }

  const [configResp, regrasResp, usuariosResp] = await Promise.all([
    supabaseAdmin
      .from('atendimento_configuracoes')
      .select('*')
      .eq('empresa_id', usuario.empresa_id)
      .maybeSingle(),
    supabaseAdmin
      .from('atendimento_regras_roteamento')
      .select('*')
      .eq('empresa_id', usuario.empresa_id)
      .order('prioridade'),
    supabaseAdmin
      .from('usuarios')
      .select('id,nome')
      .eq('empresa_id', usuario.empresa_id)
      .order('nome'),
  ])
  const erro = configResp.error || regrasResp.error || usuariosResp.error
  if (erro) {
    return NextResponse.json({ error: erro.message }, { status: 500 })
  }

  return NextResponse.json({
    ok: true,
    configuracao: configResp.data || null,
    regras: regrasResp.data || [],
    usuarios: usuariosResp.data || [],
  })
}

export async function PUT(req: NextRequest) {
  const usuario = await autenticarMaster(req)
  if (!usuario) {
    return NextResponse.json({ error: 'Acesso restrito ao Master.' }, { status: 403 })
  }

  try {
    const body = await req.json()
    const numeroPrincipal = String(
      body?.numeroPrincipal ||
      process.env.WHATSAPP_BUSINESS_PHONE_E164 ||
      '5517996355667',
    ).replace(/\D/g, '')

    const { error: configError } = await supabaseAdmin
      .from('atendimento_configuracoes')
      .upsert({
        empresa_id: usuario.empresa_id,
        numero_principal: numeroPrincipal,
        setor_padrao: body?.setorPadrao ? String(body.setorPadrao) : null,
        usuario_padrao_id: body?.usuarioPadraoId || null,
        ativo: body?.ativo !== false,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'empresa_id' })

    if (configError) throw configError

    const regras = Array.isArray(body?.regras) ? body.regras : []
    const { error: deleteError } = await supabaseAdmin
      .from('atendimento_regras_roteamento')
      .delete()
      .eq('empresa_id', usuario.empresa_id)
    if (deleteError) throw deleteError

    if (regras.length) {
      const linhas = regras
        .filter((r: any) => String(r?.nome || '').trim())
        .map((r: any, indice: number) => ({
          empresa_id: usuario.empresa_id,
          nome: String(r.nome).trim().slice(0, 120),
          prioridade: Number.isFinite(Number(r.prioridade)) ? Number(r.prioridade) : (indice + 1) * 10,
          palavras_chave: Array.isArray(r.palavrasChave)
            ? r.palavrasChave.map((p: unknown) => String(p).trim()).filter(Boolean)
            : String(r.palavrasChave || '').split(',').map((p: string) => p.trim()).filter(Boolean),
          setor: r?.setor ? String(r.setor).trim() : null,
          usuario_id: r?.usuarioId || null,
          ativo: r?.ativo !== false,
        }))

      const { error: regrasError } = await supabaseAdmin
        .from('atendimento_regras_roteamento')
        .insert(linhas)
      if (regrasError) throw regrasError
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    const mensagem = error instanceof Error ? error.message : 'Falha ao salvar configuracao.'
    return NextResponse.json({ error: mensagem }, { status: 400 })
  }
}