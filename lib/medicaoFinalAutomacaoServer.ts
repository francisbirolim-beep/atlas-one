import { createHash } from 'crypto'
import { supabaseAdmin as db } from '@/lib/supabaseAdmin'

export const EVENTO_AUTOMACAO_MEDIDA_FINAL = 'medicao_final_enviada_conferencia'

function idDaTarefa(medicaoId:string,usuarioId:string){
 const b=createHash('sha256').update(`atlas:medicao:revisao:${medicaoId}:${usuarioId}`).digest()
 b[6]=(b[6]&0x0f)|0x80
 b[8]=(b[8]&0x3f)|0x80
 const h=b.toString('hex')
 return `${h.slice(0,8)}-${h.slice(8,12)}-${h.slice(12,16)}-${h.slice(16,20)}-${h.slice(20,32)}`
}

export async function executarAutomacaoMedidaFinal(empresaId:string,medicaoId:string,solicitante:{id:string;nome:string}){
 const {data:cfg,error:erroCfg}=await db.from('workflow_automacoes')
  .select('id,ativo,criar_tarefa,notificar_usuario_ids')
  .eq('empresa_id',empresaId).eq('evento_chave',EVENTO_AUTOMACAO_MEDIDA_FINAL)
  .order('created_at',{ascending:false}).limit(1).maybeSingle()
 if(erroCfg)throw erroCfg
 if(!cfg?.ativo||!cfg.criar_tarefa)return {ativa:false,criadas:0,existentes:0}
 const ids=[...new Set((cfg.notificar_usuario_ids||[]) as string[])]
 if(!ids.length)throw new Error('Automação ativa sem destinatários configurados')
 const {data:m,error:erroM}=await db.from('medicoes_finais')
  .select('id,cliente_nome,obra_id,orcamento_id,cliente_id,status_operacional')
  .eq('empresa_id',empresaId).eq('id',medicaoId).maybeSingle()
 if(erroM)throw erroM
 // A rota de sincronização já confirmou elegibilidade e card existente.
 // Medições parciais aprovadas também podem receber revisão operacional.
 if(!m||!['concluido','aprovado','aguardando_conferencia','em_medicao'].includes(m.status_operacional||''))throw new Error('Status de medição não elegível')
 const {data:usuarios,error:erroU}=await db.from('usuarios')
  .select('id,nome').eq('empresa_id',empresaId).in('id',ids)
 if(erroU)throw erroU
 if((usuarios||[]).length!==ids.length)throw new Error('Responsável não disponível para a automação')
 const {data:obra,error:erroObra}=m.obra_id
  ?await db.from('obras').select('nome').eq('empresa_id',empresaId).eq('id',m.obra_id).maybeSingle()
  :{data:null,error:null}
 if(erroObra)throw erroObra
 const nomeObra=obra?.nome||m.cliente_nome||'Obra'
 const href='/producao/medicao-final/'+m.id
 let criadas=0,existentes=0
 for(const pessoa of usuarios||[]){
  const tarefaId=idDaTarefa(m.id,pessoa.id)
  const {data:existente,error:erroExistente}=await db.from('tarefas')
    .select('id').eq('id',tarefaId).eq('empresa_id',empresaId).maybeSingle()
  if(erroExistente)throw erroExistente
  if(!existente){
   const {data:colunas,error:erroColunas}=await db.from('tarefa_colunas')
     .select('id').eq('empresa_id',empresaId).eq('usuario_id',pessoa.id)
     .order('ordem',{ascending:true}).limit(1)
   if(erroColunas)throw erroColunas
   let colunaId=colunas?.[0]?.id
   if(!colunaId){
    const {data:coluna,error:erroNova}=await db.from('tarefa_colunas').insert({
     empresa_id:empresaId,usuario_id:pessoa.id,nome:'A fazer',ordem:0,
    }).select('id').single()
    if(erroNova)throw erroNova
    colunaId=coluna.id
   }
   const {error:erroTarefa}=await db.from('tarefas').insert({
    id:tarefaId,empresa_id:empresaId,usuario_id:pessoa.id,coluna_id:colunaId,
    titulo:`Conferir Medida Final · ${nomeObra}`,
    descricao:`[atlas-medicao-final:${m.id}]\nCliente: ${m.cliente_nome||'—'}\nObra: ${nomeObra}\nAbrir medição: ${href}\nConferir fotos e medidas, dar seguimento à produção.`,
    prioridade:'alta',solicitante_id:solicitante.id,solicitante_nome:solicitante.nome,
    atribuida_em:new Date().toISOString(),orcamento_id:m.orcamento_id,
    obra_id:m.obra_id,cliente_id:m.cliente_id,
   })
   if(erroTarefa&&erroTarefa.code!=='23505')throw erroTarefa
   if(erroTarefa)existentes++
   else criadas++
  }else existentes++
  const {error:erroNotificacao}=await db.from('notificacoes').insert({
   empresa_id:empresaId,usuario_id:pessoa.id,categoria:'operacao',tipo:'tarefa',
   titulo:'Nova Medida Final para conferir',
   mensagem:`Confira a Medida Final da obra ${nomeObra}.`,
   href,origem_tipo:'medicao_final_conferencia',origem_id:m.id,
   criado_por_id:solicitante.id,criado_por_nome:solicitante.nome,
  })
  if(erroNotificacao&&erroNotificacao.code!=='23505')throw erroNotificacao
 }
 return {ativa:true,criadas,existentes,total:ids.length}
}
