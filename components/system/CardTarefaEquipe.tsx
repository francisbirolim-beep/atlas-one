'use client'
import { CalendarClock, Clock3, MessageCircle, MoreHorizontal, Users } from 'lucide-react'
import type { EquipeTarefa } from '@/lib/tarefasEquipeCliente'
function data(iso?:string|null){
  if(!iso)return 'Sem prazo'
  return new Intl.DateTimeFormat('pt-BR',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'}).format(new Date(iso))
}
function tempo(iso?:string|null){
  if(!iso)return null
  const ms=Date.now()-new Date(iso).getTime()
  if(ms<0)return null
  const horas=Math.floor(ms/3600000)
  return horas<1?`${Math.floor(ms/60000)} min`:horas<24?`${horas}h`:`${Math.floor(horas/24)}d`
}
export default function CardTarefaEquipe({tarefa,onAbrir,podeArrastar=false}:{
  tarefa:EquipeTarefa;onAbrir:()=>void;podeArrastar?:boolean
}){
  const atrasada=tarefa.status!=='concluido'&&tarefa.data_hora&&new Date(tarefa.data_hora).getTime()<Date.now()
  const cor=tarefa.status==='concluido'?'border-l-emerald-500':
    tarefa.status==='em_andamento'?'border-l-blue-500':
    tarefa.status==='aguardando'?'border-l-amber-500':'border-l-violet-500'
  return(
    <article draggable={podeArrastar} onDragStart={e=>{
      if(!podeArrastar){e.preventDefault();return}
      e.dataTransfer.setData('text/plain','equipe:'+tarefa.id)
    }} className={'rounded-lg border border-slate-200 border-l-4 bg-white p-2 shadow-sm '+cor}>
      <button type="button" onClick={onAbrir} className="w-full text-left" title="Abrir histórico e comentários da tarefa">
        <p className="line-clamp-2 text-xs font-bold leading-4 text-slate-900">{tarefa.titulo}</p>
        <p className="mt-1 flex items-center gap-1 truncate text-[11px] text-slate-600"><Users size={12}/> {tarefa.responsaveis_nomes.join(' e ')}</p>
        <p className={'mt-1 flex items-center gap-1 text-[10px] '+(atrasada?'font-semibold text-red-600':'text-slate-600')}><CalendarClock size={11}/> Prazo: {data(tarefa.data_hora)}</p>
        <p className="mt-0.5 text-[10px] text-slate-600">Prioridade: <strong className={tarefa.prioridade==='alta'||tarefa.prioridade==='urgente'?'text-red-600':'text-slate-700'}>{tarefa.prioridade}</strong></p>
        {tarefa.status==='concluido'?
          <p className="mt-1 text-[10px] font-semibold text-emerald-700">Concluída por {tarefa.concluidora_nome||'usuário'} em {data(tarefa.concluida_em)}</p>:
          <p className={'mt-1 flex items-center gap-1 text-[10px] '+(atrasada?'font-bold text-red-700':'text-slate-500')}>
            <Clock3 size={11}/>
            {atrasada?'Atrasada há ':'Criada há '}{tempo(atrasada?tarefa.data_hora:tarefa.created_at)||'instantes'}
          </p>}
        <p className="mt-1 text-[10px] text-violet-700">Enviada por: {tarefa.criador_nome}</p>
        <div className="mt-1 flex items-center justify-between text-slate-500">
          <span className="inline-flex items-center gap-1 text-[10px]"><MessageCircle size={12}/> Comentários</span>
          <MoreHorizontal size={17}/>
        </div>
      </button>
    </article>
  )
}
