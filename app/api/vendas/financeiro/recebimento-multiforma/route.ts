import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { autenticarTenant } from '@/lib/tenantServer'

export const runtime='nodejs'
export const dynamic='force-dynamic'
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const fail=(error:string,status=400)=>NextResponse.json({error},{status})

function usuarioDb(req:NextRequest){
  const token=(req.headers.get('authorization')||'').replace(/^Bearer\s+/i,'').trim()
  if(!token) return null
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    auth:{persistSession:false,autoRefreshToken:false},
    global:{headers:{Authorization:'Bearer '+token}},
  })
}
export async function POST(req:NextRequest){
  const u=await autenticarTenant(req)
  if(!u)return fail('Sessão inválida.',401)
  // A prévia pode apontar para o banco real e nunca deve gravar movimentos financeiros.
  if(process.env.VERCEL_ENV==='preview')return fail('Em ambiente de prévia, o recebimento não é gravado.',409)
  try{
    const b=await req.json()
    if(!UUID.test(String(b.vendaObraId||''))||!UUID.test(String(b.clienteId||'')))return fail('Venda/cliente inválido.')
    const formas=b.formas
    if(!Array.isArray(formas)||formas.length<1||formas.length>30)return fail('Informe de 1 a 30 formas de pagamento.')
    const permitidas=new Set(['pix','dinheiro','boleto','cartao','cartao_credito','cartao_debito','transferencia','cheque'])
    if(formas.some((x:any)=>!x||typeof x!=='object'||!permitidas.has(String(x.forma||''))||!Number.isFinite(Number(x.valor))||Number(x.valor)<=0||Math.abs(Number(x.valor)*100-Math.round(Number(x.valor)*100))>0.00001))return fail('Formas e valores inválidos.')
    if(formas.some((f:any)=>f.forma==='cartao_credito'
      ? !Number.isInteger(f.parcelas)||f.parcelas<1||f.parcelas>18
      : f.parcelas!=null))return fail('Para cartão de crédito, informe de 1 a 18 parcelas. Outras formas não podem ter parcelas.')
    const desconto=Number(b.desconto||0)
    if(!Number.isFinite(desconto)||desconto<0||Math.abs(desconto*100-Math.round(desconto*100))>0.00001)return fail('Desconto inválido.')
    const data=String(b.dataRecebimento||'')
    if(!/^\d{4}-\d{2}-\d{2}$/.test(data))return fail('Data inválida.')
    const db=usuarioDb(req)
    if(!db)return fail('Sessão inválida.',401)
    const {data:resultado,error}=await db.rpc('registrar_recebimento_venda_multiforma',{
      p_venda_obra_id:b.vendaObraId,
      p_cliente_id:b.clienteId,
      p_formas:formas.map((f:any)=>({forma:String(f.forma),valor:Number(Number(f.valor).toFixed(2)),...(f.forma==='cartao_credito'?{parcelas:Number(f.parcelas)}:{})})),
      p_desconto:desconto,
      p_data_recebimento:data,
      p_referencia:String(b.referencia||'').trim().slice(0,500)||null,
      p_observacoes:String(b.observacoes||'').trim().slice(0,2000)||null,
    })
    if(error)return fail(error.message||'Não foi possível registrar o recebimento.',409)
    return NextResponse.json(resultado)
  }catch{return fail('Não foi possível processar o recebimento.',500)}
}
