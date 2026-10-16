import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { autenticarTenant } from '@/lib/tenantServer'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
const erro=(mensagem:string,status=400)=>NextResponse.json({error:mensagem},{status})
const NUMERO=/^\d+(?:\.\d{1,2})?$/
const UUID=/^[a-f\d]{8}-(?:[a-f\d]{4}-){3}[a-f\d]{12}$/i
function moeda(valor:unknown):number|null{
 if(typeof valor==='number')return Number.isFinite(valor)?valor:null
 let s=String(valor??'').trim()
 if(s.includes(','))s=s.replace(/\./g,'').replace(',','.')
 if(!NUMERO.test(s))return null
 const n=Number(s)
 return Number.isFinite(n)?n:null
}
export async function POST(req:NextRequest){
 const usuario=await autenticarTenant(req)
 if(!usuario)return erro('Sessão inválida.',401)
 if(String(usuario.role).toLowerCase()!=='master')return erro('Somente Master pode validar ou corrigir o valor de venda.',403)
 try{
  const body=await req.json()
  const vendaId=String(body.vendaId??'')
  const acao=String(body.acao??'')
  const justificativa=String(body.justificativa??'').trim().slice(0,500)
  const valorAnterior=moeda(body.valorAnterior)
  const valor=acao==='corrigido'?moeda(body.valor):null
  if(!UUID.test(vendaId))return erro('Venda inválida.')
  if(!['validado','corrigido'].includes(acao))return erro('Ação inválida.')
  if(valorAnterior===null||valorAnterior<0)return erro('Valor atual da venda inválido.')
  if(acao==='corrigido'&&(valor===null||valor<=0||valor>999999999))return erro('Informe um valor de venda válido.')
  if(acao==='corrigido'&&justificativa.length<8)return erro('Justificativa obrigatória (mínimo 8 caracteres).')
  // Transação única no banco: auditoria e atualização da venda.
  // Nunca altera orçamento, materiais ou contas a receber existentes.
  const token=(req.headers.get('authorization')||'').replace(/^Bearer\s+/i,'').trim()
  const db=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,
   process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,{
    auth:{autoRefreshToken:false,persistSession:false},
    global:{headers:{Authorization:'Bearer '+token}},
   })
  const {data,error}=await db.rpc('fn_venda_conferir_valor_wvetro_v1',{
   p_venda_id:vendaId,p_acao:acao,p_valor:valor,p_valor_anterior:valorAnterior,p_justificativa:justificativa,
  })
  if(error){
   if(error.code==='PGRST202'||error.code==='42883')return erro('Conferência ainda não habilitada no banco. Nenhum valor foi alterado.',409)
   return erro(error.message||'Erro ao atualizar o valor da venda.',409)
  }
  return NextResponse.json(data)
 }catch(e){
  console.error('Conferência de venda W.Vetro:',e)
  return erro('Não foi possível concluir a conferência do valor da venda.',500)
 }
}
