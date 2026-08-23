import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { autenticarCompras } from '@/lib/comprasServer'

export const runtime='nodejs'
export const dynamic='force-dynamic'

export async function POST(req:NextRequest){
 const u=await autenticarCompras(req);if(!u)return NextResponse.json({error:'Sessão inválida.'},{status:401})
 try{
  const b=await req.json();const quantidade=Number(b.quantidade||0)
  if(!b.saldoOrigemId||!b.enderecoDestinoId||quantidade<=0)return NextResponse.json({error:'Informe saldo de origem, endereço de destino e quantidade.'},{status:400})
  const {data,error}=await supabaseAdmin.rpc('movimentar_estoque_interno',{p_saldo_origem_id:b.saldoOrigemId,p_endereco_destino_id:b.enderecoDestinoId,p_quantidade:quantidade,p_usuario_id:u.id,p_usuario_nome:u.nome})
  if(error)throw error;return NextResponse.json(data)
 }catch(e:any){console.error(e);return NextResponse.json({error:e?.message||'Não foi possível endereçar o estoque.'},{status:500})}
}
