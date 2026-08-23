import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { autenticarBalcao } from '@/lib/balcaoServer'

export const runtime='nodejs';export const dynamic='force-dynamic'
export async function GET(req:NextRequest){
 const u=await autenticarBalcao(req,'venda-balcao','consulta');if(!u)return NextResponse.json({error:'Sem acesso aos orçamentos do balcão.'},{status:403})
 try{const q=(req.nextUrl.searchParams.get('q')||'').trim();let query=supabaseAdmin.from('orcamentos').select('id,numero,cliente_nome,cliente_whatsapp,valor_estimado,status,created_at,condicoes').eq('modo_entrada','balcao').order('created_at',{ascending:false}).limit(120);if(q){const n=Number(q.replace(/\D/g,''));query=Number.isFinite(n)&&n>0?query.or(`cliente_nome.ilike.%${q}%,numero.eq.${n}`):query.ilike('cliente_nome',`%${q}%`)}const {data,error}=await query;if(error)throw error;return NextResponse.json({ok:true,orcamentos:data||[]})}catch(e){console.error('Erro orçamentos balcão',e);return NextResponse.json({error:'Não foi possível carregar os orçamentos.'},{status:500})}
}
