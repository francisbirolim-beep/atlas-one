import { NextRequest, NextResponse } from 'next/server'
import { autenticarTenant } from '@/lib/tenantServer'
import { supabaseAdmin as db } from '@/lib/supabaseAdmin'
import { podeMesclarKanbanComercial } from '@/lib/kanbanMesclagemAcessoServer'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const uuid = (v: unknown): v is string =>
  typeof v === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v)
const erro = (message: string, status = 400) =>
  NextResponse.json({ error: message }, { status, headers: { 'Cache-Control': 'no-store' } })

/**
 * Mescla por cópia, de forma transacional:
 * - preserva número, preço, itens e conferência do W.Vetro de destino;
 * - copia as notas/mídias, fotos, anexos e histórico do card arrastado;
 * - deixa a origem auditável, mas retira a duplicata da visão operacional.
 *
 * Nunca excluir o card de origem nem atualizar diretamente pelo navegador.
 */
export async function POST(req: NextRequest) {
  const usuario = await autenticarTenant(req)
  if (!usuario) return erro('Sessão inválida.', 401)
  try {
    if (!await podeMesclarKanbanComercial(usuario)) {
      return erro('Sem permissão de edição comercial para unir cards.', 403)
    }
  } catch (e) {
    console.error('[kanban mesclar] Falha ao validar permissão:', e)
    return erro('Não foi possível validar sua permissão. Nenhum dado foi alterado.', 503)
  }
  const body = await req.json().catch(() => null)
  const origemId = body?.origemId, destinoId = body?.destinoId
  if (!uuid(origemId) || !uuid(destinoId) || origemId === destinoId || body?.confirmou !== true) {
    return erro('Selecione dois cards diferentes e confirme a incorporação.')
  }

  try {
    const { data, error } = await db.rpc('kanban_mesclar_cards_comerciais_v1', {
      p_empresa: usuario.empresa_id,
      p_usuario: usuario.id,
      p_origem: origemId,
      p_destino: destinoId,
    })
    if (error) {
      const conhecida = /nomes|cadastros diferentes|não encontrado|retirado|somente o Master|não pode|vínculo/i.test(error.message)
      console.error('[kanban mesclar] Operação rejeitada:', error.message)
      return erro(conhecida ? error.message : 'Não foi possível unir os cards. Nenhum dado foi alterado.', conhecida ? 409 : 503)
    }
    const { data: destino, error: leituraErro } = await db.from('orcamentos')
      .select('*')
      .eq('empresa_id', usuario.empresa_id)
      .eq('id', destinoId)
      .maybeSingle()
    if (leituraErro) console.error('[kanban mesclar] Mesclagem concluída, releitura falhou:', leituraErro.message)
    return NextResponse.json({
      ok: true, ...(data || {}),
      orcamento: destino || null,
      aviso: destino
        ? 'Informações incorporadas. Card original preservado no histórico de retirados. Orçamento W.Vetro e valores mantidos.'
        : 'Informações incorporadas. Atualize o Kanban para visualizar o card de destino.',
    }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (e) {
    console.error('[kanban mesclar]', e)
    return erro('Não foi possível confirmar a mesclagem. Nenhuma exclusão foi solicitada.', 503)
  }
}
