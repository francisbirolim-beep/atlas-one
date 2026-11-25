import {destinoVinculoAtlas,normalizarVinculoAtlas} from './atlasChatVinculo.ts'
type Canal={id:string;empresa_id:string;principal:boolean;ativo:boolean;usuario_id?:string|null}
type Existente={id:string;status?:string|null;responsavel_id?:string|null}
type Entrada={empresa:string;canal:Canal;telefone:string;jid:string|null;grupo:boolean;fromMe:boolean;existente:Existente|null;ativo:boolean;usuarios:string;numeros:string}
type Resultado={motivo:'desligado'|'fora_escopo'|'atendimento_aberto'|'identidade_ambigua'|'sem_vinculo'|'vendedor'|'central'|'indisponivel';destino?:string|null}
export async function avaliarRoteamentoAtlas(db:any,e:Entrada):Promise<Resultado>{
 if(!e.ativo)return {motivo:'desligado'}
 const telefone=normalizarVinculoAtlas(e.telefone)
 if(e.grupo||e.fromMe||!e.canal.principal||!e.canal.ativo||e.canal.empresa_id!==e.empresa||!telefone||!e.numeros.split(',').map(normalizarVinculoAtlas).includes(telefone))return {motivo:'fora_escopo'}
 if(e.existente&&e.existente.status!=='finalizado')return {motivo:'atendimento_aberto'}
 // LID e aliases precisam de reconciliação prévia; não adivinhar identidades.
 if(e.jid!==telefone+'@s.whatsapp.net')return {motivo:'identidade_ambigua'}
 try{
  const {data:conversas,error:ec}=await db.from('atendimento_conversas').select('id,status,whatsapp_chat_jid')
   .eq('empresa_id',e.empresa).eq('whatsapp_canal_id',e.canal.id).eq('whatsapp_chat_tipo','contato').eq('telefone',telefone).limit(2)
  if(ec||!Array.isArray(conversas))return {motivo:'indisponivel'}
  if(conversas.length>1||conversas.some((c:any)=>c.whatsapp_chat_jid!==e.jid||c.id!==e.existente?.id))return {motivo:'identidade_ambigua'}
  if(conversas.some((c:any)=>c.status!=='finalizado'))return {motivo:'atendimento_aberto'}
  const {data:v,error:ev}=await db.from('atlas_chat_vinculos').select('empresa_id,canal_id,telefone,responsavel_id').eq('empresa_id',e.empresa).eq('canal_id',e.canal.id).eq('telefone',telefone).maybeSingle()
  if(ev)return {motivo:'indisponivel'}
  if(!v)return {motivo:'sem_vinculo'}
  const user=v.responsavel_id
  let autorizado=false
  if(user&&e.usuarios.split(',').map(x=>x.trim()).includes(user)){
   const {data:u,error:eu}=await db.from('usuarios').select('id,role').eq('empresa_id',e.empresa).eq('id',user).maybeSingle()
   const {data:a,error:ea}=await db.from('atlas_chat_acessos').select('habilitado').eq('empresa_id',e.empresa).eq('usuario_id',user).maybeSingle()
   if(eu||ea)return {motivo:'indisponivel'}
   if(u&&a?.habilitado===true){
    if(u.role==='master'||e.canal.usuario_id===user)autorizado=true
    else{
     const {data:p,error:ep}=await db.from('atendimento_whatsapp_permissoes').select('pode_atender').eq('empresa_id',e.empresa).eq('canal_id',e.canal.id).eq('usuario_id',user).maybeSingle()
     if(ep)return {motivo:'indisponivel'}
     autorizado=p?.pode_atender===true
    }
   }
  }
  let central:string|null=null
  if(!autorizado){
   const {data:d,error:ed}=await db.from('atendimento_whatsapp_distribuicao').select('ativo,usuario_principal_id').eq('empresa_id',e.empresa).maybeSingle()
   if(ed)return {motivo:'indisponivel'}
   const candidato=d?.ativo===true?d.usuario_principal_id:e.canal.usuario_id
   if(candidato){
    const {data:u,error:eu}=await db.from('usuarios').select('id').eq('empresa_id',e.empresa).eq('id',candidato).maybeSingle()
    if(eu)return {motivo:'indisponivel'}
    central=u?.id||null
   }
  }
  const destino=destinoVinculoAtlas({ativo:true,empresa:e.empresa,canal:e.canal.id,principal:true,telefone,grupo:false,vinculo:v,existente:e.existente,responsavelAutorizado:autorizado,centralId:central})
  if(destino===undefined)return {motivo:'indisponivel'}
  return {motivo:autorizado?'vendedor':'central',destino}
 }catch{return {motivo:'indisponivel'}}
}
