import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { autenticarTenant } from '@/lib/tenantServer'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { usuarioPodeAcaoServer } from '@/lib/acessoUsuarioServer'
import { gerarPacoteMedicaoFinalParcial } from '@/lib/materialPlanejamento'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export async function POST(req: NextRequest) {
  const usuario = await autenticarTenant(req)
  if (!usuario) return NextResponse.json({ error: 'Sessão inválida.' }, { status: 401 })
  let autorizado=false
  try{
    autorizado=await usuarioPodeAcaoServer({
      usuarioId:usuario.id,role:usuario.role,empresaId:usuario.empresa_id,
      setorId:'producao',acaoId:'producao.plano_corte.gerar',minimo:'edicao',
    })
  }catch{return NextResponse.json({error:'Não foi possível conferir a permissão para gerar pacote técnico.'},{status:503})}
  if(!autorizado)return NextResponse.json({error:'Sem permissão para gerar pacote técnico.'},{status:403})
  try {
    const body = await req.json().catch(() => ({}))
    const medicaoId = String(body.medicaoId || '')
    if (!UUID.test(medicaoId)) return NextResponse.json({ error: 'Medição inválida.' }, { status: 400 })
    const { data: medicao, error } = await supabaseAdmin.from('medicoes_finais')
      .select('id,empresa_id,orcamento_id,tipo_medicao').eq('empresa_id', usuario.empresa_id)
      .eq('id', medicaoId).eq('tipo_medicao', 'tipologia').maybeSingle()
    if (error || !medicao?.orcamento_id) {
      return NextResponse.json({ error: 'Medição de tipologia sem orçamento válido nesta empresa.' }, { status: 404 })
    }
    const { data: orcamento } = await supabaseAdmin.from('orcamentos').select('id')
      .eq('empresa_id', usuario.empresa_id).eq('id', medicao.orcamento_id).maybeSingle()
    const { data: venda } = await supabaseAdmin.from('vendas_obras').select('id')
      .eq('empresa_id', usuario.empresa_id).eq('orcamento_id', medicao.orcamento_id)
      .limit(1).maybeSingle()
    if (!orcamento || !venda) return NextResponse.json({
      error: 'Orçamento precisa pertencer à empresa e estar vendido antes de gerar pacote técnico.',
    }, { status: 409 })

    // Evita pacotes órfãos antes da migration aditiva ser validada.
    const esquema = await supabaseAdmin.from('pacote_tecnico_materiais')
      .select('medicao_item_id').eq('empresa_id', usuario.empresa_id).limit(1)
    if (esquema.error) return NextResponse.json({
      error: 'A migration de vínculo individual ainda não foi aplicada. Nada foi gerado.',
    }, { status: 409 })

    // Gerador técnico usa defaults/RLS de empresa da sessão autenticada.
    // Service role não carrega a claim JWT necessária ao default empresa_id.
    const token = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '').trim()
    const dbUsuario = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
        auth: { autoRefreshToken: false, persistSession: false },
        global: { headers: { Authorization: 'Bearer ' + token } },
      },
    )
    const resultado = await gerarPacoteMedicaoFinalParcial(
      medicao.orcamento_id, medicao.id, usuario as any, dbUsuario,
    )
    if (!resultado.ok) return NextResponse.json({ error: resultado.error }, { status: 409 })
    return NextResponse.json({
      ok: true, pacoteId: resultado.pacote.id,
      mensagem: 'Pacote técnico parcial gerado apenas para as unidades aprovadas. Conferir a lista antes da separação; nenhuma ordem de corte foi liberada.',
    })
  } catch (e) {
    console.error('[Produção/Pacote parcial]', e)
    return NextResponse.json({ error: 'Falha ao gerar o pacote parcial. Nenhuma ordem foi liberada.' }, { status: 500 })
  }
}
