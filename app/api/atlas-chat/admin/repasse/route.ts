import {NextRequest,NextResponse} from 'next/server'
import {autenticarTenant} from '@/lib/tenantServer'
import {supabaseAdmin} from '@/lib/supabaseAdmin'
import {atlasChatHabilitado} from '@/lib/atlasChatAcessosServer'
import {obterDistribuicaoWhatsApp} from '@/lib/whatsappEscalonamento'
import {repasseHomologacaoAtivo,executarRepasseHomologacao} from '@/lib/atlasChatRepasseServer'
import {telefoneLiberadoNoPiloto} from '@/lib/atlasChatIndividual'
export const dynamic='force-dynamic'
const reply=(b:object,status=200)=>NextResponse.json(b,{status,headers:{'Cache-Control':'private, no-store'}})
async function master(req:NextRequest){
 if(!repasseHomologacaoAtivo())return null
 const u=await autenticarTenant(req)
 return u?.role==='master'?u:null
}
export async function GET(req:NextRequest){
 try{
  const u=await master(req);if(!u)return reply({error:'Repasse não liberado.'},403)
  const {data,error}=await supabaseAdmin.from('atlas_chat_repasse_config').select('ativo,destino_id,prazo_minutos').eq('empresa_id',u.empresa_id).maybeSingle()
  if(error)throw error
  return reply({config:data||null})
 }catch{return reply({error:'Falha ao consultar configuração.'},500)}
}
export async function PUT(req:NextRequest){
 try{
  const u=await master(req);if(!u)return reply({error:'Repasse não liberado.'},403)
  const b=await req.json()
  if(typeof b.ativo!=='boolean')return reply({error:'Informe ativação válida.'},400)
  if(!b.ativo){
   const {error}=await supabaseAdmin.from('atlas_chat_repasse_config').update({ativo:false}).eq('empresa_id',u.empresa_id)
   if(error)throw error
   return reply({ok:true})
  }
  const d=await obterDistribuicaoWhatsApp(u.empresa_id)
  if(!d?.ativo||typeof b.destinoId!=='string'||b.destinoId===d.usuario_principal_id||!d.secundarios_ids.includes(b.destinoId)||!Number.isInteger(b.prazoMinutos)||b.prazoMinutos<1||b.prazoMinutos>1440||!await atlasChatHabilitado(u.empresa_id,b.destinoId))return reply({error:'Destino ou prazo não autorizado.'},400)
  const {error}=await supabaseAdmin.from('atlas_chat_repasse_config').upsert({empresa_id:u.empresa_id,ativo:true,destino_id:b.destinoId,prazo_minutos:b.prazoMinutos},{onConflict:'empresa_id'})
  if(error)throw error
  return reply({ok:true})
 }catch{return reply({error:'Falha ao salvar configuração.'},500)}
}
// Execução manual exclusiva de homologação; sem cron instalado.
export async function POST(req:NextRequest){
 try{
  const u=await master(req);if(!u)return reply({error:'Repasse não liberado.'},403)
  const r=await executarRepasseHomologacao(u.empresa_id,n=>telefoneLiberadoNoPiloto(n,process.env.ATLAS_CHAT_NUMEROS_TESTE||''))
  return reply(r)
 }catch{return reply({error:'Falha na execução. Consulte os registros antes de repetir.'},500)}
}
