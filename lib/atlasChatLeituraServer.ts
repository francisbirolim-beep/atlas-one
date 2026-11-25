import {conciliarEcoAtlas} from '@/lib/atlasChatEco'
import {supabaseAdmin} from '@/lib/supabaseAdmin'
import {caminhoLeituraAtlas,type CursorAtlasChat} from '@/lib/atlasChatLeitura'

// Somente a conversa já autorizada pelo endpoint individual. Não reutilizar
// a agregação de aliases da central, que pode incluir outros responsáveis.
export async function lerMensagensAtlas(empresa:string,conversa:string,antes?:CursorAtlasChat|null,usuario?:string){
  let query=supabaseAdmin.from('atendimento_mensagens')
    .select('id,conversa_id,direcao,tipo,texto,media_url,mime_type,payload,whatsapp_message_id,usuario_nome,created_at')
    .eq('empresa_id',empresa).eq('conversa_id',conversa)
    .order('created_at',{ascending:false}).order('id',{ascending:false}).limit(251)
  if(antes)query=query.or(`created_at.lt.${antes.em},and(created_at.eq.${antes.em},id.lt.${antes.id})`)
  const {data,error}=usuario
    ? await supabaseAdmin.rpc('atlas_chat_mensagens_individuais',{p_empresa:empresa,p_usuario:usuario,p_conversa:conversa,p_antes_em:antes?.em||null,p_antes_id:antes?.id||null}).select('id,conversa_id,direcao,tipo,texto,media_url,mime_type,payload,whatsapp_message_id,usuario_nome,created_at').order('created_at',{ascending:false}).order('id',{ascending:false})
    : await query
  if(error)throw error
  type MensagemAtlas={id:string;conversa_id:string;direcao:string;tipo:string;texto:string|null;media_url:string|null;mime_type:string|null;payload:{fileName?:unknown}|null;whatsapp_message_id:string|null;usuario_nome:string|null;created_at:string}
  const registros=(Array.isArray(data)?data:[]) as MensagemAtlas[]
  const pagina=registros.slice(0,250).reverse()
  let rows=pagina
  const pendentes=pagina.filter(m=>m.direcao==='saida'&&!m.whatsapp_message_id).map(m=>m.id)
  if(pendentes.length&&pagina.some(m=>m.direcao==='saida'&&m.whatsapp_message_id)){
    const {data:eventos,error:erroEventos}=await supabaseAdmin.from('atendimento_eventos').select('dados')
      .eq('empresa_id',empresa).eq('conversa_id',conversa).eq('tipo','mensagem_enviada_qr')
      .in('dados->>mensagem_id',pendentes)
    if(!erroEventos)rows=conciliarEcoAtlas(pagina,eventos||[])
  }
  const paths=[...new Set(rows.map(m=>String(m.media_url||'')).filter(p=>caminhoLeituraAtlas(p,empresa)))]
  const urls=new Map<string,string>()
  if(paths.length){
    const {data:signed,error:e}=await supabaseAdmin.storage.from('whatsapp-midia').createSignedUrls(paths,600)
    if(!e)for(const item of signed||[])if(item.path&&item.signedUrl)urls.set(item.path,item.signedUrl)
  }
  const temAnteriores=registros.length>250
  const proximaPagina=temAnteriores&&pagina[0]?{em:pagina[0].created_at,id:pagina[0].id}:null
  return {temAnteriores,proximaPagina,mensagens:rows.map(({payload,media_url,...m})=>({...m,media_url:urls.get(String(media_url||''))||null,arquivo_nome:payload&&typeof payload==='object'?String(payload.fileName||'')||null:null}))}
}
