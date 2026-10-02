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

  const [
    configResp,
    regrasResp,
    usuariosResp,
    gruposResp,
    gruposAutomacaoResp,
    canaisResp,
  ] = await Promise.all([
    supabaseAdmin
      .from('atendimento_configuracoes')
      .select('empresa_id,numero_principal,setor_padrao,usuario_padrao_id,ativo,modo_integracao,gateway_status,gateway_qr_data_url,gateway_qr_updated_at,gateway_connected_jid,gateway_last_seen_at,gateway_device_name')
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
    supabaseAdmin
      .from('atendimento_whatsapp_grupos')
      .select('id,whatsapp_canal_id,grupo_jid,nome,participantes,ativo,sincronizado_em')
      .eq('empresa_id', usuario.empresa_id)
      .eq('ativo', true)
      .order('nome'),
    supabaseAdmin
      .from('atendimento_whatsapp_grupo_automacoes')
      .select('id,grupo_id,tipo,responsavel_id,ativo,criar_rascunho,criar_tarefa,janela_agregacao_minutos')
      .eq('empresa_id', usuario.empresa_id)
      .eq('tipo', 'orcamento'),
    supabaseAdmin
      .from('atendimento_whatsapp_canais')
      .select('id,nome,numero_declarado,principal')
      .eq('empresa_id', usuario.empresa_id)
      .eq('ativo', true),
  ])

  const erro =
    configResp.error ||
    regrasResp.error ||
    usuariosResp.error ||
    gruposResp.error ||
    gruposAutomacaoResp.error ||
    canaisResp.error

  if (erro) {
    return NextResponse.json({ error: erro.message }, { status: 500 })
  }

  return NextResponse.json({
    ok: true,
    configuracao: configResp.data || null,
    regras: regrasResp.data || [],
    usuarios: usuariosResp.data || [],
    grupos: gruposResp.data || [],
    gruposAutomacao: gruposAutomacaoResp.data || [],
    canais: canaisResp.data || [],
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
        modo_integracao: 'qr',
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

    const gruposAutomacao = Array.isArray(body?.gruposAutomacao) ? body.gruposAutomacao : []
    const { data: gruposPermitidos, error: gruposPermitidosError } = await supabaseAdmin
      .from('atendimento_whatsapp_grupos')
      .select('id')
      .eq('empresa_id', usuario.empresa_id)
      .eq('ativo', true)
    if (gruposPermitidosError) throw gruposPermitidosError

    const idsPermitidos = new Set((gruposPermitidos || []).map(g => g.id))
    const { error: limparAutomacoesError } = await supabaseAdmin
      .from('atendimento_whatsapp_grupo_automacoes')
      .delete()
      .eq('empresa_id', usuario.empresa_id)
      .eq('tipo', 'orcamento')
    if (limparAutomacoesError) throw limparAutomacoesError

    const linhasAutomacao = gruposAutomacao
      .filter((item: any) => item?.ativo === true && idsPermitidos.has(String(item?.grupoId || '')))
      .map((item: any) => {
        const responsavelId = item?.responsavelId ? String(item.responsavelId) : null
        const janela = Number(item?.janelaAgregacaoMinutos || 5)
        return {
          empresa_id: usuario.empresa_id,
          grupo_id: String(item.grupoId),
          tipo: 'orcamento',
          responsavel_id: responsavelId,
          ativo: true,
          criar_rascunho: item?.criarRascunho !== false,
          criar_tarefa: item?.criarTarefa !== false && Boolean(responsavelId),
          janela_agregacao_minutos: Math.max(1, Math.min(120, Number.isFinite(janela) ? janela : 5)),
          created_by: usuario.id,
          updated_at: new Date().toISOString(),
        }
      })

    if (linhasAutomacao.length) {
      const { error: automacoesError } = await supabaseAdmin
        .from('atendimento_whatsapp_grupo_automacoes')
        .insert(linhasAutomacao)
      if (automacoesError) throw automacoesError
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    const mensagem = error instanceof Error ? error.message : 'Falha ao salvar configuracao.'
    return NextResponse.json({ error: mensagem }, { status: 400 })
  }
}