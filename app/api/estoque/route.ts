import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { autenticarCompras, limiteSeguro } from '@/lib/comprasServer'

export const runtime='nodejs';export const dynamic='force-dynamic'
export async function GET(req:NextRequest){
  const u=await autenticarCompras(req);if(!u)return NextResponse.json({error:'Sessão inválida.'},{status:401})
  try{
    const q=(req.nextUrl.searchParams.get('q')||'').trim();const limite=limiteSeguro(req.nextUrl.searchParams.get('limit'),200,500)
    let query=supabaseAdmin.from('estoque_saldos').select('produto_id,unidade,quantidade,custo_medio,valor_estoque,updated_at,produto:produtos(id,codigo,nome,categoria)').order('updated_at',{ascending:false}).limit(limite)
    const {data,error}=await query;if(error)throw error
    let saldos=(data||[]) as any[]
    if(q){const n=q.toUpperCase();saldos=saldos.filter(s=>String(s.produto?.codigo||'').toUpperCase().includes(n)||String(s.produto?.nome||'').toUpperCase().includes(n))}
    const {data:movimentos}=await supabaseAdmin.from('estoque_movimentos').select('id,produto_id,tipo,quantidade,unidade,custo_unitario,valor_total,origem_tipo,nf_id,recebimento_id,criado_por_nome,created_at').order('created_at',{ascending:false}).limit(100)
    return NextResponse.json({ok:true,saldos,movimentos:movimentos||[]})
  }catch(e){console.error('Erro estoque',e);return NextResponse.json({error:'Não foi possível carregar o estoque.'},{status:500})}
}
