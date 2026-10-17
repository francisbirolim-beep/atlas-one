/** Comandos conservadores: nunca aplicar sem contexto de tarefa e identidade confirmados. */
export type RespostaLembrete = { acao: 'concluir'|'nao_concluido'|'adiar'|'reagendar'|'esclarecer'; minutos?: number; dataHora?: string }
function normalizar(t:string){return t.normalize('NFKC').toLocaleLowerCase('pt-BR').replace(/\s+/g,' ').trim().replace(/[.!]+$/,'')}
function dataLocal(d:Date,z:string){
 const p=Object.fromEntries(new Intl.DateTimeFormat('en-US',{timeZone:z,year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(d).map(x=>[x.type,x.value]))
 return p.year+'-'+p.month+'-'+p.day
}
function horarioLocal(dia:string,h:number,m:number,z:string):Date|null {
 if(h<0||h>23||m<0||m>59)return null
 for(const offset of [-180,-120,-240,0,60,120]){
  const oh=String(Math.floor(Math.abs(offset)/60)).padStart(2,'0'),om=String(Math.abs(offset)%60).padStart(2,'0')
  const instante=new Date(dia+'T'+String(h).padStart(2,'0')+':'+String(m).padStart(2,'0')+':00'+(offset<0?'-':'+')+oh+':'+om)
  if(!Number.isFinite(instante.getTime()))continue
  const p=Object.fromEntries(new Intl.DateTimeFormat('en-US',{timeZone:z,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(instante).map(x=>[x.type,x.value]))
  if(p.year+'-'+p.month+'-'+p.day===dia&&Number(p.hour)===h&&Number(p.minute)===m)return instante
 }
 return null
}
export function interpretarRespostaLembrete(textoOriginal:string,opcoes:{contextoVerificado:boolean;agora?:Date;timezone?:string}):RespostaLembrete {
 const texto=normalizar(textoOriginal)
 if(!opcoes.contextoVerificado||!texto||texto.length>180)return {acao:'esclarecer'}
 if(/^(não|nao|ainda não|ainda nao|não fiz|nao fiz|não concluí|nao conclui|não enviei|nao enviei|não enviado|nao enviado|pendente)( ainda)?$/.test(texto))return {acao:'nao_concluido'}
 if(/^(sim|s|ok|feito|concluí|conclui|finalizei|resolvido|enviei|enviado|já concluí|ja conclui|sim,? concluí|sim,? conclui)$/.test(texto))return {acao:'concluir'}
 const adiar=texto.match(/^(?:adiar|adia|lembra|lembre)(?:-me|\s+me)?(?:\s+(?:por|daqui|em))?\s+(\d{1,3})\s*(minutos?|min|horas?|h|dias?|d)$/)
 if(adiar){
  const unidade=adiar[2],fator=unidade.startsWith('h')?60:unidade.startsWith('d')?1440:1
  const minutos=Number(adiar[1])*fator
  return minutos>=5&&minutos<=10080?{acao:'adiar',minutos}:{acao:'esclarecer'}
 }
 const reagendar=texto.match(/^(?:reagendar|reagenda|marcar|marca|lembra|lembre)(?:-me|\s+me)?(?:\s+para)?\s+(hoje|amanhã|amanha|\d{1,2}\/\d{1,2}(?:\/\d{4})?)\s+(?:às?\s+)?(\d{1,2})(?:[:h](\d{2}))?\s*(?:h|horas?)?$/)
 if(reagendar){
  const agora=opcoes.agora||new Date(),z=opcoes.timezone||'America/Sao_Paulo'
  const hoje=dataLocal(agora,z)
  let dia=hoje
  if(reagendar[1].startsWith('amanh')){
   const amanha=new Date(hoje+'T12:00:00Z');amanha.setUTCDate(amanha.getUTCDate()+1);dia=amanha.toISOString().slice(0,10)
  }else if(reagendar[1].includes('/')){
   const [d,m,y]=reagendar[1].split('/').map(Number)
   const ano=y||Number(hoje.slice(0,4));dia=ano+'-'+String(m).padStart(2,'0')+'-'+String(d).padStart(2,'0')
  }
  const data=horarioLocal(dia,Number(reagendar[2]),Number(reagendar[3]||0),z)
  if(data&&data.getTime()>agora.getTime())return {acao:'reagendar',dataHora:data.toISOString()}
 }
 return {acao:'esclarecer'}
}
export function textoLembreteWhatsApp(titulo:string,codigo:string){
 return 'Atlas One — Lembrete\n'+titulo.slice(0,150)+'\nCódigo: '+codigo+'\nResponda a ESTA mensagem: "concluí", "adiar 1 hora" ou "reagendar amanhã às 9h".'
}
