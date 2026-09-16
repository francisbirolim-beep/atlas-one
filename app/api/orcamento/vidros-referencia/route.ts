import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { autenticarTenant } from '@/lib/tenantServer'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const usuario = await autenticarTenant(req)
  if (!usuario) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const { data, error } = await supabaseAdmin
    .from('wvetro_referencias_vidros')
    .select('id,codigo,especificacao,ocorrencias,status_validacao')
    .order('ocorrencias', { ascending: false })
    .order('especificacao', { ascending: true })
    .limit(500)

  if (error) {
    console.error('Erro ao carregar referências de vidro W.Vetro:', error)
    return NextResponse.json({ error: 'Não foi possível carregar os vidros.' }, { status: 500 })
  }

  return NextResponse.json({
    vidros: (data || []).map(item => ({
      id: item.id,
      codigo: item.codigo || null,
      nome: item.especificacao,
      ocorrencias: item.ocorrencias || 0,
      origem: item.status_validacao || 'referencia_wvetro',
    })),
  })
}
