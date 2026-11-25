import {NextRequest,NextResponse} from 'next/server'
import {autenticarTenant} from '@/lib/tenantServer'
import {supabaseAdmin} from '@/lib/supabaseAdmin'
import {pilotoAtivo} from '@/lib/atlasChatPiloto'
import {historicoAtlasAtivo} from '@/lib/atlasChatHistoricoServer'
export const dynamic='force-dynamic'
const reply=(body:object,status=200)=>NextResponse.json(body,{status,headers:{'Cache-Control':'private, no-store'}})
async function master(req:NextRequest){
 if(!pilotoAtivo()||!historicoAtlasAtivo())return null
 const u=await autenticarTenant(req)
 return u?.role==='master'?u:null
}
export async function GET(req:NextRequest){
 try{
  const u=await master(req);if(!u)return reply({error:'Acesso exclusivo do Master no piloto.'},403)
  const offset=Number(req.nextUrl.searchParams.get('offset')||0)
  if(!Number.isSafeInteger(offset)||offset<0||offset>1000000)return reply({error:'Página inválida.'},400)
  const id=req.nextUrl.searchParams.get('ocultacaoId')
  if(id){
    const {data:o,error}=await supabaseAdmin.from('atlas_chat_ocultacoes').select('conversa_id,mensagem_id').eq('empresa_id',u.empresa_id).eq('id',id).maybeSingle()
    if(error||!o)return reply({error:'Registro indisponível.'},404)
    let q=supabaseAdmin.from('atendimento_mensagens').select('id,conversa_id,direcao,tipo,texto,mime_type,media_url,usuario_nome,created_at').eq('empresa_id',u.empresa_id).eq('conversa_id',o.conversa_id)
    if(o.mensagem_id)q=q.eq('id',o.mensagem_id)
    const {data,error:err}=await q.order('created_at',{ascending:false}).order('id',{ascending:false}).range(offset,offset+99)
    if(err)throw err
    const mensagens=await Promise.all((data||[]).map(async m=>{
      const path=String(m.media_url||'')
      const seguro=path.startsWith(u.empresa_id+'/entrada/')||path.startsWith(u.empresa_id+'/saida/')
      const signed=seguro?await supabaseAdmin.storage.from('whatsapp-midia').createSignedUrl(path,600):null
      return {...m,media_url:signed?.data?.signedUrl||null}
    }))
    return reply({mensagens,mais:mensagens.length===100})
  }
  let registros=supabaseAdmin.from('atlas_chat_ocultacoes').select('id,usuario_id,usuario_nome,cliente_nome,cliente_id,telefone,responsavel_id,responsavel_nome,conversa_id,mensagem_id,ocultado_em,restaurado_em,restaurado_por').eq('empresa_id',u.empresa_id)
  const cliente=req.nextUrl.searchParams.get('cliente')?.trim().slice(0,120)
  const usuario=req.nextUrl.searchParams.get('funcionario')?.trim().slice(0,120)
  const telefone=req.nextUrl.searchParams.get('telefone')?.replace(/\D/g,'').slice(0,13)
  if(cliente)registros=registros.ilike('cliente_nome','%'+cliente.replace(/[%_\\]/g,'')+'%')
  if(usuario)registros=registros.ilike('usuario_nome','%'+usuario.replace(/[%_\\]/g,'')+'%')
  if(telefone)registros=registros.ilike('telefone','%'+telefone+'%')
  const {data,error}=await registros.order('ocultado_em',{ascending:false}).order('id',{ascending:false}).range(offset,offset+99)
  if(error)throw error
  return reply({registros:data||[],mais:(data||[]).length===100})
 }catch{return reply({error:'Falha ao consultar histórico.'},500)}
}
export async function PUT(req:NextRequest){
 try{
  const u=await master(req);if(!u)return reply({error:'Acesso exclusivo do Master no piloto.'},403)
  const b=await req.json()
  if(typeof b.id!=='string')return reply({error:'Registro inválido.'},400)
  const {data,error}=await supabaseAdmin.from('atlas_chat_ocultacoes').update({restaurado_em:new Date().toISOString(),restaurado_por:u.id}).eq('empresa_id',u.empresa_id).eq('id',b.id).is('restaurado_em',null).select('id').maybeSingle()
  if(error)throw error
  if(!data)return reply({error:'Registro indisponível ou já restaurado.'},409)
  return reply({ok:true})
 }catch{return reply({error:'Falha ao restaurar histórico.'},500)}
}
