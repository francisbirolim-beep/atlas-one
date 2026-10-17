import { NextRequest, NextResponse } from 'next/server'
import { autenticarTenant } from '@/lib/tenantServer'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { transcreverAudioGratis } from '@/lib/ai/transcricaoGratis'

export const runtime='nodejs'
export const dynamic='force-dynamic'
export const maxDuration=120
const BUCKET='atlas-ia-audios'
const MAX=12*1024*1024
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const MIMES:Record<string,string>={
 'audio/webm':'webm','audio/ogg':'ogg','audio/mp4':'m4a',
 'audio/mpeg':'mp3','audio/wav':'wav','audio/x-wav':'wav','audio/aac':'aac',
}
const erro=(mensagem:string,status:number)=>NextResponse.json({error:mensagem},{status})

export async function POST(req:NextRequest){
 const usuario=await autenticarTenant(req)
 if(!usuario)return erro('Sessão inválida.',401)
 let file:File | null=null
 let tipo=''
 try{
  const form=await req.formData()
  file=form.get('audio') instanceof File ? form.get('audio') as File : null
  tipo=String(form.get('tipo')||'')
 }catch{return erro('Áudio inválido.',400)}
 if(!file||!['tarefa','agenda'].includes(tipo))return erro('Áudio e destino obrigatórios.',400)
 const mime=file.type.toLowerCase().split(';')[0].trim(),ext=MIMES[mime]
 if(!ext||file.size===0||file.size>MAX)return erro('Arquivo inválido. Use áudio de até 12 MB.',400)
 const id=crypto.randomUUID()
 const path='lembretes/'+usuario.empresa_id+'/'+usuario.id+'/'+id+'.'+ext
 const bytes=Buffer.from(await file.arrayBuffer())
 const {error:uploadError}=await supabaseAdmin.storage.from(BUCKET)
  .upload(path,bytes,{contentType:mime,upsert:false,cacheControl:'3600'})
 if(uploadError)return erro('Não foi possível guardar o áudio.',503)
 let transcricao:string|null=null
 try{
  const resultado=await transcreverAudioGratis(new File([bytes],'gravacao.'+ext,{type:mime}))
  transcricao=resultado.text?.trim()||null
 }catch{
  // O original já foi salvo; Whisper indisponível não deve apagar o áudio.
 }
 const {error}=await supabaseAdmin.from('lembretes_audios').insert({
  id,empresa_id:usuario.empresa_id,usuario_id:usuario.id,tipo,
  referencia_id:null,arquivo_path:path,mime_type:mime,
  tamanho_bytes:file.size,transcricao,
 })
 if(error){
  await supabaseAdmin.storage.from(BUCKET).remove([path])
  return erro('Não foi possível registrar o áudio no Atlas.',503)
 }
 return NextResponse.json({ok:true,id,transcricao,transcricaoPendente:!transcricao})
}

export async function PATCH(req:NextRequest){
 const usuario=await autenticarTenant(req)
 if(!usuario)return erro('Sessão inválida.',401)
 let body:Record<string,unknown>
 try{body=await req.json()}catch{return erro('Dados inválidos.',400)}
 const audioId=String(body.id||''),ref=String(body.referenciaId||'')
 if(!UUID.test(audioId)||!UUID.test(ref))return erro('Identificador inválido.',400)
 const {data:audio}=await supabaseAdmin.from('lembretes_audios')
  .select('id,tipo,referencia_id').eq('id',audioId)
  .eq('empresa_id',usuario.empresa_id).eq('usuario_id',usuario.id).maybeSingle()
 if(!audio)return erro('Áudio não encontrado.',404)
 if(audio.referencia_id===ref)return NextResponse.json({ok:true})
 if(audio.referencia_id)return erro('Este áudio já está vinculado.',409)
 const tabela=audio.tipo==='tarefa'?'tarefas':'eventos'
 const {data:alvo}=await supabaseAdmin.from(tabela)
  .select('*')
  .eq('id',ref).eq('empresa_id',usuario.empresa_id).maybeSingle()
 if(!alvo|| (alvo.usuario_id!==usuario.id && (audio.tipo!=='tarefa'||alvo.solicitante_id!==usuario.id)))
  return erro('Item não autorizado.',403)
 const {data,error}=await supabaseAdmin.from('lembretes_audios')
  .update({referencia_id:ref}).eq('id',audioId).eq('empresa_id',usuario.empresa_id)
  .eq('usuario_id',usuario.id).is('referencia_id',null).select('id').maybeSingle()
 if(error||!data)return erro('Não foi possível associar o áudio.',409)
 return NextResponse.json({ok:true})
}
export async function GET(req:NextRequest){
 const usuario=await autenticarTenant(req)
 if(!usuario)return erro('Sessão inválida.',401)
 const id=String(req.nextUrl.searchParams.get('id')||'')
 const referenciaId=String(req.nextUrl.searchParams.get('referenciaId')||'')
 const tipo=String(req.nextUrl.searchParams.get('tipo')||'')
 if(!UUID.test(id||referenciaId))return erro('Identificador inválido.',400)
 if(referenciaId && !['tarefa','agenda'].includes(tipo))return erro('Tipo inválido.',400)
 let query=supabaseAdmin.from('lembretes_audios').select('*').eq('empresa_id',usuario.empresa_id)
 if(id)query=query.eq('id',id)
 else query=query.eq('referencia_id',referenciaId).eq('tipo',tipo)
 const {data:audio}=await query.order('created_at',{ascending:false}).limit(1).maybeSingle()
 if(!audio)return erro('Áudio não encontrado.',404)
 let autorizado=audio.usuario_id===usuario.id
 if(!autorizado && audio.referencia_id){
  const {data:ref}=await supabaseAdmin.from(audio.tipo==='tarefa'?'tarefas':'eventos')
   .select('usuario_id').eq('id',audio.referencia_id).eq('empresa_id',usuario.empresa_id).maybeSingle()
  autorizado=ref?.usuario_id===usuario.id
 }
 if(!autorizado)return erro('Acesso negado.',403)
 const {data,error}=await supabaseAdmin.storage.from(BUCKET).createSignedUrl(audio.arquivo_path,600)
 if(error||!data)return erro('Não foi possível abrir o áudio.',503)
 return NextResponse.json({ok:true,id,audioUrl:data.signedUrl,transcricao:audio.transcricao})
}
