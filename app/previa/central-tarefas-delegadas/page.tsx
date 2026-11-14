'use client'

import { useMemo, useState } from 'react'
import { AlarmClock, CalendarDays, Check, ChevronLeft, ChevronRight, Clock3, MessageCircle, Plus, Search, Send, Users, X } from 'lucide-react'

type Etapa = 'pedido' | 'afazer' | 'andamento' | 'aguardando' | 'concluido'
type Modo = 'compartilhada' | 'individual'
type Prioridade = 'baixa' | 'normal' | 'alta' | 'urgente'
type Registro = { autor: string; texto: string; data: string }
type Tarefa = {
  id: number; titulo: string; criador: string; responsaveis: string[]; etapa: Etapa
  prioridade: Prioridade; prazo: string; modo: Modo; recorrencia: string
  registros: Registro[]; concluidaEm?: string
}
const nomes = ['Francis', 'Daiane', 'Gabrieli', 'Financeiro']
const hoje = '2026-11-14T14:00:00'
const iniciais: Tarefa[] = [
  { id: 1, titulo: 'Realizar pagamento do fornecedor X', criador: 'Francis', responsaveis: ['Daiane', 'Gabrieli'], etapa: 'pedido', prioridade: 'alta', prazo: '2026-11-16T17:00', modo: 'compartilhada', recorrencia: '5º dia útil de cada mês', registros: [] },
  { id: 2, titulo: 'Emitir relatório de contas a receber', criador: 'Francis', responsaveis: ['Daiane'], etapa: 'andamento', prioridade: 'normal', prazo: '2026-11-17T16:00', modo: 'individual', recorrencia: 'Todo dia 1º', registros: [{ autor: 'Daiane', texto: 'Em andamento — aguardando conferência.', data: '14/11 13h20' }] },
  { id: 3, titulo: 'Conferir pedidos de compra', criador: 'Francis', responsaveis: ['Francis'], etapa: 'afazer', prioridade: 'normal', prazo: '2026-11-18T10:00', modo: 'individual', recorrencia: 'Não repetir', registros: [] },
  { id: 4, titulo: 'Revisar documentação da obra', criador: 'Gabrieli', responsaveis: ['Francis'], etapa: 'aguardando', prioridade: 'urgente', prazo: '2026-11-15T09:00', modo: 'individual', recorrencia: 'Não repetir', registros: [{ autor: 'Francis', texto: 'Aguardando aprovação do cliente.', data: '14/11 09h15' }] },
  { id: 5, titulo: 'Conferir fechamento de outubro', criador: 'Francis', responsaveis: ['Daiane'], etapa: 'concluido', prioridade: 'normal', prazo: '2026-11-08T10:00', modo: 'compartilhada', recorrencia: 'Mensal', registros: [{ autor: 'Daiane', texto: 'Concluída por Daiane.', data: '09/11 16h12' }], concluidaEm: '2026-11-09T16:12' },
]
const etapas: { id: Etapa; titulo: string; estilo: string; cabecalho: string }[] = [
  { id: 'pedido', titulo: 'Pedidos de tarefa', estilo: 'bg-violet-50 border-violet-200', cabecalho: 'text-violet-800 bg-violet-100' },
  { id: 'afazer', titulo: 'A fazer', estilo: 'bg-slate-50 border-slate-200', cabecalho: 'text-slate-800 bg-slate-100' },
  { id: 'andamento', titulo: 'Em andamento', estilo: 'bg-blue-50 border-blue-200', cabecalho: 'text-blue-800 bg-blue-100' },
  { id: 'aguardando', titulo: 'Aguardando', estilo: 'bg-amber-50 border-amber-200', cabecalho: 'text-amber-800 bg-amber-100' },
  { id: 'concluido', titulo: 'Concluído', estilo: 'bg-emerald-50 border-emerald-200', cabecalho: 'text-emerald-800 bg-emerald-100' },
]
function formatarData(s: string) {
  if (!s) return 'Sem prazo'
  const [dia, hora] = s.split('T')
  const [a, m, d] = dia.split('-')
  return `${d}/${m}/${a}${hora ? ' · ' + hora.slice(0, 5) : ''}`
}
function mesData(s: string) { return s.slice(0, 7) }
function moverMes(m: string, d: number) {
  const [a, n] = m.split('-').map(Number)
  const data = new Date(a, n - 1 + d, 1)
  return `${data.getFullYear()}-${String(data.getMonth()+1).padStart(2,'0')}`
}
function mesExtenso(m: string) {
  const [a,n]=m.split('-').map(Number)
  return new Intl.DateTimeFormat('pt-BR',{month:'long',year:'numeric'}).format(new Date(a,n-1,1))
}
export default function PreviaTarefasDelegadas() {
  const [ator, setAtor] = useState('Francis')
  const [tarefas, setTarefas] = useState(iniciais)
  const [busca, setBusca] = useState('')
  const [mes, setMes] = useState('2026-11')
  const [modal, setModal] = useState(false)
  const [selecionada, setSelecionada] = useState<number | null>(null)
  const [comentario, setComentario] = useState('')
  const [alerta, setAlerta] = useState(true)
  const [adiado, setAdiado] = useState(false)
  const [titulo, setTitulo] = useState('')
  const [destinatarios, setDestinatarios] = useState<string[]>([])
  const [modo, setModo] = useState<Modo>('compartilhada')
  const [prioridade, setPrioridade] = useState<Prioridade>('normal')
  const [prazo, setPrazo] = useState('2026-11-16T17:00')
  const [tipo, setTipo] = useState<'tarefa' | 'agenda'>('tarefa')
  const [recorrencia, setRecorrencia] = useState('nao')
  const [diaSemana, setDiaSemana] = useState(['seg','qua','sex'])
  const [periodo, setPeriodo] = useState('mes')
  const tarefaAtual = tarefas.find(t=>t.id===selecionada) || null
  const visiveis = useMemo(() => tarefas.filter(t =>
    (t.criador === ator || t.responsaveis.includes(ator))
    && (!busca || `${t.titulo} ${t.responsaveis.join(' ')} ${t.criador}`.toLowerCase().includes(busca.toLowerCase()))
    && (periodo === 'todos' || t.etapa !== 'concluido' || mesData(t.concluidaEm||t.prazo)===mes)
  ), [tarefas,ator,busca,mes,periodo])
  function etapaVisivel(t: Tarefa): Etapa {
    return t.etapa === 'pedido' && t.criador !== ator ? 'afazer' : t.etapa
  }
  function mudarEtapa(id: number, etapa: Etapa) {
    setTarefas(anterior=>anterior.map(t=>t.id!==id?t:{
      ...t, etapa, concluidaEm: etapa==='concluido'?hoje:undefined,
      registros:[...t.registros,{ autor: ator, texto: etapa==='concluido'?'Tarefa concluída.':`Movimentou para ${etapas.find(e=>e.id===etapa)?.titulo}.`, data:'14/11 14h07' }],
    }))
  }
  function comentar() {
    if(!selecionada||!comentario.trim())return
    setTarefas(anterior=>anterior.map(t=>t.id!==selecionada?t:{...t,registros:[...t.registros,{autor:ator,texto:comentario.trim(),data:'14/11 14h07'}]}))
    setComentario('')
  }
  function salvar() {
    if(!titulo.trim()||!destinatarios.length)return
    const alvos=modo==='individual'?destinatarios.map(n=>[n]):[destinatarios]
    const novas=alvos.map((alvo,i)=>({
      id: Date.now()+i, titulo:titulo.trim(), criador:ator, responsaveis:alvo,
      etapa: (alvo.length===1&&alvo[0]===ator?'afazer':'pedido') as Etapa,
      prioridade, prazo, modo, recorrencia:recorrencia==='nao'?'Não repetir':recorrencia,
      registros: [{autor:ator,texto:`Tarefa de demonstração criada (${tipo}).`,data:'14/11 14h07'}]
    }))
    setTarefas(t=>[...novas,...t])
    setModal(false);setTitulo('');setDestinatarios([])
  }
  return (
    <main className="min-h-screen bg-slate-100 p-3 text-slate-900 md:p-6">
      <div className="mx-auto max-w-[1650px] space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div><p className="text-xs font-bold uppercase tracking-wide text-blue-700">Atlas One · Prévia interativa</p><h1 className="mt-1 text-xl font-bold md:text-2xl">Kanban Pessoal e Tarefas Delegadas</h1><p className="mt-1 text-sm text-slate-500">Proposta para aprovação · Dados fictícios · Nada é salvo no Atlas</p></div>
          <div className="flex flex-wrap items-center gap-2"><label className="text-xs font-medium text-slate-500">Simular usuário</label><select aria-label="Simular usuário" value={ator} onChange={e=>setAtor(e.target.value)} className="rounded-lg border bg-white p-2 text-sm">{nomes.map(n=><option key={n}>{n}</option>)}</select><button onClick={()=>setModal(true)} className="flex items-center gap-2 rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white"><Plus size={16}/> Nova tarefa / agenda</button></div>
        </div>
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 bg-white p-3">
          <button aria-label="Mês anterior" onClick={()=>setMes(m=>moverMes(m,-1))} className="rounded border p-2"><ChevronLeft size={16}/></button><strong className="min-w-36 text-center text-sm capitalize">{mesExtenso(mes)}</strong><button aria-label="Próximo mês" onClick={()=>setMes(m=>moverMes(m,1))} className="rounded border p-2"><ChevronRight size={16}/></button>
          <button onClick={()=>setPeriodo(p=>p==='mes'?'todos':'mes')} className="rounded-lg border px-3 py-2 text-xs font-medium">{periodo==='mes'?'Ver todos os períodos':'Somente mês atual'}</button>
          <div className="flex min-w-48 flex-1 items-center gap-2 rounded-lg border bg-white px-3 py-2"><Search size={16} className="text-slate-400"/><input value={busca} onChange={e=>setBusca(e.target.value)} placeholder="Pesquisar tarefa ou responsável" className="w-full outline-none text-sm"/></div>
          <span className="text-xs text-slate-500">{visiveis.length} tarefa(s) · Concluídas do mês selecionado</span>
        </div>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          {etapas.map(col=>{
            const lista=visiveis.filter(t=>etapaVisivel(t)===col.id)
            return <section key={col.id} className={`min-h-[355px] rounded-xl border ${col.estilo}`}>
              <header className={`flex items-center justify-between rounded-t-xl px-3 py-3 ${col.cabecalho}`}><h2 className="text-sm font-bold">{col.titulo}</h2><span className="rounded-full bg-white/80 px-2 py-0.5 text-xs font-bold">{lista.length}</span></header>
              <div className="space-y-2 p-2">
                {lista.length===0&&<p className="rounded-lg border border-dashed bg-white/60 p-3 text-center text-xs text-slate-400">Nenhuma tarefa nesta etapa</p>}
                {lista.map(t=><button key={t.id} onClick={()=>{setSelecionada(t.id);setComentario('')}} className="w-full space-y-2 rounded-lg border border-slate-200 bg-white p-3 text-left shadow-sm hover:ring-2 hover:ring-blue-100">
                  <div className="flex items-start justify-between gap-2"><strong className="text-xs leading-relaxed">{t.titulo}</strong><span className={`shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${t.prioridade==='urgente'?'bg-red-100 text-red-800':t.prioridade==='alta'?'bg-orange-100 text-orange-800':'bg-slate-100 text-slate-700'}`}>{t.prioridade}</span></div>
                  <p className="flex items-center gap-1 text-xs text-slate-600"><Users size={13}/>{t.responsaveis.join(' e ')}</p>
                  <p className="flex items-center gap-1 text-[11px] text-slate-500"><Clock3 size={12}/>{formatarData(t.prazo)}</p>
                  {t.registros.length>0&&<p className="flex items-center gap-1 truncate text-[11px] text-blue-700"><MessageCircle size={12}/>{t.registros[t.registros.length-1].texto}</p>}
                  {t.recorrencia!=='Não repetir'&&<p className="text-[10px] font-medium text-purple-700">↻ {t.recorrencia}</p>}
                </button>)}
              </div>
            </section>
          })}
        </div>
        <div className="grid gap-3 lg:grid-cols-3">
          <section className="rounded-xl border bg-white p-4 lg:col-span-2"><h3 className="font-bold">Monitoramento das tarefas delegadas</h3><p className="my-1 text-xs text-slate-500">Mudanças feitas pelo responsável atualizam o mesmo card de quem delegou.</p>
            <div className="mt-3 overflow-auto"><table className="w-full text-left text-xs"><thead className="bg-slate-100"><tr><th className="p-2">Tarefa</th><th className="p-2">Responsáveis</th><th className="p-2">Situação</th><th className="p-2">Última atividade</th></tr></thead><tbody>{tarefas.filter(t=>t.criador===ator&&t.responsaveis.some(n=>n!==ator)).map(t=><tr key={t.id} className="border-t"><td className="p-2">{t.titulo}</td><td className="p-2">{t.responsaveis.join(', ')}</td><td className="p-2 font-medium">{etapas.find(e=>e.id===t.etapa)?.titulo}</td><td className="p-2 text-slate-500">{t.registros.at(-1)?.texto || 'Sem movimentação'}</td></tr>)}</tbody></table></div>
          </section>
          <section className="rounded-xl border bg-white p-4"><h3 className="font-bold">Notificações no canto da tela</h3><p className="my-2 text-xs text-slate-500">Receber, confirmar que viu, adiar ou concluir. Pendências antigas continuam aparecendo.</p>
            <button onClick={()=>{setAlerta(true);setAdiado(false)}} className="rounded-lg border px-3 py-2 text-xs font-semibold">Simular nova notificação</button>
            <p className="mt-3 text-xs text-slate-500">Uma tarefa compartilhada é concluída para todos quando um responsável finaliza. Tarefas individuais exigem conclusão própria.</p>
          </section>
        </div>
        {alerta&&<aside className="fixed bottom-5 right-5 z-30 w-[min(365px,calc(100vw-40px))] rounded-xl border border-blue-200 bg-white p-4 shadow-2xl">
          <div className="flex items-start justify-between"><strong className="flex items-center gap-2 text-sm"><AlarmClock size={17} className="text-blue-700"/> Nova tarefa recebida</strong><button aria-label="Fechar lembrete" onClick={()=>setAlerta(false)}><X size={16}/></button></div>
          <p className="mt-2 text-sm">Realizar pagamento do fornecedor X</p><p className="text-xs text-slate-500">Prioridade alta · Prazo 16/11 às 17h</p>
          <div className="mt-3 flex flex-wrap gap-2"><button onClick={()=>{setAdiado(true);setAlerta(false)}} className="rounded-lg border px-3 py-2 text-xs"><AlarmClock className="mr-1 inline" size={12}/>Adiar</button><button onClick={()=>setAlerta(false)} className="rounded-lg border px-3 py-2 text-xs">OK, entendi</button><button onClick={()=>{setSelecionada(1);setAlerta(false)}} className="rounded-lg bg-blue-700 px-3 py-2 text-xs text-white">Ver tarefa</button></div>
        </aside>}
        {adiado&&<div className="fixed bottom-5 right-5 rounded-lg bg-slate-900 px-4 py-3 text-xs text-white">Lembrete adiado nesta demonstração.</div>}
        {tarefaAtual&&<div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/45 p-4" onClick={()=>setSelecionada(null)}><div className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-xl bg-white p-5 shadow-xl" onClick={e=>e.stopPropagation()}>
          <div className="flex items-start justify-between gap-3"><div><h2 className="text-lg font-bold">{tarefaAtual.titulo}</h2><p className="text-xs text-slate-500">Criada por {tarefaAtual.criador} · {tarefaAtual.modo}</p></div><button aria-label="Fechar" onClick={()=>setSelecionada(null)}><X size={20}/></button></div>
          <p className="mt-3 text-sm">Responsáveis: <strong>{tarefaAtual.responsaveis.join(', ')}</strong></p><p className="mt-1 text-sm">Prazo: {formatarData(tarefaAtual.prazo)} · Prioridade: {tarefaAtual.prioridade}</p>
          <div className="mt-4"><p className="mb-2 text-xs font-bold uppercase text-slate-500">Movimentar tarefa (simulação como {ator})</p><div className="flex flex-wrap gap-2">{etapas.filter(e=>e.id!=='pedido').map(e=><button key={e.id} onClick={()=>mudarEtapa(tarefaAtual.id,e.id)} className="rounded-lg border bg-slate-50 px-3 py-2 text-xs font-semibold hover:bg-blue-50">{e.titulo}</button>)}</div></div>
          <h3 className="mb-2 mt-5 font-bold">Comentários e histórico</h3><div className="max-h-36 space-y-2 overflow-auto rounded-lg bg-slate-50 p-3">{tarefaAtual.registros.length?tarefaAtual.registros.map((r,i)=><p key={i} className="text-xs"><strong>{r.autor}</strong> · {r.data}: {r.texto}</p>):<p className="text-xs text-slate-400">Ainda sem atualizações</p>}</div>
          <div className="mt-3 flex gap-2"><input className="min-w-0 flex-1 rounded-lg border px-3 py-2 text-sm" placeholder="Ex.: Aguardando liberação do boleto" value={comentario} onChange={e=>setComentario(e.target.value)}/><button onClick={comentar} className="rounded-lg bg-blue-700 px-3 text-white" aria-label="Enviar comentário"><Send size={16}/></button></div>
        </div></div>}
        {modal&&<div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/45 p-4" onClick={()=>setModal(false)}><div className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-xl bg-white p-5 shadow-xl" onClick={e=>e.stopPropagation()}>
          <div className="flex items-center justify-between"><h2 className="text-lg font-bold">Nova tarefa ou compromisso</h2><button onClick={()=>setModal(false)} aria-label="Fechar"><X size={20}/></button></div>
          <div className="mt-3 grid grid-cols-2 gap-2">{(['tarefa','agenda'] as const).map(v=><button key={v} onClick={()=>setTipo(v)} className={`rounded-lg border p-2 text-sm font-bold ${tipo===v?'border-blue-700 bg-blue-50 text-blue-800':''}`}>{v==='tarefa'?'Tarefa / lembrete':'Agenda / compromisso'}</button>)}</div>
          <label className="mt-3 block text-xs font-bold">Título<input value={titulo} onChange={e=>setTitulo(e.target.value)} placeholder="Ex.: Fazer pagamento do fornecedor" className="mt-1 w-full rounded-lg border p-3 text-sm"/></label>
          <p className="mb-1 mt-3 text-xs font-bold">Responsáveis (pesquisar e selecionar)</p><div className="flex flex-wrap gap-2">{nomes.map(n=><label key={n} className="flex items-center gap-2 rounded-lg border px-3 py-2 text-xs"><input type="checkbox" checked={destinatarios.includes(n)} onChange={e=>setDestinatarios(a=>e.target.checked?[...a,n]:a.filter(x=>x!==n))}/>{n}</label>)}</div>
          <p className="mb-1 mt-3 text-xs font-bold">Modo de conclusão</p><div className="grid gap-2 text-xs sm:grid-cols-2"><label className="rounded-lg border p-3"><input type="radio" checked={modo==='compartilhada'} onChange={()=>setModo('compartilhada')}/> Compartilhada · um conclui para todos</label><label className="rounded-lg border p-3"><input type="radio" checked={modo==='individual'} onChange={()=>setModo('individual')}/> Individual · cada um conclui a sua</label></div>
          <div className="mt-3 grid gap-3 sm:grid-cols-2"><label className="text-xs font-bold">Prazo<input type="datetime-local" value={prazo} onChange={e=>setPrazo(e.target.value)} className="mt-1 w-full rounded-lg border p-2 text-sm"/></label><label className="text-xs font-bold">Prioridade<select value={prioridade} onChange={e=>setPrioridade(e.target.value as Prioridade)} className="mt-1 w-full rounded-lg border p-2 text-sm"><option value="baixa">Baixa</option><option value="normal">Normal</option><option value="alta">Alta</option><option value="urgente">Urgente</option></select></label></div>
          <label className="mt-3 block text-xs font-bold">Repetir<select value={recorrencia} onChange={e=>setRecorrencia(e.target.value)} className="mt-1 w-full rounded-lg border p-2 text-sm"><option value="nao">Uma vez</option><option value="diaria">Diariamente</option><option value="semanal">Semanalmente</option><option value="mensal">Todo mês</option><option value="anual">Todo ano</option><option value="5º dia útil de cada mês">No 5º dia útil do mês</option><option value="dias">Dias da semana selecionados</option></select></label>
          {recorrencia==='dias'&&<div className="mt-2 flex flex-wrap gap-2">{['seg','ter','qua','qui','sex','sáb','dom'].map(d=><label key={d} className="text-xs"><input type="checkbox" checked={diaSemana.includes(d)} onChange={e=>setDiaSemana(x=>e.target.checked?[...x,d]:x.filter(y=>y!==d))}/>{d}</label>)}</div>}
          <p className="mt-3 text-xs text-slate-500">Simulação: não envia avisos reais e não modifica dados da empresa.</p>
          <button disabled={!titulo.trim()||destinatarios.length===0} onClick={salvar} className="mt-4 flex w-full justify-center gap-2 rounded-lg bg-blue-700 p-3 text-sm font-bold text-white disabled:opacity-50"><Check size={16}/> Criar na prévia</button>
        </div></div>}
      </div>
    </main>
  )
}
