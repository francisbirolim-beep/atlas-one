import { NextRequest, NextResponse } from 'next/server'
import { autenticarCompras } from '@/lib/comprasServer'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { ETAPAS_COTACAO, etapaItemCotacao, type EtapaCotacao } from '@/lib/cotacaoEtapas'

export const runtime='nodejs'
export const dynamic='force-dynamic'

const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const valido=(v:string):v is EtapaCotacao=>ETAPAS_COTACAO.includes(v as EtapaCotacao)

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
      .select('id,status_anterior,status_novo,motivo,usuario_nome,created_at,quantidade_itens,material_ids')
      .eq('empresa_id',usuario.empresa_id).eq('lote_id',loteId)
      .order('created_at',{ascending:false}).limit(50)
    if(error)throw error
    return NextResponse.json({ok:true,movimentos:data||[]},{headers:{'Cache-Control':'private, no-store'}})
  }catch(e){console.error('[Compras][HistoricoLote]',e);return NextResponse.json({error:'Falha ao consultar histórico.'},{status:500})}
}

export async function POST(req:NextRequest){
  const usuario=await autenticarCompras(req)
  if(!usuario)return NextResponse.json({error:'Sessão inválida.'},{status:401})
  const body=await req.json().catch(()=>({}))
  const vendaId=String(body.vendaId||'')
  const loteId=String(body.loteId||'')
  const origem=String(body.origem||'')
  const destino=String(body.destino||'')
  const versao=Number(body.versao)
  const motivo=String(body.motivo||'').trim().slice(0,1000)
  if(!uuid.test(vendaId)||!uuid.test(loteId)||!valido(origem)||!valido(destino)||origem===destino||
     !Number.isInteger(versao)||versao<1){
    return NextResponse.json({error:'Movimentação inválida.'},{status:400})
  }
  if(ETAPAS_COTACAO.indexOf(destino)<ETAPAS_COTACAO.indexOf(origem) && !motivo)
    return NextResponse.json({error:'Informe a justificativa para retornar itens à etapa anterior.'},{status:400})
  try{
    const {data:lote,error:buscaErro}=await supabaseAdmin.from('venda_cotacao_lotes')
      .select('id,status,versao,itens').eq('empresa_id',usuario.empresa_id)
      .eq('venda_obra_id',vendaId).eq('id',loteId).maybeSingle()
    if(buscaErro)throw buscaErro
    if(!lote||lote.status==='cancelado')return NextResponse.json({error:'Lista de cotação não encontrada ou cancelada.'},{status:404})
    if(lote.versao!==versao)return NextResponse.json({error:'Outro usuário alterou o card. Atualize antes de mover novamente.'},{status:409})
    const disponiveis=((lote.itens||[]) as Array<{material_id:string;status_etapa?:string}>)
      .filter(item=>etapaItemCotacao(lote,item)===origem).map(item=>item.material_id)
    const idsSolicitados=body.materialIds===undefined?disponiveis:body.materialIds
    if(!Array.isArray(idsSolicitados)||!idsSolicitados.length||idsSolicitados.length>1000||
       idsSolicitados.some((x:unknown)=>typeof x!=='string'||!uuid.test(x)) ||
       new Set(idsSolicitados).size!==idsSolicitados.length ||
       idsSolicitados.some((x:string)=>!disponiveis.includes(x))){
      return NextResponse.json({error:'Selecione materiais da etapa de origem antes de mover.'},{status:400})
    }
    const {data,error}=await supabaseAdmin.rpc('fn_mover_itens_lote_cotacao_v1',{
      p_empresa:usuario.empresa_id,p_lote:loteId,p_venda:vendaId,p_versao:versao,
      p_origem:origem,p_destino:destino,p_material_ids:idsSolicitados,
      p_usuario:usuario.id,p_nome:usuario.nome,p_motivo:motivo||null,
    })
    if(error){
      const conflito=/alterado por outro|seleção|não está na etapa|duplicado/i.test(error.message)
      return NextResponse.json({error:conflito?'A lista mudou durante a operação. Atualize e tente novamente.':error.message},{status:conflito?409:400})
    }
    return NextResponse.json({ok:true,lote:data?.[0],movidos:idsSolicitados.length,
      aviso:'Etapa administrativa atualizada por item. Entrada no estoque e recebimento fiscal dependem de conferência própria.'},
      {headers:{'Cache-Control':'private, no-store'}})
  }catch(e){
    console.error('[Compras][MoverItensCotacao]',e)
    return NextResponse.json({error:'Não foi possível movimentar os materiais da cotação.'},{status:500})
  }
}
