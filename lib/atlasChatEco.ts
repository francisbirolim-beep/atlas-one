type Linha={id:string;direcao:string;whatsapp_message_id?:string|null;texto?:string|null}
type Evento={dados?:{mensagem_id?:string;whatsapp_message_id?:string}|null}
// Só concilia quando a confirmação do gateway identifica ambos os registros.
// Não compara texto nem horário: mensagens iguais enviadas de propósito permanecem.
export function conciliarEcoAtlas<T extends Linha>(rows:readonly T[],eventos:readonly Evento[]):T[]{
 const provider=new Map(rows.filter(m=>m.direcao==='saida'&&m.whatsapp_message_id).map(m=>[m.whatsapp_message_id,m]))
 const porId=new Map(rows.map(m=>[m.id,m]))
 const ocultar=new Set<string>()
 for(const e of eventos){
  const d=e.dados
  if(!d?.mensagem_id||!d.whatsapp_message_id)continue
  const local=porId.get(d.mensagem_id),eco=provider.get(d.whatsapp_message_id)
  if(local&&eco&&local.id!==eco.id&&local.direcao==='saida'&&!local.whatsapp_message_id)ocultar.add(local.id)
 }
 return rows.filter(m=>!ocultar.has(m.id))
}
