import { NextRequest, NextResponse } from 'next/server'
import { autenticarCompras } from '@/lib/comprasServer'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

export const runtime='nodejs'
export const dynamic='force-dynamic'

const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const statusValidos=['necessidade','cotacao','comprado','entrega','recebido']

export async function GET(req:NextRequest){
  const usuario=await autenticarCompras(req)
  if(!usuario)return NextResponse.json({error:'Sessão inválida.'},{status:401})
  const vendaId=req.nextUrl.searchParams.get('vendaId')||''
  const loteId=req.nextUrl.searchParams.get('loteId')||''
  if(!uuid.test(vendaId)||!uuid.test(loteId))return NextResponse.json({error:'Parâmetros inválidos.'},{status:400})
  try{
    const {data:lote,error:e}=await supabaseAdmin.from('venda_cotacao_lotes').select('id')
      .eq('empresa_id',usuario.empresa_id).eq('venda_obra_id',vendaId).eq('id',loteId).maybeSingle()
    if(e)throw e
    if(!lote)return NextResponse.json({error:'Cotação não encontrada.'},{status:404})
    const {data,error}=await supabaseAdmin.from('venda_cotacao_movimentacoes')
      .select('id,status_anterior,status_novo,motivo,usuario_nome,created_at')
      .eq('empresa_id',usuario.empresa_id).eq('lote_id',loteId)
      .order('created_at',{ascending:false}).limit(50)
    if(error)throw error
    return NextResponse.json({ok:true,movimentos:data||[]},{headers:{'Cache-Control':'no-store'}})
  }catch(e){console.error('[Compras][HistoricoLote]',e);return NextResponse.json({error:'Falha ao consultar histórico.'},{status:500})}
}

export async function POST(req:NextRequest){
  const usuario=await autenticarCompras(req)
  if(!usuario)return NextResponse.json({error:'Sessão inválida.'},{status:401})
  const body=await req.json().catch(()=>({}))
  const vendaId=String(body.vendaId||'')
  const loteId=String(body.loteId||'')
  const destino=String(body.destino||'')
  const versao=Number(body.versao)
  if(!uuid.test(vendaId)||!uuid.test(loteId)||!statusValidos.includes(destino)||!Number.isInteger(versao)||versao<1)
    return NextResponse.json({error:'Movimentação inválida.'},{status:400})
  try{
    const {data,error}=await supabaseAdmin.rpc('fn_mover_lote_cotacao_v1',{
      p_empresa:usuario.empresa_id,p_lote:loteId,p_venda:vendaId,
      p_versao:versao,p_destino:destino,p_usuario:usuario.id,
      p_nome:usuario.nome,p_motivo:String(body.motivo||'').slice(0,1000),
    })
    if(error){
      if(/alterado por outro usuário|Etapa inválida|Cotação cancelada/.test(error.message))
        return NextResponse.json({error:error.message},{status:409})
      throw error
    }
    return NextResponse.json({
      ok:true,lote:Array.isArray(data)?data[0]:data,
      aviso:'A posição do card foi alterada com histórico. Documentos, pedidos, notas, pagamentos e estoque não são automaticamente alterados nem excluídos.',
    })
  }catch(e){
    console.error('[Compras][MovimentoLote]',e)
    return NextResponse.json({error:'Falha ao mover o card. A etapa anterior foi mantida.'},{status:500})
  }
}
