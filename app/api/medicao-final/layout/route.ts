import { NextRequest, NextResponse } from 'next/server'
import { autenticarTenant } from '@/lib/tenantServer'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { LAYOUT_MEDICAO_A4_PADRAO, normalizarLayoutMedicaoA4 } from '@/lib/medicaoFinalLayoutA4Schema'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const usuario = await autenticarTenant(req)
  if (!usuario) return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 })

  const { data, error } = await supabaseAdmin.from('medicao_final_layouts')
    .select('configuracao,updated_at')
    .eq('empresa_id', usuario.empresa_id).maybeSingle()
  if (error) return NextResponse.json({ error: 'Não foi possível carregar a configuração de impressão.' }, { status: 503 })
  return NextResponse.json({
    layout: normalizarLayoutMedicaoA4(data?.configuracao || LAYOUT_MEDICAO_A4_PADRAO),
    atualizadoEm: data?.updated_at || null,
  })
}

export async function PUT(req: NextRequest) {
  const usuario = await autenticarTenant(req)
  if (!usuario) return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 })
  if (usuario.role !== 'master') return NextResponse.json({ error: 'Somente o administrador pode alterar o padrão da empresa.' }, { status: 403 })

  const corpo = await req.json().catch(() => null)
  if (!corpo || typeof corpo.layout !== 'object' || corpo.layout === null || Array.isArray(corpo.layout)) {
    return NextResponse.json({ error: 'Configuração de layout inválida.' }, { status: 400 })
  }
  const layout = normalizarLayoutMedicaoA4(corpo.layout)
  const { error } = await supabaseAdmin.from('medicao_final_layouts').upsert({
    empresa_id: usuario.empresa_id,
    configuracao: layout,
    atualizado_por: usuario.id,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'empresa_id' })
  if (error) return NextResponse.json({ error: 'Erro ao salvar o layout. Verifique se a atualização do banco foi aplicada.' }, { status: 503 })
  return NextResponse.json({ ok: true, layout })
}
