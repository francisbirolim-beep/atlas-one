import { NextRequest, NextResponse } from 'next/server'
import { autenticarTenant } from '@/lib/tenantServer'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { registrarEventoMelhoria } from '@/lib/melhoriasAtlas'

export const runtime = 'nodejs'

const STATUS = new Set([
  'novo',
  'ia_analisando',
  'informacao_necessaria',
  'solucao_proposta',
  'aguardando_aprovacao',
  'aprovado',
  'em_desenvolvimento',
  'teste',
  'pronto_publicar',
  'publicado',
  'rejeitado',
])
const RISCOS = new Set(['nao_avaliado', 'baixo', 'medio', 'alto', 'critico'])
const APROVACOES = new Set(['pendente', 'aprovado', 'rejeitado'])

function valorTexto(v: unknown, max = 5000) {
  return String(v || '').trim().slice(0, max)
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const usuario = await autenticarTenant(req)
    if (!usuario) return NextResponse.json({ error: 'Sessão inválida.' }, { status: 401 })
    if (usuario.role !== 'master') {
      return NextResponse.json({ error: 'Somente o Master pode alterar o fluxo de melhorias.' }, { status: 403 })
    }

    const melhoriaId = String(params?.id || '').trim()
    if (!melhoriaId) return NextResponse.json({ error: 'Melhoria não informada.' }, { status: 400 })

    const { data: atual } = await supabaseAdmin
      .from('atlas_melhorias')
      .select('id,numero,status,risco,aprovacao_status')
      .eq('id', melhoriaId)
      .eq('empresa_id', usuario.empresa_id)
      .maybeSingle()

    if (!atual) return NextResponse.json({ error: 'Melhoria não encontrada.' }, { status: 404 })

    const body = await req.json()
    const update: Record<string, unknown> = {}
    const status = valorTexto(body?.status, 50)
    const risco = valorTexto(body?.risco, 30)
    const aprovacao = valorTexto(body?.aprovacao_status, 30)

    if (status) {
      if (!STATUS.has(status)) return NextResponse.json({ error: 'Status inválido.' }, { status: 400 })
      update.status = status
    }
    if (risco) {
      if (!RISCOS.has(risco)) return NextResponse.json({ error: 'Risco inválido.' }, { status: 400 })
      update.risco = risco
      update.exige_aprovacao = risco !== 'baixo'
    }
    if (aprovacao) {
      if (!APROVACOES.has(aprovacao)) return NextResponse.json({ error: 'Aprovação inválida.' }, { status: 400 })
      update.aprovacao_status = aprovacao
      if (aprovacao === 'aprovado') {
        update.aprovado_por_id = usuario.id
        update.aprovado_por_nome = usuario.nome || null
        update.aprovado_em = new Date().toISOString()
        if (!status) update.status = 'aprovado'
      } else if (aprovacao === 'rejeitado') {
        update.aprovado_por_id = usuario.id
        update.aprovado_por_nome = usuario.nome || null
        update.aprovado_em = new Date().toISOString()
        if (!status) update.status = 'rejeitado'
      } else {
        update.aprovado_por_id = null
        update.aprovado_por_nome = null
        update.aprovado_em = null
      }
    }

    if (Object.prototype.hasOwnProperty.call(body || {}, 'observacoes_admin')) {
      update.observacoes_admin = valorTexto(body?.observacoes_admin, 6000) || null
    }
    if (Object.prototype.hasOwnProperty.call(body || {}, 'responsavel_id')) {
      const responsavelId = valorTexto(body?.responsavel_id, 80)
      update.responsavel_id = responsavelId || null
      update.responsavel_nome = valorTexto(body?.responsavel_nome, 180) || null
    }

    if (Object.keys(update).length === 0) {
      return NextResponse.json({ error: 'Nenhuma alteração informada.' }, { status: 400 })
    }

    const { data: alterada, error } = await supabaseAdmin
      .from('atlas_melhorias')
      .update(update)
      .eq('id', melhoriaId)
      .eq('empresa_id', usuario.empresa_id)
      .select('*')
      .single()

    if (error || !alterada) {
      return NextResponse.json({ error: error?.message || 'Não foi possível atualizar a melhoria.' }, { status: 500 })
    }

    await registrarEventoMelhoria(melhoriaId, usuario.empresa_id, usuario, 'atualizado', {
      antes: {
        status: atual.status,
        risco: atual.risco,
        aprovacao_status: atual.aprovacao_status,
      },
      depois: update,
    })

    return NextResponse.json({ ok: true, melhoria: alterada })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Erro ao atualizar melhoria.' }, { status: 500 })
  }
}