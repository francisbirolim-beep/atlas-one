import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { autenticarTenant } from '@/lib/tenantServer'
export const runtime='nodejs'
export const dynamic='force-dynamic'
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const fail=(error:string,status=400)=>NextResponse.json({error},{status})

export async function POST(req:NextRequest){
  const u=await autenticarTenant(req)
  if(!u)return fail('Sessão inválida.',401)
  if(process.env.VERCEL_ENV==='preview')return fail('Em ambiente de prévia, nenhum recebimento é alterado ou cancelado.',409)
  try{
    const b=await req.json()
    const acao=String(b.acao||'')
    const motivo=String(b.motivo||'').trim()
    if(!UUID.test(String(b.vendaId||''))||!UUID.test(String(b.recebimentoId||'')))return fail('Venda ou recebimento inválido.')
    if(!['alterar','cancelar'].includes(acao))return fail('Ação inválida.')
    if(motivo.length<8||motivo.length>500)return fail('Informe a justificativa (8 a 500 caracteres).')
    if(acao==='alterar' && (!Array.isArray(b.formas)||b.formas.length<1||b.formas.length>30||!b.dataRecebimento))return fail('Informe as novas formas e a data.')
    if(acao==='alterar' && b.formas.some((f:any)=>!f||typeof f!=='object'||
      !Number.isFinite(Number(f.valor))||Number(f.valor)<=0||
      (f.forma==='cartao_credito' ? !Number.isInteger(f.parcelas)||f.parcelas<1||f.parcelas>18 : f.parcelas!=null)))return fail('Confira valores e parcelas do cartão (1 a 18 vezes).')
    const token=(req.headers.get('authorization')||'').replace(/^Bearer\s+/i,'').trim()
    if(!token)return fail('Sessão inválida.',401)
    const db=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,{
      auth:{persistSession:false,autoRefreshToken:false},
      global:{headers:{Authorization:'Bearer '+token}},
    })
    const {data,error}=await db.rpc('ajustar_recebimento_venda_auditado',{
      p_venda_obra_id:b.vendaId,
      p_recebimento_id:b.recebimentoId,
      p_acao:acao,
      p_motivo:motivo,
      p_novas_formas:acao==='alterar'?b.formas.map((x:any)=>({forma:String(x.forma||''),valor:String(x.valor||''),...(x.forma==='cartao_credito'?{parcelas:Number(x.parcelas)}:{})})):null,
      p_novo_desconto:acao==='alterar'?Number(b.desconto||0):0,
      p_nova_data:acao==='alterar'?String(b.dataRecebimento):null,
      p_nova_referencia:acao==='alterar'?String(b.referencia||'').trim().slice(0,500):null,
      p_novas_observacoes:acao==='alterar'?String(b.observacoes||'').trim().slice(0,2000):null,
      p_valor_esperado:Number(b.valorEsperado),
    })
    if(error)return fail(error.message||'Não foi possível alterar o recebimento.',409)
    return NextResponse.json(data)
  }catch{return fail('Não foi possível processar a operação.',500)}
}
