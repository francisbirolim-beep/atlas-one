type Contexto = {
  ativo: boolean
  usuarios: string
  empresa: string
  canal: { id?: string; principal?: boolean; ativo?: boolean; empresa_id?: string }
  conversa: { id?: string; empresa_id?: string; whatsapp_canal_id?: string; whatsapp_chat_tipo?: string; responsavel_id?: string | null; ocultar_da_caixa?: boolean | null }
  destinatario: string
}
export function ehUuid(valor: string | null | undefined): valor is string {
  return typeof valor === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(valor)
}
export function atlasChatNotificacao(ctx: Contexto) {
  const {ativo,usuarios,empresa,canal,conversa,destinatario}=ctx
  if(!ativo||!ehUuid(destinatario)||!usuarios.split(',').map(x=>x.trim()).includes(destinatario))return null
  if(!empresa||conversa.empresa_id!==empresa||canal.empresa_id!==empresa||canal.principal!==true||canal.ativo!==true||!canal.id||canal.id!==conversa.whatsapp_canal_id)return null
  if(conversa.whatsapp_chat_tipo!=='contato'||conversa.ocultar_da_caixa||conversa.responsavel_id!==destinatario||!ehUuid(conversa.id))return null
  return {
    titulo:'Atlas Chat · Nova mensagem',
    mensagem:'Abra o Atlas Chat para consultar sua conversa.',
    href:'/atlas-chat?usuario='+encodeURIComponent(destinatario)+'&conversaId='+encodeURIComponent(conversa.id),
  }
}
export function parametrosAtlasChat(params: URLSearchParams) {
  const query=new URLSearchParams()
  for(const chave of ['usuario','conversaId']){
    const valor=params.get(chave)
    if(ehUuid(valor))query.set(chave,valor)
  }
  return query.toString()
}
