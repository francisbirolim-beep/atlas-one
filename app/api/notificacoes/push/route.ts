import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { autenticarTenant } from '@/lib/tenantServer'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const VAPID_PUBLIC_KEY = 'BIgSnzr5G0jMiYM9IZU_1C333QWP783YN_J5xY9rBpLbZDF9_Jo5okcG7ovtI7uGwxVRSMXGCC6ydKdxg3IYt9s'

export async function GET(req: NextRequest) {
  const usuario = await autenticarTenant(req)
  if (!usuario) return NextResponse.json({ error: 'Nao autenticado.' }, { status: 401 })

  const { count } = await supabaseAdmin
    .from('notificacao_push_assinaturas')
    .select('id', { count: 'exact', head: true })
    .eq('empresa_id', usuario.empresa_id)
    .eq('usuario_id', usuario.id)
    .eq('ativo', true)

  return NextResponse.json({
    ok: true,
    publicKey: VAPID_PUBLIC_KEY,
    dispositivosAtivos: Number(count || 0),
  })
}

export async function POST(req: NextRequest) {
  const usuario = await autenticarTenant(req)
  if (!usuario) return NextResponse.json({ error: 'Nao autenticado.' }, { status: 401 })

  try {
    const body = await req.json()
    const acao = String(body?.acao || '')

    if (acao === 'assinar') {
      const assinatura = body?.assinatura || {}
      const endpoint = String(assinatura?.endpoint || '').trim()
      const p256dh = String(assinatura?.keys?.p256dh || '').trim()
      const auth = String(assinatura?.keys?.auth || '').trim()
      if (!endpoint.startsWith('https://') || !p256dh || !auth) {
        return NextResponse.json({ error: 'Assinatura de notificacao invalida.' }, { status: 400 })
      }

      const agora = new Date().toISOString()
      const { error } = await supabaseAdmin
        .from('notificacao_push_assinaturas')
        .upsert({
          empresa_id: usuario.empresa_id,
          usuario_id: usuario.id,
          endpoint,
          p256dh,
          auth,
          dispositivo_nome: String(body?.dispositivoNome || '').slice(0, 160) || null,
          user_agent: req.headers.get('user-agent')?.slice(0, 500) || null,
          ativo: true,
          erro_count: 0,
          ultimo_erro: null,
          last_seen_at: agora,
          updated_at: agora,
        }, { onConflict: 'endpoint' })
      if (error) throw error

      await supabaseAdmin
        .from('notificacao_preferencias')
        .upsert({
          usuario_id: usuario.id,
          empresa_id: usuario.empresa_id,
          push_ativo: true,
          updated_at: agora,
        }, { onConflict: 'usuario_id', ignoreDuplicates: false })

      return NextResponse.json({ ok: true })
    }

    if (acao === 'remover') {
      const endpoint = String(body?.endpoint || '').trim()
      if (!endpoint) return NextResponse.json({ error: 'Endpoint nao informado.' }, { status: 400 })

      const { error } = await supabaseAdmin
        .from('notificacao_push_assinaturas')
        .update({ ativo: false, updated_at: new Date().toISOString() })
        .eq('empresa_id', usuario.empresa_id)
        .eq('usuario_id', usuario.id)
        .eq('endpoint', endpoint)
      if (error) throw error

      return NextResponse.json({ ok: true })
    }

    return NextResponse.json({ error: 'Acao invalida.' }, { status: 400 })
  } catch (error) {
    const mensagem = error instanceof Error ? error.message : 'Falha ao configurar notificacoes.'
    return NextResponse.json({ error: mensagem }, { status: 400 })
  }
}
