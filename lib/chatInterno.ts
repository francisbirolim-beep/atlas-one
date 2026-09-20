import { supabase } from './supabase'
import { primeiraColunaId } from './kanban'
import { registrarHistorico } from './historico'
import { usuarioAtual } from './auth'
import { v4 as uuidv4 } from 'uuid'

export type ChatConversa = { id:string; nome?:string|null; tipo:'direta'|'grupo'; criado_por_id?:string|null; criado_por_nome?:string|null; created_at:string; updated_at:string; ultima_mensagem?:string|null; ultima_mensagem_em?:string|null }
export type ChatMensagem = { id:string; conversa_id:string; usuario_id?:string|null; usuario_nome?:string|null; texto?:string|null; anexo_url?:string|null; anexo_nome?:string|null; cliente_id?:string|null; orcamento_id?:string|null; mensagem_pai_id?:string|null; created_at:string }
export type ChatParticipante = { id:string; conversa_id:string; usuario_id:string; usuario_nome?:string|null; ultima_leitura_em?:string|null }

export async function listarConversas(usuarioId:string):Promise<ChatConversa[]> {
  const { data: participacoes } = await supabase.from('chat_participantes').select('conversa_id').eq('usuario_id', usuarioId)
  const ids=(participacoes||[]).map((p:any)=>p.conversa_id)
  if(!ids.length) return []
  const { data }=await supabase.from('chat_conversas').select('*').in('id',ids).order('updated_at',{ascending:false})
  const conversas=(data||[]) as ChatConversa[]
  const {data:todosParticipantes}=await supabase.from('chat_participantes').select('conversa_id,usuario_id,usuario_nome').in('conversa_id',ids)
  const nomesDiretos=new Map<string,string>()
  for(const p of todosParticipantes||[]) if(p.usuario_id!==usuarioId&&!nomesDiretos.has(p.conversa_id)) nomesDiretos.set(p.conversa_id,p.usuario_nome)
  return await Promise.all(conversas.map(async c=>{const {data:m}=await supabase.from('chat_mensagens').select('texto,anexo_nome,anexo_url,created_at').eq('conversa_id',c.id).order('created_at',{ascending:false}).limit(1).maybeSingle();return {...c,nome:c.tipo==='direta'?(nomesDiretos.get(c.id)||c.nome):c.nome,ultima_mensagem:m?(m.texto||m.anexo_nome||(m.anexo_url?'📎 Anexo':null)):null,ultima_mensagem_em:m?.created_at||null}}))
}

export async function listarParticipantes(conversaId:string):Promise<ChatParticipante[]> {
  const { data }=await supabase.from('chat_participantes').select('*').eq('conversa_id',conversaId).order('usuario_nome')
  return (data||[]) as ChatParticipante[]
}

export async function marcarConversaComoLida(conversaId:string,usuarioId:string):Promise<boolean> {
  const {error}=await supabase.from('chat_participantes').update({ultima_leitura_em:new Date().toISOString()}).eq('conversa_id',conversaId).eq('usuario_id',usuarioId)
  return !error
}

export async function contarNaoLidas(conversaId:string,usuarioId:string):Promise<number> {
  const {data:p}=await supabase.from('chat_participantes').select('ultima_leitura_em').eq('conversa_id',conversaId).eq('usuario_id',usuarioId).maybeSingle()
  let q=supabase.from('chat_mensagens').select('id',{count:'exact',head:true}).eq('conversa_id',conversaId).neq('usuario_id',usuarioId)
  if(p?.ultima_leitura_em) q=q.gt('created_at',p.ultima_leitura_em)
  const {count}=await q
  return count||0
}

export async function listarMensagens(conversaId:string):Promise<ChatMensagem[]> {
  const { data }=await supabase.from('chat_mensagens').select('*').eq('conversa_id',conversaId).order('created_at',{ascending:false}).limit(500)
  return ((data||[]) as ChatMensagem[]).reverse()
}

export async function criarConversa(nome:string,tipo:'direta'|'grupo',participantes:{id:string;nome:string}[]):Promise<ChatConversa|null> {
  const usuario=await usuarioAtual()
  if(!usuario) return null
  const participantesValidos=[...new Map(participantes.filter(p=>p.id&&p.id!==usuario.id).map(p=>[p.id,{id:p.id,nome:(p.nome||'Usuário').trim()||'Usuário'}])).values()]
  if(!participantesValidos.length) return null
  if(tipo==='direta'&&participantesValidos.length!==1) return null
  if(tipo==='grupo'&&participantesValidos.length<2) return null
  const nomeSeguro=nome.trim().slice(0,100)
  if(tipo==='direta'&&participantesValidos.length===1){
    const outro=participantesValidos[0]
    const {data:minhas}=await supabase.from('chat_participantes').select('conversa_id').eq('usuario_id',usuario.id)
    const ids=(minhas||[]).map((p:any)=>p.conversa_id)
    if(ids.length){
      const {data:dele}=await supabase.from('chat_participantes').select('conversa_id').eq('usuario_id',outro.id).in('conversa_id',ids)
      for(const p of dele||[]){
        const {data:conv}=await supabase.from('chat_conversas').select('*').eq('id',p.conversa_id).eq('tipo','direta').maybeSingle()
        if(!conv) continue
        const {count}=await supabase.from('chat_participantes').select('id',{count:'exact',head:true}).eq('conversa_id',conv.id)
        if(count===2) return conv as ChatConversa
      }
    }
  }
  const { data,error }=await supabase.from('chat_conversas').insert({nome:nomeSeguro||null,tipo,criado_por_id:usuario.id,criado_por_nome:usuario.nome}).select('*').single()
  if(error||!data) return null
  const unicos=new Map([[usuario.id,{id:usuario.id,nome:usuario.nome}],...participantesValidos.map(p=>[p.id,p] as const)])
  const {error:participantesError}=await supabase.from('chat_participantes').insert([...unicos.values()].map(p=>({conversa_id:data.id,usuario_id:p.id,usuario_nome:p.nome})))
  if(participantesError){await supabase.from('chat_conversas').delete().eq('id',data.id);return null}
  return data as ChatConversa
}

export async function enviarMensagem(conversaId:string,texto:string,extras?:{clienteId?:string|null;orcamentoId?:string|null;mensagemPaiId?:string|null;anexoUrl?:string|null;anexoNome?:string|null}):Promise<boolean> {
  const usuario=await usuarioAtual()
  const mensagem=texto.trim()
  const anexoUrl=extras?.anexoUrl?.trim()||null
  const anexoNome=extras?.anexoNome?.trim()||null
  if(!usuario||(!mensagem&&!anexoUrl)||mensagem.length>10000||(anexoNome?.length||0)>255) return false
  if(anexoUrl){try{const url=new URL(anexoUrl);if(url.protocol!=='https:')return false}catch{return false}}
  const {data:participacao}=await supabase.from('chat_participantes').select('id').eq('conversa_id',conversaId).eq('usuario_id',usuario.id).maybeSingle()
  if(!participacao) return false
  const { error }=await supabase.from('chat_mensagens').insert({conversa_id:conversaId,usuario_id:usuario.id,usuario_nome:usuario.nome,texto:mensagem||null,anexo_url:anexoUrl,anexo_nome:anexoNome,cliente_id:extras?.clienteId||null,orcamento_id:extras?.orcamentoId||null,mensagem_pai_id:extras?.mensagemPaiId||null})
  if(error) return false
  await supabase.from('chat_conversas').update({updated_at:new Date().toISOString()}).eq('id',conversaId)
  return true
}

export async function criarPedidoCompartilhado(params:{clienteId:string;texto:string}):Promise<{ok:boolean;id?:string;error?:string}> {
  const usuario=await usuarioAtual()
  const [{data:cliente},colunaId]=await Promise.all([
    supabase.from('clientes').select('id,nome,whatsapp,cidade').eq('id',params.clienteId).maybeSingle(),
    primeiraColunaId(),
  ])
  if(!cliente) return {ok:false,error:'Cliente não encontrado.'}
  if(!params.texto.trim()) return {ok:false,error:'Cole ou compartilhe a mensagem do cliente.'}
  const id=uuidv4()
  const { error }=await supabase.from('orcamentos').insert({
    id,cliente_id:cliente.id,cliente_nome:cliente.nome,cliente_whatsapp:cliente.whatsapp||null,cidade:cliente.cidade||null,
    origem:'whatsapp',tipo_esquadria:'outro',largura_mm:0,altura_mm:0,quantidade:1,itens:[],
    descricao_livre:params.texto.trim(),observacoes:params.texto.trim(),valor_estimado:null,status:'rascunho',
    modo_entrada:'texto_livre',coluna_id:colunaId,coluna_atualizada_em:new Date().toISOString(),
    revisao_grupo_id:id,criado_por_nome:usuario?.nome||null,criado_por_id:usuario?.id||null,
  })
  if(error) return {ok:false,error:error.message}
  await registrarHistorico(id,usuario,'Recebeu pedido compartilhado do WhatsApp',params.texto.trim().slice(0,1000))
  return {ok:true,id}
}

export async function anexarAoPedido(orcamentoId:string,texto:string):Promise<boolean> {
  const usuario=await usuarioAtual()
  const { data }=await supabase.from('orcamentos').select('observacoes').eq('id',orcamentoId).maybeSingle()
  if(!data||!texto.trim()) return false
  const bloco=`[${new Date().toLocaleString('pt-BR')}] ${usuario?.nome||'Usuário'}\n${texto.trim()}`
  const observacoes=[data.observacoes,bloco].filter(Boolean).join('\n\n')
  const { error }=await supabase.from('orcamentos').update({observacoes}).eq('id',orcamentoId)
  if(error) return false
  await registrarHistorico(orcamentoId,usuario,'Adicionou informação compartilhada',texto.trim().slice(0,1000))
  return true
}
