import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { autenticarTenant } from '@/lib/tenantServer'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const IMAGEM = /\.(jpg|jpeg|png|webp|heic)$/i

function mensagemErro(error: unknown) {
  const mensagem = error instanceof Error ? error.message : 'Não foi possível encaminhar a imagem.'
  return NextResponse.json({ error: mensagem }, { status: 400, headers: { 'Cache-Control': 'no-store' } })
}

/**
 * Encaminha fotos da equipe, inclusive recebidas, sem download local.
 * A mensagem original é consultada pelo servidor e o RPC existente registra
 * o compartilhamento como o próprio usuário, preservando notificações e histórico.
 */
export async function POST(req: NextRequest) {
  const usuario = await autenticarTenant(req)
  if (!usuario) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })

  try {
    const body = await req.json()
    const origemId = String(body?.conversaOrigemId || '')
    const destinoId = String(body?.conversaDestinoId || '')
    const mensagemId = String(body?.mensagemId || '')
    if (![origemId, destinoId, mensagemId].every(id => UUID.test(id)) || origemId === destinoId) {
      return NextResponse.json({ error: 'Escolha outra conversa para encaminhar.' }, { status: 400 })
    }

    const [{ data: conversas, error: erroConversas }, { data: participacoes, error: erroParticipacoes }] =
      await Promise.all([
        supabaseAdmin.from('chat_conversas').select('id').in('id', [origemId, destinoId])
          .eq('empresa_id', usuario.empresa_id),
        supabaseAdmin.from('chat_participantes').select('conversa_id')
          .in('conversa_id', [origemId, destinoId]).eq('usuario_id', usuario.id),
      ])
    if (erroConversas) throw erroConversas
    if (erroParticipacoes) throw erroParticipacoes
    if ((conversas || []).length !== 2 || (participacoes || []).length !== 2) {
      throw new Error('Você deve participar das duas conversas para encaminhar a imagem.')
    }

    const { data: original, error: erroMensagem } = await supabaseAdmin.from('chat_mensagens')
      .select('id,conversa_id,anexo_url,anexo_nome')
      .eq('conversa_id', origemId).eq('id', mensagemId).maybeSingle()
    if (erroMensagem) throw erroMensagem
    if (!original?.anexo_url) throw new Error('Esta mensagem não possui uma imagem disponível.')

    const nome = String(original.anexo_nome || '')
    if (!IMAGEM.test(nome)) throw new Error('Somente fotos e prints podem ser encaminhados nesta opção.')
    const supabaseOrigin = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL || '').origin
    const anexo = new URL(original.anexo_url)
    if (anexo.origin !== supabaseOrigin ||
        !anexo.pathname.startsWith('/storage/v1/object/public/chat-anexos/') ||
        original.anexo_url.length > 2048) {
      throw new Error('Esta imagem antiga não está disponível para encaminhamento seguro.')
    }

    const token = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '').trim()
    // Usa o RPC já responsável por mensagens internas e notificações. O JWT
    // mantém o mesmo auth.uid() do usuário e o banco verifica a participação.
    const client = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        auth: { autoRefreshToken: false, persistSession: false },
        global: { headers: { Authorization: `Bearer ${token}` } },
      },
    )
    const { data: enviada, error: erroEnvio } = await client.rpc('atlas_chat_enviar_mensagem', {
      p_conversa_id: destinoId,
      p_texto: '↪️ Imagem encaminhada',
      p_anexo_url: original.anexo_url,
      p_anexo_nome: nome,
      p_cliente_id: null,
      p_orcamento_id: null,
      p_mensagem_pai_id: null,
    })
    if (erroEnvio) throw erroEnvio
    return NextResponse.json({ ok: true, mensagemId: enviada?.id || null }, {
      headers: { 'Cache-Control': 'no-store' },
    })
  } catch (error) {
    return mensagemErro(error)
  }
}
