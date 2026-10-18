import {createHash,randomUUID} from 'node:crypto'
import {NextRequest,NextResponse} from 'next/server'
import {autenticarTenant,type UsuarioTenant} from '@/lib/tenantServer'
import {nivelAcaoUsuarioServer} from '@/lib/acessoUsuarioServer'
import {supabaseAdmin} from '@/lib/supabaseAdmin'
import {ehUUID} from '@/lib/marketing/editorialRegras'
import {conteudoMidiaValido,formatoPermitido,FORMATOS_MIDIA_MARKETING,LIMITE_MIDIA_MARKETING,nomeMidiaValido} from '@/lib/marketing/midiaRegras'

export const runtime='nodejs'
export const dynamic='force-dynamic'
const BUCKET='atlas-marketing'
const NO_CACHE={'Cache-Control':'no-store'}
const responder=(v:unknown,status=200)=>NextResponse.json(v,{status,headers:NO_CACHE})
const erro=(m:string,s:number)=>responder({error:m},s)

async function usuarioComEdicao(req:NextRequest):Promise<{usuario:UsuarioTenant}|{resposta:NextResponse}> {
  const usuario=await autenticarTenant(req)
  if(!usuario)return {resposta:erro('Sessão inválida.',401)}
  try{
    const nivel=await nivelAcaoUsuarioServer({
      usuarioId:usuario.id,role:usuario.role,setorId:'marketing',
      acaoId:'marketing.biblioteca',empresaId:usuario.empresa_id,
    })
    if(nivel!=='edicao')return {resposta:erro('Sem permissão para enviar mídia.',403)}
    return {usuario}
  }catch{return {resposta:erro('Falha ao confirmar permissão.',503)}}
}

/**
 * Fluxo direto para arquivos maiores que o limite da função de hospedagem:
 * solicitar_url -> uploadToSignedUrl no navegador -> finalizar.
 * Nenhuma confirmação da mídia cria postagem ou autoriza divulgação.
 */
export async function POST(req:NextRequest){
  if(process.env.MARKETING_BACKEND_ENABLED!=='true')
    return erro('Upload direto ainda em homologação.',503)
  const acesso=await usuarioComEdicao(req)
  if('resposta' in acesso)return acesso.resposta
  const u=acesso.usuario
  let recebido:unknown
  try{recebido=await req.json()}catch{return erro('JSON inválido.',400)}
  if(!recebido||typeof recebido!=='object'||Array.isArray(recebido))
    return erro('Dados inválidos.',400)
  const p=recebido as Record<string,unknown>

  if(p.acao==='solicitar_url'){
    if(!nomeMidiaValido(p.nome)||!formatoPermitido(p.tipo_mime)
      ||typeof p.tamanho_bytes!=='number'||!Number.isSafeInteger(p.tamanho_bytes)
      ||p.tamanho_bytes<12||p.tamanho_bytes>LIMITE_MIDIA_MARKETING)
      return erro('Arquivo inválido. Limite: 30 MB.',422)
    const obraId=p.obra_id==null||p.obra_id===''?null:p.obra_id
    if(obraId!==null&&!ehUUID(obraId))return erro('Obra inválida.',422)
    if(obraId){
      const obra=await supabaseAdmin.from('obras').select('id')
        .eq('empresa_id',u.empresa_id).eq('id',obraId).maybeSingle()
      if(obra.error)return erro('Falha ao conferir a obra.',503)
      if(!obra.data)return erro('Obra não pertence à empresa.',404)
    }
    const pendentes=await supabaseAdmin.from('marketing_uploads_pendentes')
      .select('id',{count:'exact',head:true})
      .eq('empresa_id',u.empresa_id).eq('usuario_id',u.id)
      .eq('status','pendente').gt('expira_em',new Date().toISOString())
    if(pendentes.error||pendentes.count==null)return erro('Falha ao conferir limite de uploads.',503)
    if(pendentes.count>=20)return erro('Há uploads pendentes demais. Finalize os anteriores.',429)

    const id=randomUUID()
    const path=`${u.empresa_id}/${id}/original.${FORMATOS_MIDIA_MARKETING[p.tipo_mime]}`
    const inserido=await supabaseAdmin.from('marketing_uploads_pendentes').insert({
      id,empresa_id:u.empresa_id,usuario_id:u.id,obra_id:obraId,
      nome:p.nome.trim(),tipo_mime:p.tipo_mime,tamanho_bytes:p.tamanho_bytes,storage_path:path,
      status:'pendente',expira_em:new Date(Date.now()+30*60*1000).toISOString(),
    }).select('id,expira_em').single()
    if(inserido.error)return erro('Não foi possível reservar upload privado.',503)
    const assinado=await supabaseAdmin.storage.from(BUCKET).createSignedUploadUrl(path,{upsert:false})
    if(assinado.error||!assinado.data?.token||!assinado.data?.signedUrl)
      return erro('Não foi possível autorizar o envio ao armazenamento privado.',503)
    return responder({
      upload_id:id,path,token:assinado.data.token,url:assinado.data.signedUrl,
      expira_em:inserido.data.expira_em,
      instrucoes:'Enviar apenas pelo uploadToSignedUrl oficial e finalizar. Direitos de divulgação seguem pendentes.',
    },201)
  }

  if(p.acao==='finalizar'){
    if(!ehUUID(p.upload_id))return erro('Upload inválido.',400)
    const consulta=await supabaseAdmin.from('marketing_uploads_pendentes')
      .select('id,empresa_id,usuario_id,obra_id,nome,tipo_mime,tamanho_bytes,storage_path,status,expira_em')
      .eq('id',p.upload_id).eq('empresa_id',u.empresa_id).eq('usuario_id',u.id).maybeSingle()
    if(consulta.error)return erro('Falha ao verificar o upload.',503)
    const pendente=consulta.data
    if(!pendente)return erro('Upload não encontrado.',404)
    if(pendente.status==='confirmado'){
      const registrado=await supabaseAdmin.from('marketing_midias')
        .select('id,nome,versao,direitos_confirmados').eq('empresa_id',u.empresa_id)
        .eq('upload_id',pendente.id).maybeSingle()
      if(registrado.error)return erro('Falha ao conferir mídia registrada.',503)
      return registrado.data?responder({midia:registrado.data,publicada:false}):
        erro('Upload ainda não sincronizado. Tente novamente.',409)
    }
    if(pendente.status!=='pendente'||new Date(pendente.expira_em).getTime()<=Date.now())
      return erro('Reserva expirada. Inicie outro envio.',410)
    if(!pendente.storage_path.startsWith(u.empresa_id+'/'))
      return erro('Arquivo de outra empresa.',403)
    if(!formatoPermitido(pendente.tipo_mime))
      return erro('Formato da reserva inválido.',422)
    const result=await supabaseAdmin.storage.from(BUCKET).download(pendente.storage_path)
    if(result.error||!result.data)return erro('Arquivo ainda não enviado. Faça upload antes de finalizar.',409)
    if(result.data.size!==pendente.tamanho_bytes)
      return erro('Tamanho armazenado divergente; mídia não aceita.',422)
    const bytes=Buffer.from(await result.data.arrayBuffer())
    if(bytes.length!==pendente.tamanho_bytes||!conteudoMidiaValido(pendente.tipo_mime,bytes))
      return erro('Arquivo armazenado não corresponde ao formato autorizado.',415)
    const hash=createHash('sha256').update(bytes).digest('hex')
    const gravado=await supabaseAdmin.from('marketing_midias').insert({
      empresa_id:u.empresa_id,obra_id:pendente.obra_id,
      upload_id:pendente.id,nome:pendente.nome,
      tipo_mime:pendente.tipo_mime,tamanho_bytes:bytes.length,
      storage_path:pendente.storage_path,hash_sha256:hash,
      direitos_confirmados:false,criado_por_id:u.id,alterado_por_id:u.id,
    }).select('id,nome,versao,direitos_confirmados').single()
    if(gravado.error){
      // Nunca apaga o original nesta fase: pode haver confirmação concorrente.
      const existente=await supabaseAdmin.from('marketing_midias')
        .select('id,nome,versao,direitos_confirmados')
        .eq('empresa_id',u.empresa_id).eq('upload_id',pendente.id).maybeSingle()
      if(existente.error||!existente.data)return erro('Falha ao registrar mídia. Tente finalizar novamente.',503)
      return responder({midia:existente.data,publicada:false})
    }
    const marcado=await supabaseAdmin.from('marketing_uploads_pendentes')
      .update({status:'confirmado'}).eq('id',pendente.id).eq('empresa_id',u.empresa_id)
      .eq('usuario_id',u.id).eq('status','pendente')
    if(marcado.error)console.error('[marketing] Upload registrado, status pendente para reconciliação')
    return responder({midia:gravado.data,publicada:false},201)
  }
  return erro('Ação desconhecida.',400)
}
