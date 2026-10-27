import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { autenticarTenant } from '@/lib/tenantServer'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const falha=(error:string,status=400)=>NextResponse.json({error},{status})
function dinheiro(v:unknown):number|null{
 const s=String(v??'').trim().replace(/\s/g,'')
 if(!/^(?:\d+)(?:[.,]\d{1,2})?$/.test(s))return null
 const n=Number(s.replace(',','.'))
 return Number.isFinite(n)&&n>0&&n<=999999999?n:null
}
export async function GET(req:NextRequest){
 const u=await autenticarTenant(req)
 if(!u)return falha('Sessão expirada.',401)
 if(String(u.role).toLowerCase()!=='master')return falha('Somente Master pode consultar correções.',403)
 const vendaId=req.nextUrl.searchParams.get('vendaId')||''
 if(!UUID.test(vendaId))return falha('Venda inválida.')
 const {data:venda}=await supabaseAdmin.from('vendas_obras').select('id')
  .eq('id',vendaId).eq('empresa_id',u.empresa_id).maybeSingle()
 if(!venda)return falha('Venda não encontrada.',404)
 const {data,error}=await supabaseAdmin.from('financeiro_recebimentos_correcoes_master')
  .select('id,recebimento_id,valor_anterior,valor_novo,justificativa,criado_por_nome,created_at')
  .eq('empresa_id',u.empresa_id).eq('venda_obra_id',vendaId)
  .order('created_at',{ascending:false}).limit(50)
 if(error&&['42P01','PGRST205'].includes(error.code||''))return NextResponse.json({historico:[],disponivel:false})
 if(error)return falha('Não foi possível consultar o histórico.',500)
 return NextResponse.json({historico:data||[],disponivel:true})
}
export async function POST(req:NextRequest){
 const u=await autenticarTenant(req)
 if(!u)return falha('Sessão expirada.',401)
 if(String(u.role).toLowerCase()!=='master')return falha('Somente Master pode corrigir pagamentos.',403)
 // A prévia usa o mesmo projeto Supabase da produção: ela nunca grava recebimentos.
 if(process.env.VERCEL_ENV==='preview')return falha('Em prévia, nenhuma baixa financeira é alterada.',409)
 try{
  const b=await req.json()
  const vendaId=String(b.vendaId||''),recebimentoId=String(b.recebimentoId||'')
  const anterior=dinheiro(b.valorAnterior),novo=dinheiro(b.valorNovo)
  const justificativa=String(b.justificativa||'').trim()
  if(!UUID.test(vendaId)||!UUID.test(recebimentoId))return falha('Venda ou recebimento inválido.')
  if(anterior===null||novo===null||novo===anterior)return falha('Informe um valor de pagamento válido e diferente do anterior.')
  if(justificativa.length<8||justificativa.length>500)return falha('Justificativa obrigatória (8 a 500 caracteres).')
  const token=(req.headers.get('authorization')||'').replace(/^Bearer\s+/i,'').trim()
  const db=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,
   process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,{auth:{persistSession:false,autoRefreshToken:false},
    global:{headers:{Authorization:'Bearer '+token}}})
  const {data,error}=await db.rpc('fn_corrigir_recebimento_venda_master_v1',{
   p_venda_id:vendaId,p_recebimento_id:recebimentoId,
   p_valor_anterior:anterior,p_valor_novo:novo,p_justificativa:justificativa
  })
  if(error){
   if(['PGRST202','42883'].includes(error.code||''))return falha('Correção de recebimentos ainda não habilitada no banco. Nada foi alterado.',409)
   return falha(error.message||'Não foi possível corrigir o pagamento.',409)
  }
  return NextResponse.json(data)
 }catch{return falha('Não foi possível processar a correção.',500)}
}
