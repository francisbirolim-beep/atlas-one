import { supabase } from './supabase'
import { usuarioAtual } from './auth'

export type AtendimentoStatus='aguardando'|'em_atendimento'|'aguardando_cliente'|'transferido'|'finalizado'
export type AtendimentoConversa={id:string;telefone:string;cliente_id:string|null;status:AtendimentoStatus;responsavel_id:string|null;responsavel_nome:string|null;setor:string|null;ultima_mensagem_em:string|null;created_at:string;updated_at:string}
export type AtendimentoMensagem={id:string;conversa_id:string;sessao_id:string|null;direcao:'entrada'|'saida'|'interna';tipo:string;texto:string|null;media_url:string|null;usuario_id:string|null;usuario_nome:string|null;created_at:string}

export async function listarConversasAtendimento(){
 const {data,error}=await supabase.from('atendimento_conversas').select('*').order('ultima_mensagem_em',{ascending:false,nullsFirst:false}).order('created_at',{ascending:false})
 if(error) throw error; return (data||[]) as AtendimentoConversa[]
}
export async function listarMensagensAtendimento(conversaId:string){
 const {data,error}=await supabase.from('atendimento_mensagens').select('*').eq('conversa_id',conversaId).order('created_at')
 if(error) throw error; return (data||[]) as AtendimentoMensagem[]
}
export async function assumirAtendimento(conversaId:string){
 const u=await usuarioAtual(); if(!u) throw new Error('Usuário não autenticado')
 const agora=new Date().toISOString()
 const {data:s,error:e1}=await supabase.from('atendimento_sessoes').insert({conversa_id:conversaId,status:'em_atendimento',responsavel_id:u.id,responsavel_nome:u.nome,assigned_at:agora}).select('id').single()
 if(e1) throw e1
 const {error:e2}=await supabase.from('atendimento_conversas').update({status:'em_atendimento',responsavel_id:u.id,responsavel_nome:u.nome,updated_at:agora}).eq('id',conversaId).eq('status','aguardando')
 if(e2) throw e2
 await supabase.from('atendimento_eventos').insert({conversa_id:conversaId,sessao_id:s.id,tipo:'assumido',usuario_id:u.id,usuario_nome:u.nome})
 return s.id as string
}
export async function alterarStatusAtendimento(conversaId:string,status:AtendimentoStatus){
 const u=await usuarioAtual(); const agora=new Date().toISOString()
 const {error}=await supabase.from('atendimento_conversas').update({status,updated_at:agora}).eq('id',conversaId); if(error) throw error
 const {data:s}=await supabase.from('atendimento_sessoes').select('id').eq('conversa_id',conversaId).order('created_at',{ascending:false}).limit(1).maybeSingle()
 if(s?.id){await supabase.from('atendimento_sessoes').update({status,...(status==='finalizado'?{closed_at:agora}:{})}).eq('id',s.id)}
 await supabase.from('atendimento_eventos').insert({conversa_id:conversaId,sessao_id:s?.id||null,tipo:'status_alterado',usuario_id:u?.id||null,usuario_nome:u?.nome||null,dados:{status}})
}
export async function enviarMensagemAtendimento(conversaId:string,texto:string,interna=false){
 const limpo=texto.trim(); if(!limpo) return
 const u=await usuarioAtual(); if(!u) throw new Error('Usuário não autenticado')
 const agora=new Date().toISOString()
 const {data:s}=await supabase.from('atendimento_sessoes').select('id,first_response_at').eq('conversa_id',conversaId).order('created_at',{ascending:false}).limit(1).maybeSingle()
 const {error}=await supabase.from('atendimento_mensagens').insert({conversa_id:conversaId,sessao_id:s?.id||null,direcao:interna?'interna':'saida',tipo:'texto',texto:limpo,usuario_id:u.id,usuario_nome:u.nome}); if(error) throw error
 await supabase.from('atendimento_conversas').update({ultima_mensagem_em:agora,updated_at:agora}).eq('id',conversaId)
 if(!interna&&s?.id&&!s.first_response_at) await supabase.from('atendimento_sessoes').update({first_response_at:agora}).eq('id',s.id)
}
export function observarAtendimento(onChange:()=>void){
 const channel=supabase.channel('atlas-atendimento').on('postgres_changes',{event:'*',schema:'public',table:'atendimento_conversas'},onChange).on('postgres_changes',{event:'*',schema:'public',table:'atendimento_mensagens'},onChange).subscribe()
 return ()=>{void supabase.removeChannel(channel)}
}
