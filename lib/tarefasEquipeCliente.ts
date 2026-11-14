import { tokenAtual } from '@/lib/auth'
import type { RepeticaoEquipe } from '@/lib/tarefasEquipeRecorrencia'

export type StatusEquipe = 'a_fazer'|'em_andamento'|'aguardando'|'concluido'
export type PrioridadeEquipe = 'baixa'|'normal'|'alta'|'urgente'
export type EquipeTarefa = {
  id:string; empresa_id:string; criado_por_id:string; criador_nome:string;
  titulo:string; descricao?:string|null; responsaveis_ids:string[]; responsaveis_nomes:string[];
  prioridade:PrioridadeEquipe; data_hora?:string|null; status:StatusEquipe;
  compartilhada:boolean; lote_id?:string|null; serie_id?:string|null;
  concluida_em?:string|null; concluidora_nome?:string|null; concluida_por_id?:string|null;
  iniciada_em?:string|null; created_at:string; updated_at:string;
  aviso?:{proximo_aviso_em:string; ultimo_aviso_em?:string|null; visto_em?:string|null}|null
}
export type EquipeComentario={id:string; autor_id:string; autor_nome:string; texto:string; created_at:string}
export type EquipeHistorico={id:string; autor_id:string; autor_nome:string; acao:string; detalhe?:string|null; created_at:string}
export type CriacaoEquipe={
  titulo:string; descricao?:string; responsaveisIds:string[]; prioridade:PrioridadeEquipe;
  dataHora?:string|null; modo:'compartilhada'|'individual';
  recorrencia:RepeticaoEquipe; recorrenciaValor?:number; diasSemana?:number[]
}

async function requisitar(url:string,init:RequestInit={}) {
  const token=await tokenAtual()
  if(!token) throw new Error('Sessão expirada. Entre novamente no Atlas.')
  const resposta=await fetch(url,{
    ...init,cache:'no-store',headers:{
      Authorization:'Bearer '+token,
      ...(init.body?{'Content-Type':'application/json'}:{}),
      ...(init.headers||{}),
    },
  })
  const json=await resposta.json().catch(()=>({}))
  if(!resposta.ok) throw new Error(json.error||'Não foi possível carregar a tarefa')
  return json
}

export async function listarEquipe():Promise<EquipeTarefa[]> {
  const dados=await requisitar('/api/tarefas/equipe')
  return Array.isArray(dados.tarefas)?dados.tarefas:[]
}
export async function criarEquipe(payload:CriacaoEquipe) {
  return requisitar('/api/tarefas/equipe',{method:'POST',body:JSON.stringify(payload)})
}
export async function movimentarEquipe(id:string,status:StatusEquipe) {
  return requisitar('/api/tarefas/equipe/'+encodeURIComponent(id),{
    method:'PATCH',body:JSON.stringify({status}),
  })
}
export async function detalhesEquipe(id:string):Promise<{tarefa:EquipeTarefa;comentarios:EquipeComentario[];historico:EquipeHistorico[]}> {
  return requisitar('/api/tarefas/equipe/'+encodeURIComponent(id))
}
export async function comentarEquipe(id:string,texto:string) {
  return requisitar('/api/tarefas/equipe/'+encodeURIComponent(id)+'/comentarios',{
    method:'POST',body:JSON.stringify({texto}),
  })
}
export async function adiarEquipe(id:string,acao:'ok'|'ver'|'15'|'60'|'240'|'amanha') {
  return requisitar('/api/tarefas/equipe/'+encodeURIComponent(id)+'/lembrete',{
    method:'PATCH',body:JSON.stringify({acao}),
  })
}
export function avisarMudancaEquipe(){
  if(typeof window!=='undefined') window.dispatchEvent(new Event('atlas:tarefas-equipe-atualizadas'))
}
