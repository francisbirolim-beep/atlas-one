import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { autenticarTenant } from '@/lib/tenantServer'
import { permitidoConferirVenda } from '@/lib/conferenciaFinanceiraPermissaoServer'

export const runtime='nodejs'
export const dynamic='force-dynamic'
const UUID=/^[a-f\d]{8}-(?:[a-f\d]{4}-){3}[a-f\d]{12}$/i
const erro=(message:string,status=400)=>NextResponse.json({error:message},{status})

export async function POST(req:NextRequest){
 const usuario=await autenticarTenant(req)
 if(!usuario)return erro('Sessão inválida.',401)
 try{
  if(!await permitidoConferirVenda(req,usuario))
   return erro('Sem permissão para conciliar títulos.',403)
 }catch{return erro('Não foi possível validar suas permissões.',503)}
 if(process.env.VERCEL_ENV==='preview')
  return erro('Prévia: títulos financeiros não são alterados.',409)
 try{
  const b=await req.json()
  const vendaId=String(b.vendaId||'')
  const valorVendaEsperado=Number(b.valorVendaEsperado)
  const valorTituloEsperado=Number(b.valorTituloEsperado)
  if(!UUID.test(vendaId)||!Number.isFinite(valorVendaEsperado)||
     !Number.isFinite(valorTituloEsperado)||valorVendaEsperado<=0||valorTituloEsperado<0)
   return erro('Venda ou valores inválidos.')
  const token=(req.headers.get('authorization')||'').replace(/^Bearer\s+/i,'').trim()
  if(!token)return erro('Sessão inválida.',401)
  const db=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,{
      auth:{autoRefreshToken:false,persistSession:false},
      global:{headers:{Authorization:'Bearer '+token}},
    })
  const {data,error}=await db.rpc('fn_conciliar_titulo_venda_ajustada_v1',{
    p_venda_id:vendaId,
    p_valor_venda_esperado:valorVendaEsperado,
    p_valor_titulo_esperado:valorTituloEsperado,
  })
  if(error){
   if(error.code==='PGRST202'||error.code==='42883')
    return erro('Conciliação ainda não habilitada. Nenhum valor foi alterado.',409)
   return erro(error.message||'Não foi possível conciliar o título.',409)
  }
  return NextResponse.json(data,{headers:{'Cache-Control':'no-store'}})
 }catch(e){
  console.error('[conciliação de título]',e)
  return erro('Falha ao conciliar título.',500)
 }
}
