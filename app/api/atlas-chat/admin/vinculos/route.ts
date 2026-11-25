import {NextRequest,NextResponse} from 'next/server'
import {autenticarTenant} from '@/lib/tenantServer'
import {supabaseAdmin} from '@/lib/supabaseAdmin'
import {pilotoAtivo} from '@/lib/atlasChatPiloto'
import {atlasChatHabilitado,acessoPersistenteAtivo} from '@/lib/atlasChatAcessosServer'
import {normalizarVinculoAtlas} from '@/supabase/functions/_shared/atlasChatVinculo'
export const dynamic='force-dynamic'
const reply=(body:object,status=200)=>NextResponse.json(body,{status,headers:{'Cache-Control':'private, no-store'}})
async function contexto(req:NextRequest){
 if(!pilotoAtivo()||!acessoPersistenteAtivo()||process.env.ATLAS_CHAT_VINCULOS_PILOTO!=='true')return null
 const u=await autenticarTenant(req)
 if(!u||u.role!=='master')return null
 const {data,error}=await supabaseAdmin.from('atendimento_whatsapp_canais').select('id,usuario_id').eq('empresa_id',u.empresa_id).eq('principal',true).eq('ativo',true).maybeSingle()
 return !error&&data?{u,canal:data}:null
}
export async function GET(req:NextRequest){
 try{
  const ctx=await contexto(req);if(!ctx)return reply({error:'Vínculos não liberados.'},403)
  const {data,error}=await supabaseAdmin.from('atlas_chat_vinculos').select('telefone,responsavel_id,updated_at').eq('empresa_id',ctx.u.empresa_id).eq('canal_id',ctx.canal.id).order('updated_at',{ascending:false}).limit(200)
  if(error)throw error
  return reply({vinculos:data||[]})
 }catch{return reply({error:'Falha ao consultar vínculos.'},500)}
}
export async function PUT(req:NextRequest){
 try{
  const ctx=await contexto(req);if(!ctx)return reply({error:'Vínculos não liberados.'},403)
  const b=await req.json(),telefone=typeof b.telefone==='string'?normalizarVinculoAtlas(b.telefone):''
  if(!telefone||(b.responsavelId!==null&&typeof b.responsavelId!=='string'))return reply({error:'Informe número e destino válidos.'},400)
  const id=b.responsavelId as string|null
  // Piloto só pode gravar os números explicitamente autorizados.
  const lista=(process.env.ATLAS_CHAT_NUMEROS_TESTE||'').split(',').map(normalizarVinculoAtlas)
  if(!lista.includes(telefone))return reply({error:'Número fora da lista de teste.'},403)
  if(id!==null){
   const {data:alvo,error}=await supabaseAdmin.from('usuarios').select('id,role').eq('empresa_id',ctx.u.empresa_id).eq('id',id).maybeSingle()
   if(error||!alvo||!await atlasChatHabilitado(ctx.u.empresa_id,id))return reply({error:'Destino não autorizado no Atlas Chat.'},403)
   if(alvo.role!=='master'&&ctx.canal.usuario_id!==id){
    const {data:p,error:e}=await supabaseAdmin.from('atendimento_whatsapp_permissoes').select('pode_atender').eq('empresa_id',ctx.u.empresa_id).eq('canal_id',ctx.canal.id).eq('usuario_id',id).maybeSingle()
    if(e||p?.pode_atender!==true)return reply({error:'Destino sem permissão atual de atendimento do canal.'},403)
   }
  }
  const {error}=await supabaseAdmin.from('atlas_chat_vinculos').upsert({empresa_id:ctx.u.empresa_id,canal_id:ctx.canal.id,telefone,responsavel_id:id,atualizado_por:ctx.u.id,updated_at:new Date().toISOString()},{onConflict:'empresa_id,canal_id,telefone'})
  if(error)throw error
  // Não mexer em conversas existentes. A integração de entrada só aplica a novas/encerradas.
  return reply({ok:true})
 }catch{return reply({error:'Falha ao salvar vínculo.'},500)}
}
