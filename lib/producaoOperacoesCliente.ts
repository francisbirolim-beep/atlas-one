'use client'

import { tokenAtual } from './auth'
import type { SetorKanbanColuna } from './tipos'
import type { OrdemProducao } from './ordensProducao'

// Escrita feita pela API, que confere tenant, ação e integridade dos IDs recebidos.
// Não efetua fallback de gravação diretamente no Supabase em caso de erro.
async function operar<T>(acao:string,campos:Record<string,unknown>):Promise<T> {
 const token=await tokenAtual()
 if(!token)throw new Error('Sessão expirada.')
 const resp=await fetch('/api/producao/operacoes',{
  method:'POST',
  headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},
  body:JSON.stringify({acao,...campos}),
  cache:'no-store',
 })
 const dados=await resp.json().catch(()=>({}))
 if(!resp.ok||dados.ok!==true)throw new Error(dados.error||'Não foi possível salvar a Produção.')
 return dados as T
}

export async function criarEtapaProducao(nome:string,descricao?:string):Promise<SetorKanbanColuna|null> {
 try{
  const r=await operar<{coluna:SetorKanbanColuna}>('criar_etapa',{nome,descricao})
  return r.coluna
 }catch(e){console.warn('[Produção] Criar etapa recusado:',e);return null}
}

export async function editarEtapaProducao(id:string,campos:{nome:string;descricao?:string|null}):Promise<SetorKanbanColuna|null> {
 try{
  const r=await operar<{coluna:SetorKanbanColuna}>('editar_etapa',{colunaId:id,...campos})
  return r.coluna
 }catch(e){console.warn('[Produção] Editar etapa recusado:',e);return null}
}

export async function editarCardProducao(id:string,campos:{titulo:string;descricao:string|null}):Promise<boolean> {
 try{await operar('editar_card',{cardId:id,...campos});return true}
 catch(e){console.warn('[Produção] Editar card recusado:',e);return false}
}

export async function moverCardProducao(id:string,colunaId:string):Promise<boolean> {
 try{await operar('mover_card',{cardId:id,colunaId});return true}
 catch(e){console.warn('[Produção] Mover card recusado:',e);return false}
}

export async function avancarOrdemProducao(id:string,status:OrdemProducao['status']):Promise<{ok:boolean;error?:string}> {
 try{await operar('avancar_ordem',{ordemId:id,status});return {ok:true}}
 catch(e){return {ok:false,error:e instanceof Error?e.message:'Falha ao avançar a ordem.'}}
}

export async function criarOrdemProducaoSegura(dados:{
 clienteId?:string|null
 obraId?:string|null
 vendaId?:string|null
 orcamentoId?:string|null
 tipoProducao:OrdemProducao['tipo_producao']
 titulo:string
 quantidade:number
 larguraMm?:number|null
 alturaMm?:number|null
}):Promise<{ok:boolean;ordem?:OrdemProducao;error?:string}> {
 try{
  const r=await operar<{ordem:OrdemProducao}>('criar_ordem',dados)
  return {ok:true,ordem:r.ordem}
 }catch(e){return {ok:false,error:e instanceof Error?e.message:'Falha ao criar a ordem.'}}
}

// Apenas registra a liberação após o fluxo técnico ter aprovado a medição e
// gerado o pacote. O backend repete essas verificações antes de escrever.
export async function marcarCardLiberadoProducaoSeguro(
 cardId:string,colunaDestinoId:string|null,
):Promise<{ok:boolean;error?:string}> {
 try{
  await operar('marcar_liberado',{cardId,colunaId:colunaDestinoId})
  return {ok:true}
 }catch(e){
  return {ok:false,error:e instanceof Error?e.message:'Falha ao registrar liberação.'}
 }
}
