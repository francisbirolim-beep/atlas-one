import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { autenticarTenant } from '@/lib/tenantServer'
import {
  assumirConversa,
  definirAcompanhamentoConversa,
  finalizarConversa,
  listarAcessosCanaisAtendimento,
  listarConversasAtendimento,
  marcarConversaComoLida,
  registrarVisualizacaoConversa,
  transferirConversa,
} from '@/lib/whatsappServer'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const usuario = await autenticarTenant(req)
  if (!usuario) {
    return NextResponse.json({ error: 'Nao autenticado.' }, { status: 401 })
  }
  try {
    const [conversas, acessos] = await Promise.all([
      listarConversasAtendimento(usuario),
      listarAcessosCanaisAtendimento(usuario),
    ])
    const podeTransferir = usuario.role === 'master' ||
      acessos.some(a => a.transferir) ||
      (conversas as any[]).some(c => c.grupo_pode_transferir || c.grupo_pode_delegar)
    let usuarios: { id: string; nome: string }[] = []

    if (podeTransferir) {
      const { data } = await supabaseAdmin
        .from('usuarios')
        .select('id,nome')
        .eq('empresa_id', usuario.empresa_id)
        .order('nome')
      usuarios = (data || []) as { id: string; nome: string }[]
    }

    const { data: config } = await supabaseAdmin
      .from('atendimento_configuracoes')
      .select('numero_principal,setor_padrao,usuario_padrao_id,ativo,modo_integracao')
      .eq('empresa_id', usuario.empresa_id)
      .maybeSingle()

    const { data: canaisRaw } = await supabaseAdmin
      .from('atendimento_whatsapp_canais')
      .select('id,nome,numero_declarado,numero_conectado,tipo_conta,principal,usuario_id,usuario_nome,ativo,gateway_status,gateway_last_seen_at')
      .eq('empresa_id', usuario.empresa_id)
      .eq('ativo', true)
      .eq('gateway_status', 'connected')
      .order('principal', { ascending: false })
      .order('created_at', { ascending: true })

    const canaisPermitidos = new Set(acessos.map(acesso => acesso.canal_id))
    const canais = (canaisRaw || []).filter((canal: any) =>
      usuario.role === 'master' || canaisPermitidos.has(canal.id)
    )
    const conectados = canais.length

    return NextResponse.json({
      ok: true,
      usuario: { id: usuario.id, nome: usuario.nome, role: usuario.role },
      conversas,
      usuarios,
      canais,
      acessos,
      configuracao: config || null,
      canaisConectados: conectados,
      canaisTotal: conectados,
    })
  } catch (error) {
    console.error('Erro ao listar conversas WhatsApp:', error)
    return NextResponse.json(
      { error: 'Nao foi possivel carregar o atendimento.' },
      { status: 500 },
    )
  }
}

export async function POST(req: NextRequest) {
  const usuario = await autenticarTenant(req)
  if (!usuario) {
    return NextResponse.json({ error: 'Nao autenticado.' }, { status: 401 })
  }
  try {
    const body = await req.json()
    const conversaId = String(body?.conversaId || '')
    const acao = String(body?.acao || '')

    if (!conversaId) {
      return NextResponse.json({ error: 'Conversa nao informada.' }, { status: 400 })
    }

    if (acao === 'assumir') {
      await assumirConversa(conversaId, usuario)
    } else if (acao === 'visualizar') {
      await registrarVisualizacaoConversa(conversaId, usuario)
    } else if (acao === 'marcar_lida') {
      await marcarConversaComoLida(conversaId, usuario)
    } else if (acao === 'acompanhar') {
      await definirAcompanhamentoConversa(conversaId, true, usuario)
    } else if (acao === 'parar_acompanhar') {
      await definirAcompanhamentoConversa(conversaId, false, usuario)
    } else if (acao === 'transferir') {
      await transferirConversa(
        conversaId,
        String(body?.destinoId || ''),
        body?.setor ? String(body.setor) : null,
        usuario,
      )
    } else if (acao === 'finalizar') {
      await finalizarConversa(conversaId, usuario)
    } else {
      return NextResponse.json({ error: 'Acao invalida.' }, { status: 400 })
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    const mensagem = error instanceof Error ? error.message : 'Falha ao alterar atendimento.'
    return NextResponse.json({ error: mensagem }, { status: 400 })
  }
}