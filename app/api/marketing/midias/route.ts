import { createHash, randomUUID } from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'
import { autenticarTenant, type UsuarioTenant } from '@/lib/tenantServer'
import { nivelAcaoUsuarioServer } from '@/lib/acessoUsuarioServer'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { ehUUID, revisaoValida } from '@/lib/marketing/editorialRegras'
import { conteudoMidiaValido, evidenciaDireitosValida, formatoPermitido,
  FORMATOS_MIDIA_MARKETING, LIMITE_MIDIA_MARKETING, nomeMidiaValido } from '@/lib/marketing/midiaRegras'

export const runtime='nodejs'
export const dynamic='force-dynamic'
const BUCKET='atlas-marketing'
const SEM_CACHE={'Cache-Control':'no-store'}
const erro=(texto:string,status:number)=>NextResponse.json({error:texto},{status,headers:SEM_CACHE})
function inativo(){return process.env.MARKETING_BACKEND_ENABLED!=='true'}

async function acesso(req:NextRequest,modo:'consulta'|'edicao'):
  Promise<{usuario:UsuarioTenant}|{resposta:NextResponse}> {
  const usuario=await autenticarTenant(req)
  if(!usuario)return {resposta:erro('Sessão inválida.',401)}
  try {
    const nivel=await nivelAcaoUsuarioServer({
      usuarioId:usuario.id,role:usuario.role,setorId:'marketing',
      acaoId:'marketing.biblioteca',empresaId:usuario.empresa_id,
    })
    if(nivel==='oculto'||(modo==='edicao'&&nivel!=='edicao'))
      return {resposta:erro('Sem permissão para a biblioteca.',403)}
    return {usuario}
  }catch {return {resposta:erro('Não foi possível conferir as permissões.',503)}}
}

/** Prévia temporária de um original privado; nenhum link público permanente. */
export async function GET(req:NextRequest){
  if(inativo())return erro('Biblioteca do Marketing ainda em homologação.',503)
  const auth=await acesso(req,'consulta')
  if('resposta' in auth)return auth.resposta
  const id=req.nextUrl.searchParams.get('id')
  if(!ehUUID(id))return erro('Mídia inválida.',400)
  const {data:midia,error:falha}=await supabaseAdmin.from('marketing_midias')
    .select('id,storage_path,tipo_mime').eq('empresa_id',auth.usuario.empresa_id)
    .eq('id',id).maybeSingle()
  if(falha)return erro('Falha ao consultar a mídia.',503)
  if(!midia)return erro('Mídia não encontrada.',404)
  if(!midia.storage_path.startsWith(auth.usuario.empresa_id+'/'))
    return erro('Arquivo não pertence à empresa.',403)
  const {data,error}=await supabaseAdmin.storage.from(BUCKET)
    .createSignedUrl(midia.storage_path,60)
  if(error||!data?.signedUrl)return erro('Não foi possível abrir o arquivo.',503)
  return NextResponse.json({url:data.signedUrl,expiraEmSegundos:60,tipo:midia.tipo_mime},{headers:SEM_CACHE})
}

export async function POST(req:NextRequest){
  if(inativo())return erro('Biblioteca do Marketing ainda em homologação.',503)
  const auth=await acesso(req,'edicao')
  if('resposta' in auth)return auth.resposta
  const u=auth.usuario
  const declarado=Number(req.headers.get('content-length')||0)
  if(Number.isFinite(declarado)&&declarado>LIMITE_MIDIA_MARKETING+1024*1024)
    return erro('Arquivo maior que o limite de 30 MB.',413)

  let corpo:FormData
  try{corpo=await req.formData()}catch{return erro('Envie uma mídia por formulário.',400)}
  const arquivo=corpo.get('arquivo')
  if(!arquivo||typeof arquivo==='string'||typeof arquivo.arrayBuffer!=='function'
      ||typeof arquivo.size!=='number'||!nomeMidiaValido(arquivo.name))
    return erro('Selecione uma foto ou vídeo válido.',422)
  if(arquivo.size<12||arquivo.size>LIMITE_MIDIA_MARKETING)
    return erro('Arquivo vazio ou maior que 30 MB.',413)
  if(!formatoPermitido(arquivo.type))return erro('Formato de mídia não permitido.',415)

  const obraRaw=corpo.get('obra_id')
  const obraId=typeof obraRaw==='string'&&obraRaw.trim()?obraRaw.trim():null
  if(obraId!==null&&!ehUUID(obraId))return erro('Obra inválida.',422)
  if(obraId){
    const {data:obra,error}=await supabaseAdmin.from('obras')
      .select('id').eq('id',obraId).eq('empresa_id',u.empresa_id).maybeSingle()
    if(error)return erro('Não foi possível verificar a obra.',503)
    if(!obra)return erro('Obra não pertence à empresa.',404)
  }

  // Original guardado em bucket privado; sem tratamento de IA e sem autorização automática.
  const bin=Buffer.from(await arquivo.arrayBuffer())
  if(bin.length!==arquivo.size||!conteudoMidiaValido(arquivo.type,bin))
    return erro('O conteúdo não corresponde ao formato declarado.',415)
  const path=`${u.empresa_id}/${randomUUID()}/original.${FORMATOS_MIDIA_MARKETING[arquivo.type]}`
  const sha256=createHash('sha256').update(bin).digest('hex')
  const envio=await supabaseAdmin.storage.from(BUCKET)
    .upload(path,bin,{contentType:arquivo.type,upsert:false,cacheControl:'0'})
  if(envio.error)return erro('Não foi possível guardar a mídia.',503)
  const gravado=await supabaseAdmin.from('marketing_midias').insert({
    empresa_id:u.empresa_id,obra_id:obraId,nome:arquivo.name.trim().slice(0,240),
    tipo_mime:arquivo.type,tamanho_bytes:bin.length,storage_path:path,
    hash_sha256:sha256,direitos_confirmados:false,
    criado_por_id:u.id,alterado_por_id:u.id,
  }).select('id,nome,tipo_mime,tamanho_bytes,direitos_confirmados,versao,obra_id').single()
  if(gravado.error){
    // Compensação segura: evita deixar arquivo sem registro em erro de banco.
    const retirada=await supabaseAdmin.storage.from(BUCKET).remove([path])
    if(retirada.error)console.error('[marketing] Falha na compensação do arquivo sem registro')
    return erro('Não foi possível registrar a mídia.',503)
  }
  return NextResponse.json({midia:gravado.data,publicada:false},{status:201,headers:SEM_CACHE})
}

export async function PATCH(req:NextRequest){
  if(inativo())return erro('Biblioteca do Marketing ainda em homologação.',503)
  const auth=await acesso(req,'edicao')
  if('resposta' in auth)return auth.resposta
  let corpo:unknown
  try{corpo=await req.json()}catch{return erro('JSON inválido.',400)}
  if(!corpo||typeof corpo!=='object'||Array.isArray(corpo))return erro('Dados inválidos.',400)
  const p=corpo as Record<string,unknown>
  if(!ehUUID(p.id)||!revisaoValida(p.versao)||typeof p.autorizado!=='boolean')
    return erro('Mídia, versão ou autorização inválida.',400)

  const patch:Record<string,unknown>={alterado_por_id:auth.usuario.id,versao:p.versao+1}
  if(p.autorizado){
    if(!evidenciaDireitosValida(p.evidencia))
      return erro('Informe como foi obtida a autorização para divulgar a imagem.',422)
    Object.assign(patch,{direitos_confirmados:true,evidencia_autorizacao:p.evidencia.trim(),
      autorizado_por_id:auth.usuario.id,autorizado_em:new Date().toISOString()})
  }else{
    Object.assign(patch,{direitos_confirmados:false,
      autorizado_por_id:null,autorizado_em:null})
  }
  const gravado=await supabaseAdmin.from('marketing_midias').update(patch)
    .eq('id',p.id).eq('empresa_id',auth.usuario.empresa_id)
    .eq('versao',p.versao).select('id,direitos_confirmados,versao').maybeSingle()
  if(gravado.error)return erro('Não foi possível alterar a autorização.',503)
  if(!gravado.data)return erro('A mídia foi modificada. Atualize a tela.',409)
  return NextResponse.json({midia:gravado.data,publicada:false},{headers:SEM_CACHE})
}
