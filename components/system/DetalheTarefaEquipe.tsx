'use client'

import { useCallback, useEffect, useState } from 'react'
import { Check, Clock3, MessageCircle, Send, Users, X } from 'lucide-react'
import { usuarioAtual } from '@/lib/auth'
import { avisarMudancaEquipe, comentarEquipe, detalhesEquipe, movimentarEquipe, type EquipeComentario, type EquipeHistorico, type EquipeTarefa, type StatusEquipe } from '@/lib/tarefasEquipeCliente'

const ETAPAS: { valor:StatusEquipe; nome:string }[] = [
  {valor:'a_fazer',nome:'A fazer'}, {valor:'em_andamento',nome:'Em andamento'},
  {valor:'aguardando',nome:'Aguardando'}, {valor:'concluido',nome:'Concluído'},
]
function formatar(iso?:string|null){
  if(!iso)return 'Sem prazo'
  return new Intl.DateTimeFormat('pt-BR',{day:'2-digit',month:'2-digit',year:'numeric',
    hour:'2-digit',minute:'2-digit'}).format(new Date(iso))
}
export default function DetalheTarefaEquipe({id,onFechar}:{id:string|null;onFechar:()=>void}){
  const [tarefa,setTarefa]=useState<EquipeTarefa|null>(null)
  const [comentarios,setComentarios]=useState<EquipeComentario[]>([])
  const [historico,setHistorico]=useState<EquipeHistorico[]>([])
  const [usuarioId,setUsuarioId]=useState<string|null>(null)
  const [texto,setTexto]=useState('')
  const [aba,setAba]=useState<'comentarios'|'historico'>('comentarios')
  const [carregando,setCarregando]=useState(false)
  const [salvando,setSalvando]=useState(false)
  const [erro,setErro]=useState('')

  const carregar=useCallback(async(idTarefa:string)=>{
    setCarregando(true)
    try{
      const r=await detalhesEquipe(idTarefa)
      setTarefa(r.tarefa);setComentarios(r.comentarios);setHistorico(r.historico);setErro('')
    }catch(e){setErro(e instanceof Error?e.message:'Erro ao abrir tarefa')}
    finally{setCarregando(false)}
  },[])
  useEffect(()=>{
    if(!id){setTarefa(null);return}
    setAba('comentarios');setTexto('')
    void carregar(id)
  },[id,carregar])
  useEffect(()=>{void usuarioAtual().then(u=>setUsuarioId(u?.id||null))},[])

  async function salvarComentario(){
    if(!id||salvando||!texto.trim())return
    setSalvando(true);setErro('')
    try{
      await comentarEquipe(id,texto.trim())
      setTexto('');await carregar(id);avisarMudancaEquipe()
    }catch(e){setErro(e instanceof Error?e.message:'Erro ao comentar')}
    finally{setSalvando(false)}
  }
  async function atualizarStatus(status:StatusEquipe){
    if(!id||salvando||tarefa?.status===status)return
    if(status==='concluido'&&!window.confirm('Confirmar conclusão desta tarefa para todos os responsáveis?'))return
    setSalvando(true);setErro('')
    try{
      await movimentarEquipe(id,status)
      await carregar(id);avisarMudancaEquipe()
    }catch(e){setErro(e instanceof Error?e.message:'Erro ao mudar etapa')}
    finally{setSalvando(false)}
  }
  if(!id)return null
  const podeMover=Boolean(tarefa&&usuarioId&&tarefa.responsaveis_ids.includes(usuarioId))
  return(
    <div className="fixed inset-0 z-[120] flex justify-end bg-slate-900/35" role="dialog" aria-modal="true" aria-label="Detalhe da tarefa">
      <button type="button" onClick={onFechar} className="absolute inset-0 cursor-default" aria-label="Fechar detalhe da tarefa"/>
      <aside className="relative z-10 flex h-full w-full max-w-[430px] flex-col border-l border-slate-200 bg-white text-slate-900 shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-200 p-4">
          <div><p className="text-[11px] font-bold uppercase tracking-wide text-blue-600">Detalhes da tarefa</p><h2 className="text-sm font-bold text-slate-900">{tarefa?.titulo||'Carregando...'}</h2></div>
          <button type="button" onClick={onFechar} aria-label="Fechar" className="rounded-lg p-2 hover:bg-slate-100"><X size={18}/></button>
        </div>
        <div className="flex-1 space-y-4 overflow-y-auto p-4">
          {carregando&&!tarefa&&<p className="text-sm text-slate-400">Carregando tarefa...</p>}
          {tarefa&&<>
            <div className="space-y-2 rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs">
              <p><strong>Criada por:</strong> {tarefa.criador_nome}</p>
              <p className="flex flex-wrap items-center gap-1"><Users size={14}/><strong>Responsáveis:</strong> {tarefa.responsaveis_nomes.join(', ')}</p>
              <p className="flex items-center gap-1"><Clock3 size={14}/><strong>Prazo:</strong> {formatar(tarefa.data_hora)}</p>
              <p><strong>Prioridade:</strong> {tarefa.prioridade}</p>
              <p><strong>Tipo:</strong> {tarefa.compartilhada?'Compartilhada — uma conclusão vale para todos':'Individual'}</p>
              {tarefa.concluida_em&&<p className="font-semibold text-emerald-700"><Check size={13} className="mr-1 inline"/>Concluída em {formatar(tarefa.concluida_em)} por {tarefa.concluidora_nome||'Usuário'}</p>}
              {tarefa.descricao&&<p className="border-t border-slate-200 pt-2 text-slate-600">{tarefa.descricao}</p>}
            </div>
            <label className="block text-xs font-bold text-slate-700">Situação do card
              <select value={tarefa.status} onChange={e=>void atualizarStatus(e.target.value as StatusEquipe)}
                disabled={!podeMover||salvando}
                className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm disabled:opacity-60">
                {ETAPAS.map(e=><option key={e.valor} value={e.valor}>{e.nome}</option>)}
              </select>
              {!podeMover&&<span className="mt-1 block font-normal text-slate-500">O andamento é alterado pelos responsáveis e aparece aqui automaticamente.</span>}
            </label>
            <div className="flex border-b border-slate-200 text-xs">
              <button type="button" onClick={()=>setAba('comentarios')} className={'flex-1 border-b-2 px-2 py-2 '+(aba==='comentarios'?'border-blue-600 font-bold text-blue-700':'border-transparent text-slate-500')}>
                <MessageCircle size={13} className="mr-1 inline"/> Comentários ({comentarios.length})
              </button>
              <button type="button" onClick={()=>setAba('historico')} className={'flex-1 border-b-2 px-2 py-2 '+(aba==='historico'?'border-blue-600 font-bold text-blue-700':'border-transparent text-slate-500')}>
                Histórico ({historico.length})
              </button>
            </div>
            <div className="space-y-2">
              {aba==='comentarios'&&(comentarios.length?comentarios.map(c=>
                <div key={c.id} className="rounded-lg bg-blue-50/60 p-2.5 text-xs"><p className="font-semibold text-blue-800">{c.autor_nome} <span className="font-normal text-slate-400">· {formatar(c.created_at)}</span></p><p className="mt-1 whitespace-pre-wrap text-slate-700">{c.texto}</p></div>
              ):<p className="text-xs text-slate-400">Nenhum comentário nesta tarefa.</p>)}
              {aba==='historico'&&(historico.length?historico.map(h=>
                <div key={h.id} className="border-b border-slate-100 py-2 text-xs"><p className="font-semibold text-slate-700">{h.autor_nome} · {h.acao}</p><p className="text-slate-500">{h.detalhe} · {formatar(h.created_at)}</p></div>
              ):<p className="text-xs text-slate-400">Ainda não há movimentações.</p>)}
            </div>
          </>}
          {erro&&<p role="alert" className="rounded-lg bg-red-50 p-2 text-xs text-red-700">{erro}</p>}
        </div>
        {tarefa&&<div className="border-t border-slate-200 p-3">
          <div className="flex items-center gap-2">
            <input value={texto} maxLength={2000} onChange={e=>setTexto(e.target.value)}
              onKeyDown={e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();void salvarComentario()}}}
              placeholder="Escreva um comentário..." className="h-10 min-w-0 flex-1 rounded-lg border border-slate-300 px-2.5 text-xs"/>
            <button type="button" onClick={()=>void salvarComentario()} disabled={!texto.trim()||salvando} aria-label="Enviar comentário"
              className="grid h-10 w-10 place-items-center rounded-lg bg-blue-600 text-white disabled:opacity-50"><Send size={16}/></button>
          </div>
        </div>}
      </aside>
    </div>
  )
}
