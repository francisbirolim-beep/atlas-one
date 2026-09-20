import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

export const runtime = 'nodejs'

type UsuarioIA = { id: string; nome: string | null; empresa_id: string }

async function autenticar(req: NextRequest): Promise<UsuarioIA | null> {
  const auth = req.headers.get('authorization') || ''
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : ''
  if (!token) return null
  const { data: authData } = await supabaseAdmin.auth.getUser(token)
  if (!authData.user) return null
  const { data } = await supabaseAdmin
    .from('usuarios')
    .select('id,nome,empresa_id')
    .eq('id', authData.user.id)
    .maybeSingle()
  if (!data?.empresa_id) return null
  return data as UsuarioIA
}

export async function POST(req: NextRequest) {
  try {
    const usuario = await autenticar(req)
    if (!usuario) return NextResponse.json({ error: 'Sessão inválida' }, { status: 401 })

    const body = await req.json()
    const interacaoId = String(body?.interacaoId || '').trim()
    const avaliacao = String(body?.avaliacao || '').trim()
    const correcao = String(body?.correcao || '').trim()

    if (!interacaoId) return NextResponse.json({ error: 'Interação não informada' }, { status: 400 })
    if (!['aprovado', 'corrigido', 'rejeitado'].includes(avaliacao)) {
      return NextResponse.json({ error: 'Avaliação inválida' }, { status: 400 })
    }
    if (avaliacao === 'corrigido' && !correcao) {
      return NextResponse.json({ error: 'Escreva a correção para ensinar a IA' }, { status: 400 })
    }

    const { data: interacao } = await supabaseAdmin
      .from('ai_interacoes')
      .select('id,pergunta,resposta,contexto')
      .eq('empresa_id', usuario.empresa_id)
      .eq('id', interacaoId)
      .maybeSingle()

    if (!interacao) return NextResponse.json({ error: 'Interação não encontrada' }, { status: 404 })

    const { error } = await supabaseAdmin
      .from('ai_feedback')
      .upsert(
        {
          empresa_id: usuario.empresa_id,
          interacao_id: interacaoId,
          usuario_id: usuario.id,
          usuario_nome: usuario.nome || null,
          avaliacao,
          correcao: correcao || null,
        },
        { onConflict: 'interacao_id,usuario_id' }
      )

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    if (avaliacao === 'corrigido' && correcao) {
      await supabaseAdmin.from('ai_memorias').insert({
        empresa_id: usuario.empresa_id,
        escopo: interacao.contexto || 'comercial',
        titulo: `Correção humana: ${String(interacao.pergunta).slice(0, 120)}`,
        conteudo: correcao,
        origem_interacao_id: interacaoId,
        aprovado_por_id: usuario.id,
        aprovado_por_nome: usuario.nome || null,
        ativo: true,
      })
    }

    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Erro ao registrar feedback' }, { status: 500 })
  }
}