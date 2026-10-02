import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization') || ''
    const token = authHeader.replace(/^Bearer\s+/i, '').trim()
    if (!token) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }

    const { data: userData, error: userErr } = await supabaseAdmin.auth.getUser(token)
    if (userErr || !userData?.user) {
      return NextResponse.json({ error: 'Sessão inválida' }, { status: 401 })
    }

    const { data: perfil, error: perfilErr } = await supabaseAdmin
      .from('usuarios')
      .select('nome, role, empresa_id')
      .eq('id', userData.user.id)
      .maybeSingle()

    if (perfilErr || !perfil || perfil.role !== 'master' || !perfil.empresa_id) {
      return NextResponse.json({ error: 'Apenas o usuário master pode validar unidade operacional' }, { status: 403 })
    }

    const body = await req.json()
    const produtoId = typeof body.produtoId === 'string' ? body.produtoId.trim() : ''
    const unidade = typeof body.unidade === 'string' ? body.unidade.trim() : ''
    const evidencia = typeof body.evidencia === 'string' ? body.evidencia.trim() : ''

    if (!produtoId) return NextResponse.json({ error: 'Produto inválido' }, { status: 400 })
    if (!unidade) return NextResponse.json({ error: 'Informe a unidade operacional' }, { status: 400 })
    if (unidade.length > 40) return NextResponse.json({ error: 'A unidade operacional deve ter no máximo 40 caracteres' }, { status: 400 })
    if (!evidencia) return NextResponse.json({ error: 'Registre como a unidade foi confirmada' }, { status: 400 })
    if (evidencia.length > 1000) return NextResponse.json({ error: 'A evidência deve ter no máximo 1000 caracteres' }, { status: 400 })

    const { data: atual, error: erroLeitura } = await supabaseAdmin
      .from('produtos')
      .select('id, nome, categoria, unidade, unidade_origem, qtde_embalagem_origem, observacao_validacao')
      .eq('id', produtoId)
      .eq('empresa_id', perfil.empresa_id)
      .maybeSingle()

    if (erroLeitura || !atual) {
      return NextResponse.json({ error: 'Não foi possível localizar o produto para validação' }, { status: 404 })
    }
    if (atual.categoria !== 'acessorio') {
      return NextResponse.json({ error: 'Esta fila aceita somente acessórios' }, { status: 400 })
    }
    if (atual.unidade) {
      return NextResponse.json({ error: 'Este produto já possui unidade operacional. Recarregue a fila antes de continuar.' }, { status: 409 })
    }

    const agora = new Date()
    const agoraIso = agora.toISOString()
    const origem = atual.unidade_origem || 'não informada'
    const embalagem = atual.qtde_embalagem_origem != null ? String(atual.qtde_embalagem_origem) : 'não informada'
    const registro = [
      `Unidade operacional validada manualmente como "${unidade}".`,
      `Origem preservada: ${origem}; Qtde Emb.: ${embalagem}.`,
      `Evidência: ${evidencia}.`,
      `Responsável: ${perfil.nome || userData.user.email || 'usuário não identificado'} em ${agora.toLocaleString('pt-BR')}.`,
    ].join(' ')
    const observacao = [atual.observacao_validacao?.trim(), registro].filter(Boolean).join('\n')

    const { data: atualizado, error: erroUpdate } = await supabaseAdmin
      .from('produtos')
      .update({
        unidade,
        status_validacao: 'revisado',
        validado_em: agoraIso,
        validado_por_id: userData.user.id,
        validado_por_nome: perfil.nome || userData.user.email || null,
        observacao_validacao: observacao,
        updated_at: agoraIso,
      })
      .eq('id', produtoId)
      .eq('empresa_id', perfil.empresa_id)
      .is('unidade', null)
      .select('id')
      .maybeSingle()

    if (erroUpdate) return NextResponse.json({ error: 'Não foi possível registrar a unidade operacional' }, { status: 400 })
    if (!atualizado) return NextResponse.json({ error: 'O produto foi alterado por outro usuário. Recarregue a fila antes de continuar.' }, { status: 409 })

    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Erro inesperado' }, { status: 500 })
  }
}
