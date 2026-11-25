import {comandoArroba,decidirArroba,type AtendenteArroba} from './atlasChatArroba.ts'
import {normalizarVinculoAtlas} from './atlasChatVinculo.ts'
type Entrada={ativo:boolean;empresa:string;canal:{id:string;empresa_id:string;principal:boolean;ativo:boolean;usuario_id?:string|null};telefone:string;jid:string|null;grupo:boolean;fromMe:boolean;texto:unknown;numeros:string;usuarios:string}
// Avaliação somente leitura. Não envia mensagem, altera responsável ou grava vínculo.
export async function avaliarArrobaEntrada(db:any,e:Entrada){
 const t=normalizarVinculoAtlas(e.telefone)
 if(!e.ativo||e.grupo||e.fromMe||!e.canal.principal||!e.canal.ativo||e.canal.empresa_id!==e.empresa||!t||e.jid!==t+'@s.whatsapp.net'||!e.numeros.split(',').map(normalizarVinculoAtlas).includes(t))return {tipo:'fora_escopo' as const}
 const comando=comandoArroba(e.texto)
 if(!comando)return {tipo:'normal' as const}
 try{
  if(comando.tipo==='central')return comando
  const {data:rows,error}=await db.from('atlas_chat_arrobas').select('usuario_id,apelido,nome_publico,publico').eq('empresa_id',e.empresa).eq('publico',true)
  if(error||!Array.isArray(rows))return {tipo:'indisponivel' as const}
  const autorizados:AtendenteArroba[]=[]
  const permitidos=new Set(e.usuarios.split(',').map(x=>x.trim()).filter(Boolean))
  for(const r of rows){
   if(!permitidos.has(r.usuario_id))continue
   if(comando.tipo==='usuario'&&r.apelido!==comando.apelido)continue
   const {data:u,error:eu}=await db.from('usuarios').select('id,role').eq('empresa_id',e.empresa).eq('id',r.usuario_id).maybeSingle()
   const {data:a,error:ea}=await db.from('atlas_chat_acessos').select('habilitado').eq('empresa_id',e.empresa).eq('usuario_id',r.usuario_id).maybeSingle()
   if(eu||ea)return {tipo:'indisponivel' as const}
   if(!u||a?.habilitado!==true)continue
   if(u.role!=='master'&&e.canal.usuario_id!==u.id){
    const {data:p,error:ep}=await db.from('atendimento_whatsapp_permissoes').select('pode_atender').eq('empresa_id',e.empresa).eq('canal_id',e.canal.id).eq('usuario_id',u.id).maybeSingle()
    if(ep)return {tipo:'indisponivel' as const}
    if(p?.pode_atender!==true)continue
   }
   autorizados.push(r)
  }
  return decidirArroba(e.texto,autorizados)
 }catch{return {tipo:'indisponivel' as const}}
}
