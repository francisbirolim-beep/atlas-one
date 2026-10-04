import { NextRequest, NextResponse } from 'next/server'
import { autenticarTenant, type UsuarioTenant } from '@/lib/tenantServer'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

export const dynamic = 'force-dynamic'

const MODOS = new Set(['observando', 'sugerindo', 'automatico'])
const CLASSIFICACOES = new Set(['auto', 'empresa', 'pessoal'])

async function conversaAcessivel(usuario: UsuarioTenant, conversaId: string) {
  const { data: conversa } = await supabaseAdmin
    .from('atendimento_conversas')
    .select('id,empresa_id,whatsapp_canal_id')
    .eq('id', conversaId)
    .eq('empresa_id', usuario.empresa_id)
    .maybeSingle()
  if (!conversa) return null
  if (usuario.role === 'master') return conversa

  const { data: canal } = await supabaseAdmin
    .from('atendimento_whatsapp_canais')
    .select('id,principal,usuario_id,criado_por')
    .eq('id', conversa.whatsapp_canal_id)
    .eq('empresa_id', usuario.empresa_id)
    .maybeSingle()
  if (!canal) return null
  if (canal.principal || canal.usuario_id === usuario.id || canal.criado_por === usuario.id) return conversa

  const { data: permissao } = await supabaseAdmin
    .from('atendimento_whatsapp_permissoes')
    .select('pode_visualizar')
    .eq('empresa_id', usuario.empresa_id)
    .eq('canal_id', canal.id)
    .eq('usuario_id', usuario.id)
    .eq('pode_visualizar', true)
    .maybeSingle()
  return permissao ? conversa : null
}

async function configOuPadrao(empresaId: string) {
  const { data, error } = await supabaseAdmin
    .from('atendimento_whatsapp_ia_config')
    .select('*')
    .eq('empresa_id', empresaId)
    .maybeSingle()
  if (error) throw error
  return data || {
    empresa_id: empresaId,
    modo: 'observando',
    ativo: true,
    aprender_todos_canais: true,
    classificar_canal_pessoal: true,
    exigir_validacao_conhecimento: true,
    confianca_minima_sugestao: 0.70,
    confianca_minima_automatico: 0.92,
  }
}

export async function GET(req: NextRequest) {
  const usuario = await autenticarTenant(req)
  if (!usuario) return NextResponse.json({ error: 'Nao autenticado.' }, { status: 401 })

  try {
    const conversaId = String(req.nextUrl.searchParams.get('conversaId') || '').trim()
    if (conversaId) {
      const conversa = await conversaAcessivel(usuario, conversaId)
      if (!conversa) return NextResponse.json({ error: 'Conversa nao disponivel.' }, { status: 403 })

      const [{ data: sugestao }, config] = await Promise.all([
        supabaseAdmin
          .from('atendimento_whatsapp_ia_sugestoes')
          .select('id,texto,setor,confianca,status,created_at')
          .eq('empresa_id', usuario.empresa_id)
          .eq('conversa_id', conversaId)
          .eq('status', 'pendente')
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle(),
        configOuPadrao(usuario.empresa_id),
      ])
      return NextResponse.json({ ok: true, sugestao: sugestao || null, modo: config.modo })
    }

    if (usuario.role !== 'master') {
      return NextResponse.json({ error: 'Acesso restrito ao Master.' }, { status: 403 })
    }

    const config = await configOuPadrao(usuario.empresa_id)
    const [
      canaisResp,
      canaisIaResp,
      observacoesResp,
      empresaCount,
      pessoalCount,
      duvidaCount,
      pendentesCount,
      usadasCount,
      rejeitadasCount,
      automaticasCount,
      candidatosCount,
    ] = await Promise.all([
      supabaseAdmin.from('atendimento_whatsapp_canais')
        .select('id,nome,numero_declarado,numero_conectado,tipo_conta,principal,usuario_id,usuario_nome,gateway_status')
        .eq('empresa_id', usuario.empresa_id).eq('ativo', true)
        .order('principal', { ascending: false }).order('created_at'),
      supabaseAdmin.from('atendimento_whatsapp_ia_canais')
        .select('*').eq('empresa_id', usuario.empresa_id),
      supabaseAdmin.from('atendimento_whatsapp_ia_observacoes')
        .select('id,canal_id,conversa_id,mensagem_id,classe,setor,confianca,aprendizado_resumo,motivo,entrada_aprendizado_id,candidato_aprendizado_id,created_at')
        .eq('empresa_id', usuario.empresa_id)
        .order('created_at', { ascending: false }).limit(60),
      supabaseAdmin.from('atendimento_whatsapp_ia_observacoes').select('id', { count: 'exact', head: true }).eq('empresa_id', usuario.empresa_id).eq('classe', 'empresa'),
      supabaseAdmin.from('atendimento_whatsapp_ia_observacoes').select('id', { count: 'exact', head: true }).eq('empresa_id', usuario.empresa_id).eq('classe', 'pessoal'),
      supabaseAdmin.from('atendimento_whatsapp_ia_observacoes').select('id', { count: 'exact', head: true }).eq('empresa_id', usuario.empresa_id).eq('classe', 'duvida'),
      supabaseAdmin.from('atendimento_whatsapp_ia_sugestoes').select('id', { count: 'exact', head: true }).eq('empresa_id', usuario.empresa_id).eq('status', 'pendente'),
      supabaseAdmin.from('atendimento_whatsapp_ia_sugestoes').select('id', { count: 'exact', head: true }).eq('empresa_id', usuario.empresa_id).in('status', ['usada','editada']),
      supabaseAdmin.from('atendimento_whatsapp_ia_sugestoes').select('id', { count: 'exact', head: true }).eq('empresa_id', usuario.empresa_id).eq('status', 'rejeitada'),
      supabaseAdmin.from('atendimento_whatsapp_ia_sugestoes').select('id', { count: 'exact', head: true }).eq('empresa_id', usuario.empresa_id).eq('status', 'enviada_automaticamente'),
      supabaseAdmin.from('ai_aprendizado_candidatos').select('id', { count: 'exact', head: true })
        .eq('empresa_id', usuario.empresa_id).eq('tipo', 'conhecimento').in('status', ['pendente','corrigido']),
    ])

    const erro = canaisResp.error || canaisIaResp.error || observacoesResp.error
    if (erro) throw erro

    const nomes = new Map((canaisResp.data || []).map((c: any) => [c.id, c.nome]))
    const observacoes = (observacoesResp.data || []).map((o: any) => ({
      ...o,
      canal_nome: nomes.get(o.canal_id) || 'WhatsApp',
    }))

    return NextResponse.json({
      ok: true,
      configuracao: config,
      canais: canaisResp.data || [],
      canaisIA: canaisIaResp.data || [],
      observacoes,
      metricas: {
        empresa: empresaCount.count || 0,
        pessoal: pessoalCount.count || 0,
        duvida: duvidaCount.count || 0,
        sugestoes_pendentes: pendentesCount.count || 0,
        sugestoes_usadas: usadasCount.count || 0,
        sugestoes_rejeitadas: rejeitadasCount.count || 0,
        respostas_automaticas: automaticasCount.count || 0,
        conhecimentos_pendentes: candidatosCount.count || 0,
      },
    })
  } catch (error) {
    console.error('Erro na configuracao da IA WhatsApp:', error)
    const mensagem = error instanceof Error ? error.message : 'Falha ao carregar IA do WhatsApp.'
    return NextResponse.json({ error: mensagem }, { status: 500 })
  }
}

export async function PUT(req: NextRequest) {
  const usuario = await autenticarTenant(req)
  if (!usuario) return NextResponse.json({ error: 'Nao autenticado.' }, { status: 401 })
  if (usuario.role !== 'master') return NextResponse.json({ error: 'Acesso restrito ao Master.' }, { status: 403 })

  try {
    const body = await req.json()
    const modo = String(body?.modo || 'observando')
    if (!MODOS.has(modo)) return NextResponse.json({ error: 'Modo de IA invalido.' }, { status: 400 })
    if (modo === 'automatico' && body?.confirmarAutomatico !== true) {
      return NextResponse.json({ error: 'Confirme explicitamente a ativacao do atendimento automatico.' }, { status: 400 })
    }

    const minSugestao = Math.max(0, Math.min(1, Number(body?.confiancaMinimaSugestao ?? 0.70)))
    const minAutomatico = Math.max(0, Math.min(1, Number(body?.confiancaMinimaAutomatico ?? 0.92)))
    const agora = new Date().toISOString()

    const { error: configError } = await supabaseAdmin
      .from('atendimento_whatsapp_ia_config')
      .upsert({
        empresa_id: usuario.empresa_id,
        modo,
        ativo: body?.ativo !== false,
        aprender_todos_canais: body?.aprenderTodosCanais !== false,
        classificar_canal_pessoal: body?.classificarCanalPessoal !== false,
        exigir_validacao_conhecimento: true,
        confianca_minima_sugestao: minSugestao,
        confianca_minima_automatico: minAutomatico,
        atualizado_por_id: usuario.id,
        atualizado_por_nome: usuario.nome,
        updated_at: agora,
      }, { onConflict: 'empresa_id' })
    if (configError) throw configError

    const canais = Array.isArray(body?.canais) ? body.canais : []
    if (canais.length) {
      const ids = canais.map((c: any) => String(c?.canalId || '')).filter(Boolean)
      const { data: validos, error: canaisError } = await supabaseAdmin
        .from('atendimento_whatsapp_canais')
        .select('id')
        .eq('empresa_id', usuario.empresa_id)
        .in('id', ids)
      if (canaisError) throw canaisError
      const permitidos = new Set((validos || []).map((c: any) => c.id))
      const rows = canais
        .filter((c: any) => permitidos.has(String(c?.canalId || '')))
        .map((c: any) => ({
          empresa_id: usuario.empresa_id,
          canal_id: String(c.canalId),
          aprender: c.aprender !== false,
          classificacao: CLASSIFICACOES.has(String(c.classificacao)) ? String(c.classificacao) : 'auto',
          setor_padrao: c.setorPadrao ? String(c.setorPadrao) : null,
          permitir_sugestoes: c.permitirSugestoes !== false,
          permitir_automatico: c.permitirAutomatico === true,
          updated_at: agora,
        }))
      if (rows.length) {
        const { error } = await supabaseAdmin
          .from('atendimento_whatsapp_ia_canais')
          .upsert(rows, { onConflict: 'empresa_id,canal_id' })
        if (error) throw error
      }
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    const mensagem = error instanceof Error ? error.message : 'Falha ao salvar IA do WhatsApp.'
    return NextResponse.json({ error: mensagem }, { status: 400 })
  }
}

export async function POST(req: NextRequest) {
  const usuario = await autenticarTenant(req)
  if (!usuario) return NextResponse.json({ error: 'Nao autenticado.' }, { status: 401 })

  try {
    const body = await req.json()
    const sugestaoId = String(body?.sugestaoId || '')
    const acao = String(body?.acao || '')
    if (!sugestaoId || !['usar','rejeitar'].includes(acao)) {
      return NextResponse.json({ error: 'Acao invalida.' }, { status: 400 })
    }

    const { data: sugestao } = await supabaseAdmin
      .from('atendimento_whatsapp_ia_sugestoes')
      .select('id,conversa_id,status')
      .eq('id', sugestaoId)
      .eq('empresa_id', usuario.empresa_id)
      .maybeSingle()
    if (!sugestao) return NextResponse.json({ error: 'Sugestao nao encontrada.' }, { status: 404 })

    const conversa = await conversaAcessivel(usuario, sugestao.conversa_id)
    if (!conversa) return NextResponse.json({ error: 'Conversa nao disponivel.' }, { status: 403 })
    if (sugestao.status !== 'pendente') return NextResponse.json({ ok: true })

    const agora = new Date().toISOString()
    const { error } = await supabaseAdmin.from('atendimento_whatsapp_ia_sugestoes').update({
      status: acao === 'usar' ? 'usada' : 'rejeitada',
      usuario_id: usuario.id,
      usuario_nome: usuario.nome,
      decidido_em: agora,
      updated_at: agora,
    }).eq('id', sugestaoId).eq('empresa_id', usuario.empresa_id)
    if (error) throw error

    return NextResponse.json({ ok: true })
  } catch (error) {
    const mensagem = error instanceof Error ? error.message : 'Falha ao atualizar sugestao.'
    return NextResponse.json({ error: mensagem }, { status: 400 })
  }
}