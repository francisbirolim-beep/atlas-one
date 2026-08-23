import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { autenticarCompras } from '@/lib/comprasServer'

export const runtime='nodejs'
export const dynamic='force-dynamic'

export async function GET(req:NextRequest){
 const u=await autenticarCompras(req);if(!u)return NextResponse.json({error:'Sessão inválida.'},{status:401})
 try{
  const [{data:transferencias,error},{data:locais}]=await Promise.all([
   supabaseAdmin.from('estoque_transferencias').select('id,numero,status,motivo,previsao,solicitado_por_nome,recebido_por_nome,enviado_em,recebido_em,created_at,origem:estoque_locais!estoque_transferencias_local_origem_id_fkey(id,codigo,nome,unidade:unidades_operacionais(id,codigo,nome)),destino:estoque_locais!estoque_transferencias_local_destino_id_fkey(id,codigo,nome,unidade:unidades_operacionais(id,codigo,nome)),itens:estoque_transferencia_itens(id,produto_id,quantidade_solicitada,quantidade_separada,quantidade_recebida,unidade,custo_unitario,produto:produtos(id,codigo,nome))').order('created_at',{ascending:false}).limit(100),
   supabaseAdmin.from('estoque_locais').select('id,codigo,nome,tipo,ativo,unidade:unidades_operacionais(id,codigo,nome,ativo)').eq('ativo',true).order('nome')
  ])
  if(error)throw error
  return NextResponse.json({ok:true,transferencias:transferencias||[],locais:(locais||[]).filter((l:any)=>l.unidade?.ativo!==false)})
 }catch(e){console.error(e);return NextResponse.json({error:'Não foi possível carregar as transferências.'},{status:500})}
}

export async function POST(req:NextRequest){
 const u=await autenticarCompras(req);if(!u)return NextResponse.json({error:'Sessão inválida.'},{status:401})
 try{
  const b=await req.json();const acao=String(b.acao||'criar')
  if(acao==='criar'){
   const itens=Array.isArray(b.itens)?b.itens.map((i:any)=>({produtoId:String(i.produtoId||''),quantidade:Number(i.quantidade||0)})).filter((i:any)=>i.produtoId&&i.quantidade>0):[]
   if(!b.localOrigemId||!b.localDestinoId||!itens.length)return NextResponse.json({error:'Informe origem, destino e ao menos um item.'},{status:400})
   const {data,error}=await supabaseAdmin.rpc('criar_transferencia_estoque',{p_local_origem_id:b.localOrigemId,p_local_destino_id:b.localDestinoId,p_itens:itens,p_motivo:String(b.motivo||''),p_previsao:b.previsao||null,p_usuario_id:u.id,p_usuario_nome:u.nome})
   if(error)throw error;return NextResponse.json(data)
  }
  if(!b.transferenciaId)return NextResponse.json({error:'Transferência não informada.'},{status:400})
  if(!['separar','enviar','receber','cancelar'].includes(acao))return NextResponse.json({error:'Ação inválida.'},{status:400})
  const {data,error}=await supabaseAdmin.rpc('avancar_transferencia_estoque',{p_transferencia_id:b.transferenciaId,p_acao:acao,p_usuario_id:u.id,p_usuario_nome:u.nome})
  if(error)throw error;return NextResponse.json(data)
 }catch(e:any){console.error(e);return NextResponse.json({error:e?.message||'Não foi possível executar a transferência.'},{status:500})}
}
