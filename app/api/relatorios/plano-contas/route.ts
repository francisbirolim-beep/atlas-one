import { NextRequest,NextResponse } from 'next/server'
import { autenticarTenant } from '@/lib/tenantServer'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { PLANO_CONTAS_PADRAO } from '@/lib/financeiroPlanoContas'
export const runtime='nodejs'
export const dynamic='force-dynamic'
const valido=/^\d{4}-\d{2}-\d{2}$/
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const erro=(mensagem:string,status=400)=>NextResponse.json({error:mensagem},{status})
async function carregarContas(empresa:string) {
 const {data,error}=await supabaseAdmin.from('financeiro_plano_contas').select('id,codigo,nome,grupo,ativo').eq('empresa_id',empresa).order('codigo')
 if(error)throw error
 const existentes=new Set((data||[]).map(c=>c.codigo))
 const faltantes=PLANO_CONTAS_PADRAO.filter(c=>!existentes.has(c.codigo)).map(c=>({...c,empresa_id:empresa}))
 if(faltantes.length){
  const {error:err}=await supabaseAdmin.from('financeiro_plano_contas').upsert(faltantes,{onConflict:'empresa_id,codigo',ignoreDuplicates:true})
  if(err)throw err
  const novo=await supabaseAdmin.from('financeiro_plano_contas').select('id,codigo,nome,grupo,ativo').eq('empresa_id',empresa).order('codigo')
  if(novo.error)throw novo.error
  return novo.data||[]
 }
 return data||[]
}
export async function GET(req:NextRequest){
 const u=await autenticarTenant(req)
 if(!u)return erro('Sessão inválida.',401)
 if(u.role!=='master')return erro('Classificação contábil disponível ao Master.',403)
 const inicio=req.nextUrl.searchParams.get('inicio')||''
 const fim=req.nextUrl.searchParams.get('fim')||''
 if(!valido.test(inicio)||!valido.test(fim)||inicio>fim)return erro('Período inválido.')
 try{
  const contas=await carregarContas(u.empresa_id)
  const {data,error}=await supabaseAdmin.from('financeiro_contas_pagar')
   .select('id,descricao,fornecedor_nome,documento,valor,valor_pago,status,vencimento,data_pagamento')
   .eq('empresa_id',u.empresa_id)
   .or('and(vencimento.gte.'+inicio+',vencimento.lte.'+fim+'),and(data_pagamento.gte.'+inicio+',data_pagamento.lte.'+fim+')')
   .order('vencimento',{ascending:false}).limit(501)
  if(error)throw error
  if((data||[]).length>500)return erro('Mais de 500 títulos. Reduza o período.',422)
  const ids=(data||[]).map(x=>x.id)
  let classificacoes:any[]=[]
  if(ids.length){
   const {data:c,error:e}=await supabaseAdmin.from('financeiro_conta_classificacoes')
    .select('conta_pagar_id,plano_conta_id,classificado_em,classificado_por_nome')
    .eq('empresa_id',u.empresa_id).in('conta_pagar_id',ids)
   if(e)throw e
   classificacoes=c||[]
  }
  return NextResponse.json({ok:true,contas,titulos:data||[],classificacoes})
 }catch(e){
  console.error('Falha no plano de contas:',e)
  return erro('Não foi possível carregar o plano de contas ou títulos. Confira a migração.',500)
 }
}
export async function POST(req:NextRequest){
 const u=await autenticarTenant(req)
 if(!u)return erro('Sessão inválida.',401)
 if(u.role!=='master')return erro('Classificação contábil disponível ao Master.',403)
 try{
  const body=await req.json()
  const contaPagarId=String(body?.contaPagarId||'').trim()
  const planoContaId=body?.planoContaId===null?null:String(body?.planoContaId||'').trim()
  if(!uuid.test(contaPagarId)||planoContaId!==null&&!uuid.test(planoContaId))return erro('Identificador inválido.')
  const {data:titulo,error:tituloErro}=await supabaseAdmin.from('financeiro_contas_pagar').select('id,empresa_id').eq('id',contaPagarId).eq('empresa_id',u.empresa_id).maybeSingle()
  if(tituloErro)throw tituloErro
  if(!titulo)return erro('Título não encontrado nesta empresa.',404)
  if(planoContaId===null){
   const {error}=await supabaseAdmin.from('financeiro_conta_classificacoes').delete().eq('empresa_id',u.empresa_id).eq('conta_pagar_id',contaPagarId)
   if(error)throw error
   return NextResponse.json({ok:true})
  }
  const {data:conta,error:contaErro}=await supabaseAdmin.from('financeiro_plano_contas')
   .select('id').eq('id',planoContaId).eq('empresa_id',u.empresa_id).eq('ativo',true).maybeSingle()
  if(contaErro)throw contaErro
  if(!conta)return erro('Conta gerencial não encontrada nesta empresa.',404)
  const {error}=await supabaseAdmin.from('financeiro_conta_classificacoes').upsert({
    empresa_id:u.empresa_id,conta_pagar_id:contaPagarId,plano_conta_id:planoContaId,
    classificado_por_id:u.id,classificado_por_nome:u.nome,classificado_em:new Date().toISOString()
  },{onConflict:'empresa_id,conta_pagar_id'})
  if(error)throw error
  return NextResponse.json({ok:true})
 }catch(e){
  console.error('Falha ao classificar título:',e)
  return erro('Não foi possível classificar o título.',500)
 }
}
