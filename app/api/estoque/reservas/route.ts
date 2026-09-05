import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { autenticarCompras } from '@/lib/comprasServer'

export const runtime='nodejs'
export const dynamic='force-dynamic'

export async function GET(req:NextRequest){
 const u=await autenticarCompras(req);if(!u)return NextResponse.json({error:'Sessão inválida.'},{status:401})
 try{
  const {data,error}=await supabaseAdmin
   .from('estoque_reservas')
   .select('id,produto_id,local_id,endereco_id,quantidade,status,origem_tipo,origem_id,cliente_id,observacoes,reservado_ate,criado_por_nome,created_at,produto:produtos(id,codigo,nome),local:estoque_locais(id,codigo,nome,unidade:unidades_operacionais(id,codigo,nome)),endereco:estoque_enderecos(id,codigo,zona,corredor,estante,prateleira,caixa),cliente:clientes(id,nome)')
   .eq('empresa_id',u.empresa_id)
   .eq('status','ativa')
   .order('created_at',{ascending:false})
   .limit(200)
  if(error)throw error;return NextResponse.json({ok:true,reservas:data||[]})
 }catch(e){console.error(e);return NextResponse.json({error:'Não foi possível carregar reservas.'},{status:500})}
}

export async function POST(req:NextRequest){
 const u=await autenticarCompras(req);if(!u)return NextResponse.json({error:'Sessão inválida.'},{status:401})
 try{
  const b=await req.json();const acao=String(b.acao||'reservar')
  if(acao==='cancelar'){
   if(!b.reservaId)return NextResponse.json({error:'Reserva não informada.'},{status:400})
   const {data,error}=await supabaseAdmin.rpc('cancelar_reserva_estoque',{p_reserva_id:b.reservaId,p_usuario_id:u.id,p_usuario_nome:u.nome});if(error)throw error;return NextResponse.json(data)
  }
  const quantidade=Number(b.quantidade||0);if(!b.produtoId||!b.localId||quantidade<=0)return NextResponse.json({error:'Informe produto, local e quantidade.'},{status:400})
  const {data,error}=await supabaseAdmin.rpc('reservar_estoque_local',{p_produto_id:b.produtoId,p_local_id:b.localId,p_quantidade:quantidade,p_origem_tipo:String(b.origemTipo||'reserva_manual'),p_origem_id:b.origemId||null,p_cliente_id:b.clienteId||null,p_observacoes:String(b.observacoes||''),p_reservado_ate:b.reservadoAte||null,p_usuario_id:u.id,p_usuario_nome:u.nome})
  if(error)throw error;return NextResponse.json(data)
 }catch(e:any){console.error(e);return NextResponse.json({error:e?.message||'Não foi possível reservar o estoque.'},{status:500})}
}
