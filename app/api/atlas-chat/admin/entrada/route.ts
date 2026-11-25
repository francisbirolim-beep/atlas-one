import {NextRequest,NextResponse} from 'next/server'
import {autenticarTenant} from '@/lib/tenantServer'
import {supabaseAdmin} from '@/lib/supabaseAdmin'
import {equipePilotoEmpresa,escopoPilotoLeitura} from '@/lib/atlasChatPiloto'
import {permissoesEntradaAtlas} from '@/lib/atlasChatEntrada'
export const dynamic='force-dynamic'
const reply=(b:object,status=200)=>NextResponse.json(b,{status,headers:{'Cache-Control':'private, no-store'}})
async function master(req:NextRequest){
 const u=await autenticarTenant(req)
 return u?.role==='master'&&equipePilotoEmpresa(u.empresa_id)&&escopoPilotoLeitura(u.empresa_id,u.id)?u:null
}
export async function GET(req:NextRequest){
 try{
  const u=await master(req);if(!u)return reply({error:'Acesso exclusivo do Master no piloto.'},403)
  const [{data:users,error:e},{data:rows,error:r}]=await Promise.all([
   supabaseAdmin.from('usuarios').select('id,nome,cargo,role').eq('empresa_id',u.empresa_id).order('nome'),
   supabaseAdmin.from('atlas_chat_acessos').select('usuario_id,habilitado,central_habilitado').eq('empresa_id',u.empresa_id)
  ])
  if(e||r)throw e||r
  return reply({usuarios:(users||[]).map(x=>{const a=(rows||[]).find(y=>y.usuario_id===x.id);return {...x,...permissoesEntradaAtlas(a,escopoPilotoLeitura(u.empresa_id,x.id))}})})
 }catch{return reply({error:'Falha ao consultar permissões.'},500)}
}
export async function PUT(req:NextRequest){
 try{
  const u=await master(req);if(!u)return reply({error:'Acesso exclusivo do Master no piloto.'},403)
  const b=await req.json()
  if(typeof b.usuarioId!=='string'||typeof b.chat!=='boolean'||typeof b.central!=='boolean')return reply({error:'Permissões inválidas.'},400)
  const {data:alvo,error:e}=await supabaseAdmin.from('usuarios').select('id,role').eq('empresa_id',u.empresa_id).eq('id',b.usuarioId).maybeSingle()
  if(e||!alvo)return reply({error:'Usuário indisponível para esta configuração.'},403)
  const {error}=await supabaseAdmin.from('atlas_chat_acessos').upsert({empresa_id:u.empresa_id,usuario_id:alvo.id,habilitado:b.chat,central_habilitado:b.central,atualizado_por:u.id,updated_at:new Date().toISOString()},{onConflict:'empresa_id,usuario_id'})
  if(error)throw error
  return reply({ok:true})
 }catch{return reply({error:'Falha ao salvar permissões.'},500)}
}
