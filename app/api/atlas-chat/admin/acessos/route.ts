import {NextRequest,NextResponse} from 'next/server'
import {autenticarTenant} from '@/lib/tenantServer'
import {supabaseAdmin} from '@/lib/supabaseAdmin'
import {pilotoAtivo,usuariosPiloto} from '@/lib/atlasChatPiloto'
import {acessoPersistenteAtivo} from '@/lib/atlasChatAcessosServer'
export const dynamic='force-dynamic'
const reply=(body:object,status=200)=>NextResponse.json(body,{status,headers:{'Cache-Control':'private, no-store'}})
export async function PUT(req:NextRequest){
 try{
  if(!pilotoAtivo()||!acessoPersistenteAtivo())return reply({error:'Configuração persistente ainda não liberada.'},403)
  const u=await autenticarTenant(req)
  if(!u||u.role!=='master')return reply({error:'Acesso exclusivo do Master.'},403)
  const b=await req.json(),id=typeof b.usuarioId==='string'?b.usuarioId:''
  if(!usuariosPiloto().has(id)||typeof b.habilitado!=='boolean')return reply({error:'Usuário fora do piloto ou autorização inválida.'},400)
  const {data,error}=await supabaseAdmin.from('usuarios').select('id').eq('empresa_id',u.empresa_id).eq('id',id).maybeSingle()
  if(error||!data)return reply({error:'Usuário indisponível.'},403)
  const {error:save}=await supabaseAdmin.from('atlas_chat_acessos').upsert({empresa_id:u.empresa_id,usuario_id:id,habilitado:b.habilitado,atualizado_por:u.id,updated_at:new Date().toISOString()},{onConflict:'empresa_id,usuario_id'})
  if(save)throw save
  return reply({ok:true,habilitado:b.habilitado})
 }catch{return reply({error:'Falha ao salvar acesso individual.'},500)}
}
