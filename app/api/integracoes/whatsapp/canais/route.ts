import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { autenticarTenant } from '@/lib/tenantServer'

export const dynamic = 'force-dynamic'

async function usuarioAtual(req: NextRequest) {
  return autenticarTenant(req)
}

async function podeGerenciarCanal(
  usuario: Awaited<ReturnType<typeof autenticarTenant>>,
  canal: { criado_por?: string | null; principal?: boolean },
) {
  if (!usuario) return false
  if (usuario.role === 'master') return true
  if (canal.principal) return false
  return canal.criado_por === usuario.id
}

// Pareamento e controle do aparelho sao exclusivos do Master.
// Permissoes de leitura/atendimento nao podem ampliar este privilegio.
function podeOperarConexao(usuario: Awaited<ReturnType<typeof autenticarTenant>>) {
  return usuario?.role === 'master'
}

export async function GET(req: NextRequest) {
  const usuario = await usuarioAtual(req)
  if (!usuario) {
    return NextResponse.json({ error: 'Nao autenticado.' }, { status: 401 })
  }

  const [canaisResp, usuariosResp] = await Promise.all([
    supabaseAdmin
      .from('atendimento_whatsapp_canais')
      .select('*')
      .eq('empresa_id', usuario.empresa_id)
      .eq('ativo', true)
      .order('principal', { ascending: false })
      .order('nivel_hierarquia', { ascending: true })
      .order('created_at', { ascending: true }),
    supabaseAdmin
      .from('usuarios')
      .select('id,nome,role')
      .eq('empresa_id', usuario.empresa_id)
      .order('nome'),
  ])

  const erro = canaisResp.error || usuariosResp.error
  if (erro) return NextResponse.json({ error: erro.message }, { status: 500 })

  const canais = (canaisResp.data || [])
    .filter((canal: any) =>
      usuario.role === 'master' || canal.principal ||
      canal.usuario_id === usuario.id || canal.criado_por === usuario.id)
    .map((canal: any) => {
      const podeConectar = usuario.role === 'master'
      return {
        ...canal,
        pode_gerenciar_conexao: podeConectar,
        // O QR permite vincular um aparelho. Nunca enviá-lo a usuários sem autorização.
        gateway_qr_data_url: podeConectar ? canal.gateway_qr_data_url : null,
      }
    })

  return NextResponse.json({
    ok: true,
    usuario: { id: usuario.id, nome: usuario.nome, role: usuario.role },
    canais,
    usuarios: usuario.role === 'master'
      ? (usuariosResp.data || [])
      : (usuariosResp.data || []).filter((u: any) => u.id === usuario.id),
  })
}

export async function POST(req: NextRequest) {
  const usuario = await usuarioAtual(req)
  if (!usuario) {
    return NextResponse.json({ error: 'Nao autenticado.' }, { status: 401 })
  }
  if (usuario.role !== 'master') {
    return NextResponse.json({ error: 'Somente Master pode cadastrar novos aparelhos.' }, { status: 403 })
  }

  try {
    const body = await req.json()
    const nome = String(body?.nome || '').trim()
    const tipoConta = ['business','pessoal'].includes(String(body?.tipoConta))
      ? String(body.tipoConta)
      : 'nao_informado'
    const nivel = Math.max(1, Math.floor(Number(body?.nivelHierarquia || 100)))
    let usuarioId = body?.usuarioId ? String(body.usuarioId) : usuario.id

    if (!nome) {
      return NextResponse.json({ error: 'Informe um nome para identificar o canal.' }, { status: 400 })
    }

    if (usuario.role !== 'master') usuarioId = usuario.id

    let usuarioNome: string | null = null
    if (usuarioId) {
      const { data: destino } = await supabaseAdmin
        .from('usuarios')
        .select('id,nome,empresa_id')
        .eq('id', usuarioId)
        .maybeSingle()
      if (!destino || destino.empresa_id !== usuario.empresa_id) {
        return NextResponse.json({ error: 'Usuario invalido.' }, { status: 400 })
      }
      usuarioNome = destino.nome
    }

    const { data, error } = await supabaseAdmin
      .from('atendimento_whatsapp_canais')
      .insert({
        empresa_id: usuario.empresa_id,
        nome,
        numero_declarado: null,
        numero_conectado: null,
        tipo_conta: tipoConta,
        principal: false,
        usuario_id: usuarioId || null,
        usuario_nome: usuarioNome,
        nivel_hierarquia: nivel,
        criado_por: usuario.id,
        criado_por_nome: usuario.nome,
        ativo: true,
        gateway_status: 'offline',
      })
      .select('*')
      .single()

    if (error) throw error
    return NextResponse.json({ ok: true, canal: data })
  } catch (error) {
    const mensagem = error instanceof Error ? error.message : 'Falha ao criar canal.'
    return NextResponse.json({ error: mensagem }, { status: 400 })
  }
}

export async function PATCH(req: NextRequest) {
  const usuario = await usuarioAtual(req)
  if (!usuario) {
    return NextResponse.json({ error: 'Nao autenticado.' }, { status: 401 })
  }

  try {
    const body = await req.json()
    const id = String(body?.id || '')
    const acao = String(body?.acao || 'editar')

    const { data: canal } = await supabaseAdmin
      .from('atendimento_whatsapp_canais')
      .select('*')
      .eq('id', id)
      .eq('empresa_id', usuario.empresa_id)
      .maybeSingle()

    if (!canal) return NextResponse.json({ error: 'Canal nao encontrado.' }, { status: 404 })

    if (['conectar','reconectar','desconectar'].includes(acao)) {
      if (!(await podeOperarConexao(usuario))) {
        return NextResponse.json({ error: 'Somente Master pode conectar, reconectar ou desconectar o WhatsApp.' }, { status: 403 })
      }
      // Registrar comando explícito sem trocar session_slug e sem descartar o histórico.
      // Se o gateway estiver indisponível, a solicitação permanece registrada.
      const desconectar = acao === 'desconectar'
      const agora = new Date().toISOString()
      const ultimoSinal = Date.parse(String(canal.gateway_last_seen_at || ''))
      const sinalRecente = Number.isFinite(ultimoSinal) && Date.now() - ultimoSinal < 10 * 60_000
      const { data, error } = await supabaseAdmin
        .from('atendimento_whatsapp_canais')
        .update({
          gateway_status: desconectar ? 'paused' : 'disconnected',
          conexao_pausada: desconectar,
          gateway_qr_data_url: null,
          // Requisição nova é identificável pelo gateway mesmo que já exista sessão.
          ...(!desconectar ? { gateway_reconnect_requested_at: agora } : {}),
          updated_at: agora,
        })
        .eq('id', id)
        .eq('empresa_id', usuario.empresa_id)
        .select('*')
        .single()
      if (error) throw error
      const mensagem = desconectar
        ? 'Desconexão solicitada. A sessão e o histórico foram preservados.'
        : sinalRecente
          ? 'Solicitação enviada. A conexão existente será recuperada ou um novo QR será exibido se necessário.'
          : 'Solicitação registrada, mas o gateway não apresenta sinal recente. É necessário restabelecer o serviço do WhatsApp no computador para gerar o QR Code.'
      return NextResponse.json({
        ok: true, canal: data, mensagem,
        gateway_sem_sinal: !sinalRecente,
      }, { status: !desconectar && !sinalRecente ? 202 : 200 })
    }

    if (acao !== 'editar') {
      return NextResponse.json({ error: 'Operação inválida.' }, { status: 400 })
    }
    if (!(await podeGerenciarCanal(usuario, canal))) {
      return NextResponse.json({ error: 'Voce nao pode alterar este canal.' }, { status: 403 })
    }

    let usuarioId = body?.usuarioId ? String(body.usuarioId) : null
    if (usuario.role !== 'master') usuarioId = usuario.id

    let usuarioNome: string | null = null
    if (usuarioId) {
      const { data: destino } = await supabaseAdmin
        .from('usuarios')
        .select('id,nome,empresa_id')
        .eq('id', usuarioId)
        .maybeSingle()
      if (!destino || destino.empresa_id !== usuario.empresa_id) {
        return NextResponse.json({ error: 'Usuario invalido.' }, { status: 400 })
      }
      usuarioNome = destino.nome
    }

    const updates: Record<string, unknown> = {
      nome: String(body?.nome || canal.nome).trim(),
      tipo_conta: ['business','pessoal','nao_informado'].includes(String(body?.tipoConta))
        ? String(body.tipoConta)
        : canal.tipo_conta,
      nivel_hierarquia: canal.principal
        ? 0
        : Math.max(1, Math.floor(Number(body?.nivelHierarquia || canal.nivel_hierarquia || 100))),
      usuario_id: canal.principal ? null : usuarioId,
      usuario_nome: canal.principal ? null : usuarioNome,
      updated_at: new Date().toISOString(),
    }

    const { data, error } = await supabaseAdmin
      .from('atendimento_whatsapp_canais')
      .update(updates)
      .eq('id', id)
      .select('*')
      .single()
    if (error) throw error

    return NextResponse.json({ ok: true, canal: data })
  } catch (error) {
    const mensagem = error instanceof Error ? error.message : 'Falha ao atualizar canal.'
    return NextResponse.json({ error: mensagem }, { status: 400 })
  }
}

export async function DELETE(req: NextRequest) {
  const usuario = await usuarioAtual(req)
  if (!usuario) {
    return NextResponse.json({ error: 'Nao autenticado.' }, { status: 401 })
  }

  try {
    const id = req.nextUrl.searchParams.get('id') || ''
    const { data: canal } = await supabaseAdmin
      .from('atendimento_whatsapp_canais')
      .select('*')
      .eq('id', id)
      .eq('empresa_id', usuario.empresa_id)
      .maybeSingle()

    if (!canal) return NextResponse.json({ error: 'Canal nao encontrado.' }, { status: 404 })
    if (canal.principal) {
      return NextResponse.json({ error: 'O canal principal nao pode ser removido.' }, { status: 400 })
    }
    if (usuario.role !== 'master') {
      return NextResponse.json({ error: 'Somente Master pode remover canais.' }, { status: 403 })
    }
    if (!(await podeGerenciarCanal(usuario, canal))) {
      return NextResponse.json({ error: 'Voce nao pode remover este canal.' }, { status: 403 })
    }

    const { error } = await supabaseAdmin
      .from('atendimento_whatsapp_canais')
      .update({
        ativo: false,
        gateway_status: 'offline',
        gateway_qr_data_url: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
    if (error) throw error

    return NextResponse.json({ ok: true })
  } catch (error) {
    const mensagem = error instanceof Error ? error.message : 'Falha ao remover canal.'
    return NextResponse.json({ error: mensagem }, { status: 400 })
  }
}
