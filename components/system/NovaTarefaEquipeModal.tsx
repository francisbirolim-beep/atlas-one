'use client'

import { useEffect, useMemo, useState } from 'react'
import { CalendarClock, Check, Mic, Plus, Search, Users, X } from 'lucide-react'
import { usuarioAtual } from '@/lib/auth'
import { listarUsuariosConvidaveis } from '@/lib/eventos'
import BotaoMicrofone from '@/components/BotaoMicrofone'
import { interpretarComandoDeVoz } from '@/lib/comandoVoz'
import { avisarMudancaEquipe, criarEquipe, type CriacaoEquipe, type PrioridadeEquipe } from '@/lib/tarefasEquipeCliente'
import type { RepeticaoEquipe } from '@/lib/tarefasEquipeRecorrencia'
import type { Usuario } from '@/lib/tipos'

const NOMES_DIAS = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb']
function dataLocal(data:Date) {
  const p=(n:number)=>String(n).padStart(2,'0')
  return `${data.getFullYear()}-${p(data.getMonth()+1)}-${p(data.getDate())}T${p(data.getHours())}:${p(data.getMinutes())}`
}
function normalizar(s:string){return s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'')}

export default function NovaTarefaEquipeModal() {
  const [aberta,setAberta]=useState(false)
  const [usuario,setUsuario]=useState<Usuario|null>(null)
  const [nomes,setNomes]=useState<{id:string;nome:string}[]>([])
  const [responsaveis,setResponsaveis]=useState<string[]>([])
  const [busca,setBusca]=useState('')
  const [titulo,setTitulo]=useState('')
  const [descricao,setDescricao]=useState('')
  const [prioridade,setPrioridade]=useState<PrioridadeEquipe>('normal')
  const [data,setData]=useState('')
  const [modo,setModo]=useState<'compartilhada'|'individual'>('compartilhada')
  const [repeticao,setRepeticao]=useState<RepeticaoEquipe>('uma_vez')
  const [dias,setDias]=useState<number[]>([])
  const [diaMes,setDiaMes]=useState(1)
  const [salvando,setSalvando]=useState(false)
  const [erro,setErro]=useState('')

  useEffect(()=>{
    let ativo=true
    usuarioAtual().then(async u=>{
      if(!ativo||!u)return
      setUsuario(u)
      const outros=await listarUsuariosConvidaveis(u.id)
      if(!ativo)return
      setNomes([{id:u.id,nome:u.nome},...outros])
    })
    const abrir=()=>setAberta(true)
    window.addEventListener('atlas:tarefa-equipe-nova',abrir)
    return()=>{ativo=false;window.removeEventListener('atlas:tarefa-equipe-nova',abrir)}
  },[])
  useEffect(()=>{
    if(!aberta)return
    setResponsaveis(u=>u.length?u:(usuario?[usuario.id]:[]))
    setErro('')
  },[aberta,usuario])
  const buscaLista=useMemo(()=>nomes.filter(n=>normalizar(n.nome).includes(normalizar(busca))),[nomes,busca])
  function alternarPessoa(id:string){setResponsaveis(atual=>atual.includes(id)?atual.filter(x=>x!==id):[...atual,id])}
  function ouvir(texto:string){
    const comando=interpretarComandoDeVoz(texto)
    setTitulo(comando.titulo)
    if(comando.data)setData(dataLocal(comando.data))
  }
  async function salvar(){
    if(salvando)return
    if(!titulo.trim()||!responsaveis.length){setErro('Informe uma tarefa e pelo menos um responsável.');return}
    if(repeticao!=='uma_vez'&&!data){setErro('Defina data e horário para a repetição.');return}
    setSalvando(true);setErro('')
    try{
      const payload:CriacaoEquipe={
        titulo:titulo.trim(),descricao:descricao.trim(),responsaveisIds:responsaveis,
        prioridade,dataHora:data?new Date(data).toISOString():null,modo,recorrencia:repeticao,
        recorrenciaValor:repeticao==='mensal'?diaMes:repeticao==='dia_util_mes'?5:undefined,
        diasSemana:repeticao==='semanal'?dias:undefined,
      }
      await criarEquipe(payload)
      setAberta(false);setTitulo('');setDescricao('');setBusca('')
      setData('');setPrioridade('normal');setRepeticao('uma_vez');setModo('compartilhada')
      setResponsaveis(usuario?[usuario.id]:[])
      avisarMudancaEquipe()
    }catch(e){setErro(e instanceof Error?e.message:'Não foi possível salvar.')}
    finally{setSalvando(false)}
  }
  if(!aberta)return null
  return(
    <div className="fixed inset-0 z-[125] flex items-center justify-center bg-slate-950/50 p-3 sm:items-end sm:justify-start sm:pb-12 sm:pl-[min(28vw,480px)]" role="dialog" aria-modal="true" aria-label="Nova tarefa compartilhada">
      <div className="max-h-[calc(100vh-30px)] w-full max-w-[475px] overflow-y-auto rounded-2xl border border-slate-200 bg-white p-4 text-slate-900 shadow-2xl">
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2"><span className="rounded-lg bg-blue-50 p-2 text-blue-700"><Plus size={17}/></span>
            <div><h2 className="text-base font-bold">Nova tarefa</h2><p className="text-[11px] text-slate-500">Manual ou recorrente · compartilhada entre os responsáveis</p></div></div>
          <button type="button" onClick={()=>setAberta(false)} aria-label="Fechar" className="rounded-lg p-1 text-slate-500 hover:bg-slate-100"><X size={19}/></button>
        </div>
        <div className="space-y-3">
          <label className="block text-xs font-semibold text-slate-700">
            Descrição da tarefa *
            <div className="mt-1 flex gap-2">
              <input autoFocus value={titulo} onChange={e=>setTitulo(e.target.value)} maxLength={300}
                placeholder="Ex.: Realizar pagamento do fornecedor" className="h-10 min-w-0 flex-1 rounded-lg border border-slate-300 px-3 text-sm"/>
              <BotaoMicrofone onResultado={ouvir} titulo="Ditar tarefa e data por voz" className="rounded-lg border border-blue-200 bg-blue-50 px-3 text-blue-700" />
            </div>
          </label>
          <label className="block text-xs font-semibold text-slate-700">Detalhes / orientações
            <textarea value={descricao} onChange={e=>setDescricao(e.target.value)} maxLength={2000} rows={2}
              placeholder="O que precisa ser feito?" className="mt-1 w-full rounded-lg border border-slate-300 p-2 text-xs"/>
          </label>
          <div>
            <p className="mb-1 text-xs font-semibold text-slate-700">Responsáveis *</p>
            <div className="rounded-xl border border-slate-300 p-2">
              <div className="flex flex-wrap gap-1.5">
                {responsaveis.map(id=>{
                  const pessoa=nomes.find(n=>n.id===id)
                  return <button key={id} type="button" onClick={()=>alternarPessoa(id)}
                    aria-label={'Remover '+(pessoa?.nome||'responsável')}
                    className="inline-flex items-center gap-1 rounded-md bg-blue-100 px-2 py-1 text-xs font-semibold text-blue-800">{pessoa?.nome||'Usuário'} <X size={12}/></button>
                })}
              </div>
              <div className="mt-1 flex items-center gap-2"><Search size={14} className="text-slate-400"/>
                <input value={busca} onChange={e=>setBusca(e.target.value)} placeholder="Pesquisar usuário pelo nome..."
                  className="h-8 min-w-0 w-full text-xs outline-none"/>
              </div>
              {busca.trim() && <div className="max-h-28 overflow-y-auto border-t border-slate-100 pt-1">
                {buscaLista.filter(n=>!responsaveis.includes(n.id)).slice(0,10).map(n=>
                  <button key={n.id} type="button" onClick={()=>{alternarPessoa(n.id);setBusca('')}}
                    className="block w-full rounded-lg px-2 py-1.5 text-left text-xs hover:bg-blue-50">{n.nome}</button>
                )}
                {buscaLista.filter(n=>!responsaveis.includes(n.id)).length===0&&<p className="px-2 text-xs text-slate-400">Nenhum usuário encontrado.</p>}
              </div>}
            </div>
          </div>
          {responsaveis.length>1 && <fieldset className="rounded-xl border border-slate-100 bg-slate-50 p-2.5">
            <legend className="px-1 text-xs font-semibold text-slate-700">Tipo de execução</legend>
            <label className="flex items-center gap-2 text-xs"><input type="radio" checked={modo==='compartilhada'} onChange={()=>setModo('compartilhada')}/> Uma tarefa compartilhada — se um concluir, conclui para todos</label>
            <label className="mt-2 flex items-center gap-2 text-xs"><input type="radio" checked={modo==='individual'} onChange={()=>setModo('individual')}/> Cada responsável tem sua própria tarefa</label>
          </fieldset>}
          <div className="grid grid-cols-2 gap-2">
            <label className="text-xs font-semibold text-slate-700">Prioridade
              <select value={prioridade} onChange={e=>setPrioridade(e.target.value as PrioridadeEquipe)}
                className="mt-1 h-10 w-full rounded-lg border border-slate-300 bg-white px-2 text-sm">
                <option value="baixa">Baixa</option><option value="normal">Normal</option><option value="alta">Alta</option><option value="urgente">Urgente</option>
              </select>
            </label>
            <label className="text-xs font-semibold text-slate-700">Vencimento
              <input type="datetime-local" value={data} onChange={e=>setData(e.target.value)}
                className="mt-1 h-10 w-full rounded-lg border border-slate-300 bg-white px-2 text-xs"/>
            </label>
          </div>
          <div>
            <p className="mb-2 text-xs font-semibold text-slate-700">Recorrência</p>
            <div className="flex flex-wrap gap-x-3 gap-y-2 text-xs">
              {([['uma_vez','Uma vez'],['semanal','Semanal'],['mensal','Mensal'],['dia_util_mes','5º dia útil']] as const).map(([tipo,nome])=>
                <label key={tipo} className="flex cursor-pointer items-center gap-1">
                  <input type="radio" checked={repeticao===tipo} onChange={()=>setRepeticao(tipo)} className="accent-blue-600"/> {nome}
                </label>
              )}
            </div>
            {repeticao==='semanal' && <div className="mt-2 flex flex-wrap gap-1.5">{NOMES_DIAS.map((nome,idx)=>
              <button type="button" key={idx} onClick={()=>setDias(atual=>atual.includes(idx)?atual.filter(d=>d!==idx):[...atual,idx])}
                aria-pressed={dias.includes(idx)}
                className={'rounded-md border px-2 py-1 text-[11px] '+(dias.includes(idx)?'border-blue-600 bg-blue-50 font-semibold text-blue-700':'border-slate-200')}>{nome}</button>
            )}</div>}
            {repeticao==='mensal'&&<label className="mt-2 flex items-center gap-2 text-xs text-slate-600">Todo dia
              <input type="number" min={1} max={31} value={diaMes} onChange={e=>setDiaMes(Number(e.target.value))}
                className="w-16 rounded-lg border border-slate-300 p-1.5 text-xs"/> de cada mês</label>}
            {repeticao==='dia_util_mes'&&<p className="mt-2 text-[11px] text-amber-700">Dias úteis bancários nacionais. Feriados municipais precisam ser conferidos pelo financeiro.</p>}
          </div>
          {erro && <p role="alert" className="rounded-lg bg-red-50 p-2 text-xs text-red-700">{erro}</p>}
          <div className="flex justify-end gap-2 border-t border-slate-100 pt-3">
            <button type="button" onClick={()=>setAberta(false)} disabled={salvando}
              className="rounded-lg border border-slate-300 px-4 py-2 text-xs font-semibold text-slate-600">Cancelar</button>
            <button type="button" onClick={()=>void salvar()} disabled={salvando||!titulo.trim()||!responsaveis.length}
              className="rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50">
              {salvando?'Salvando...':'Salvar tarefa'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
