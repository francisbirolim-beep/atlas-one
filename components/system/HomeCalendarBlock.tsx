'use client'

import { useEffect, useMemo, useState } from 'react'
import { CalendarDays, Check, ChevronLeft, ChevronRight, Clock3, MapPin, Plus, RotateCcw, X } from 'lucide-react'
import { usuarioAtual } from '@/lib/auth'
import { concluirEventoUsuario, criarEvento, criarEventoRecorrente, listarConclusoesEventosUsuario, listarEventosDoUsuario, listarUsuariosConvidaveis, reabrirEventoUsuario, type EventoComConvite } from '@/lib/eventos'
import type { TipoRecorrencia } from '@/lib/recorrencia'
import BotaoMicrofone from '@/components/BotaoMicrofone'
import { interpretarComandoDeVoz } from '@/lib/comandoVoz'
import type { Usuario } from '@/lib/tipos'

const MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']
const DIAS = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S']

function mesmoDia(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}

function dataInput(d = new Date()) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const dia = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${dia}`
}

function hora(iso: string) {
  return new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' }).format(new Date(iso))
}

export default function HomeCalendarBlock() {
  const [usuario, setUsuario] = useState<Usuario | null>(null)
  const [eventos, setEventos] = useState<EventoComConvite[]>([])
  const [conclusoes, setConclusoes] = useState<Record<string, string>>({})
  const [mostrarConcluidos, setMostrarConcluidos] = useState(false)
  const [alterandoId, setAlterandoId] = useState<string | null>(null)
  const [carregando, setCarregando] = useState(true)
  const [mes, setMes] = useState(() => { const d = new Date(); d.setDate(1); return d })
  const [diaSelecionado, setDiaSelecionado] = useState(() => new Date())
  const [modal, setModal] = useState(false)
  const [titulo, setTitulo] = useState('')
  const [data, setData] = useState(dataInput())
  const [inicio, setInicio] = useState('09:00')
  const [fim, setFim] = useState('10:00')
  const [local, setLocal] = useState('')
  const [usuarios, setUsuarios] = useState<{ id: string; nome: string }[]>([])
  const [convidados, setConvidados] = useState<string[]>([])
  const [buscaUsuario, setBuscaUsuario] = useState('')
  const [recorrencia, setRecorrencia] = useState<TipoRecorrencia | ''>('')
  const [valorRecorrencia, setValorRecorrencia] = useState(5)
  const [erroAgenda, setErroAgenda] = useState('')
  const [salvando, setSalvando] = useState(false)

  useEffect(() => {
    let ativo = true
    usuarioAtual().then(async u => {
      if (!ativo) return
      setUsuario(u)
      if (!u) { setCarregando(false); return }
      const [lista, concluidas] = await Promise.all([listarEventosDoUsuario(u.id), listarConclusoesEventosUsuario(u.id)])
      if (!ativo) return
      setEventos(lista)
      setConclusoes(concluidas)
      setCarregando(false)
    })
    return () => { ativo = false }
  }, [])

  useEffect(() => {
    const abrir = () => void abrirModal()
    window.addEventListener('atlas:novo-compromisso', abrir)
    return () => window.removeEventListener('atlas:novo-compromisso', abrir)
  }, [usuario])

  const celulas = useMemo(() => {
    const lista: (Date | null)[] = []
    const primeiroDia = mes.getDay()
    const diasNoMes = new Date(mes.getFullYear(), mes.getMonth() + 1, 0).getDate()
    for (let i = 0; i < primeiroDia; i++) lista.push(null)
    for (let d = 1; d <= diasNoMes; d++) lista.push(new Date(mes.getFullYear(), mes.getMonth(), d))
    return lista
  }, [mes])

  const eventosDoDia = eventos
    .filter(e => e.meuStatus !== 'recusado')
    .filter(e => mostrarConcluidos || !conclusoes[e.id])
    .filter(e => mesmoDia(new Date(e.data_inicio), diaSelecionado))
    .sort((a, b) => new Date(a.data_inicio).getTime() - new Date(b.data_inicio).getTime())
  const concluidosDoDia = eventos.filter(e => e.meuStatus !== 'recusado' && conclusoes[e.id] && mesmoDia(new Date(e.data_inicio), diaSelecionado)).length

  function temEvento(dia: Date) {
    return eventos.some(e => e.meuStatus !== 'recusado' && !conclusoes[e.id] && mesmoDia(new Date(e.data_inicio), dia))
  }

  async function abrirModal() {
    setData(dataInput(diaSelecionado))
    setModal(true)
    if (usuario && usuarios.length === 0) setUsuarios(await listarUsuariosConvidaveis(usuario.id))
  }

  async function salvar() {
    if (!usuario || !titulo.trim() || !data) return
    const dataInicio = new Date(`${data}T${inicio}:00`)
    const dataFim = new Date(`${data}T${fim}:00`)
    if (dataFim.getTime() <= dataInicio.getTime()) {
      alert('O horário final precisa ser depois do horário inicial.')
      return
    }
    setSalvando(true)
    const dadosEvento = {
      titulo: titulo.trim(),
      local: local.trim() || undefined,
      data_inicio: dataInicio.toISOString(),
      data_fim: dataFim.toISOString(),
    }
    const criado = recorrencia
      ? await criarEventoRecorrente(usuario.id,dadosEvento,recorrencia,
        recorrencia==='dia_util_mes'?5:recorrencia==='dia_fixo_mes'?new Date(dataInicio).getDate():valorRecorrencia,convidados)
      : await criarEvento(usuario.id,dadosEvento,convidados)
    if (criado) {
      setEventos(await listarEventosDoUsuario(usuario.id))
      setDiaSelecionado(dataInicio)
      const novoMes = new Date(dataInicio)
      novoMes.setDate(1)
      setMes(novoMes)
    }
    if(!criado){setErroAgenda('Não foi possível salvar. Verifique os dados e tente novamente.');setSalvando(false);return}
    setTitulo('')
    setLocal('')
    setConvidados([])
    setRecorrencia('');setBuscaUsuario('');setErroAgenda('')
    setModal(false)
    setSalvando(false)
  }

  async function alternarConclusao(evento: EventoComConvite) {
    if (!usuario || alterandoId) return
    setAlterandoId(evento.id)
    const jaConcluido = Boolean(conclusoes[evento.id])
    const resultado = jaConcluido
      ? await reabrirEventoUsuario(evento.id, usuario.id)
      : await concluirEventoUsuario(evento.id, usuario.id)
    if (!resultado) {
      alert(jaConcluido ? 'Não foi possível reabrir este compromisso.' : 'Não foi possível concluir este compromisso.')
    } else {
      setConclusoes(prev => {
        const copia = { ...prev }
        if (jaConcluido) delete copia[evento.id]
        else copia[evento.id] = typeof resultado === 'string' ? resultado : new Date().toISOString()
        return copia
      })
    }
    setAlterandoId(null)
  }

  function aoFalar(texto:string){
    const interpretado=interpretarComandoDeVoz(texto)
    setTitulo(interpretado.titulo)
    if(interpretado.data){setData(dataInput(interpretado.data));setInicio(new Intl.DateTimeFormat('pt-BR',{hour:'2-digit',minute:'2-digit',hour12:false}).format(interpretado.data))}
  }
  function alternarConvidado(id: string) {
    setConvidados(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  }

  return (
    <>
      <article className="h-full min-w-0 rounded-2xl border border-slate-200 bg-white p-3 text-slate-900 shadow-sm sm:p-4">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2"><CalendarDays size={17} className="text-blue-600" /><h2 className="font-semibold">Calendário</h2></div>
          <button type="button" onClick={() => void abrirModal()} className="inline-flex items-center gap-1 rounded-lg bg-blue-50 px-2.5 py-1.5 text-xs font-medium text-blue-700 transition hover:bg-blue-100"><Plus size={13}/> Novo</button>
        </div>

        <div className="grid min-w-0 gap-3 xl:grid-cols-[minmax(260px,1fr)_minmax(0,1fr)]">
          <div className="min-w-0 rounded-xl border border-slate-200 bg-white p-3">
            <div className="mb-2 flex items-center justify-between">
              <button type="button" onClick={() => setMes(new Date(mes.getFullYear(), mes.getMonth() - 1, 1))} className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-900"><ChevronLeft size={15}/></button>
              <strong className="text-xs text-slate-800">{MESES[mes.getMonth()]} {mes.getFullYear()}</strong>
              <button type="button" onClick={() => setMes(new Date(mes.getFullYear(), mes.getMonth() + 1, 1))} className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-900"><ChevronRight size={15}/></button>
            </div>
            <div className="grid grid-cols-7 text-center text-[10px] text-slate-400">{DIAS.map((d, i) => <span key={`${d}-${i}`} className="py-1">{d}</span>)}</div>
            <div className="grid grid-cols-7 gap-0.5">
              {celulas.map((dia, i) => dia ? (
                <button key={i} type="button" onClick={() => setDiaSelecionado(dia)} className={`relative h-8 rounded-lg text-[11px] transition ${mesmoDia(dia, diaSelecionado) ? 'bg-blue-600 font-semibold text-white' : mesmoDia(dia, new Date()) ? 'bg-blue-50 font-semibold text-blue-700' : 'text-slate-700 hover:bg-slate-100 hover:text-slate-900'}`}>
                  {dia.getDate()}
                  {temEvento(dia) && <span className={`absolute bottom-1 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full ${mesmoDia(dia, diaSelecionado) ? 'bg-white' : 'bg-blue-500'}`} />}
                </button>
              ) : <span key={i} className="h-8" />)}
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-3">
            <div className="mb-2 flex items-center justify-between"><p className="text-xs font-semibold text-slate-700">Agendamentos do dia — {mesmoDia(diaSelecionado, new Date()) ? 'Hoje' : new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short' }).format(diaSelecionado)}</p><span className="text-[10px] text-slate-400">{eventosDoDia.filter(e => !conclusoes[e.id]).length} pendente(s)</span></div>
            <label className="mb-2 flex cursor-pointer items-center gap-2 text-[11px] text-slate-600">
              <input type="checkbox" checked={mostrarConcluidos} onChange={e => setMostrarConcluidos(e.target.checked)} className="accent-emerald-600" />
              Mostrar concluídos ({concluidosDoDia})
            </label>
            {carregando ? <p className="py-5 text-sm text-slate-400">Carregando...</p> : eventosDoDia.length === 0 ? <p className="py-5 text-sm text-slate-500">Nenhum compromisso neste dia.</p> : (
              <div className="max-h-[270px] space-y-2 overflow-y-auto pr-1">
                {eventosDoDia.map(evento => (
                  <div key={evento.id} className={`rounded-lg border border-slate-200 px-2.5 py-2 ${conclusoes[evento.id] ? 'bg-emerald-50/50' : 'bg-white'}`}>
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className={`break-words text-sm font-medium ${conclusoes[evento.id] ? 'text-slate-500 line-through' : 'text-slate-800'}`}>{evento.titulo}</p>
                        {evento.local && <p className="mt-1 flex items-center gap-1 text-[11px] text-slate-500"><MapPin size={10}/>{evento.local}</p>}
                      </div>
                      <span className="shrink-0 text-[10px] text-blue-700">{hora(evento.data_inicio)}</span>
                    </div>
                    <button type="button" disabled={alterandoId === evento.id} onClick={() => void alternarConclusao(evento)}
                      className={`mt-1.5 inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[10px] font-semibold disabled:opacity-50 ${conclusoes[evento.id] ? 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50' : 'bg-emerald-600 text-white hover:bg-emerald-700'}`}>
                      {conclusoes[evento.id] ? <RotateCcw size={12}/> : <Check size={12}/>}
                      {conclusoes[evento.id] ? 'Reabrir compromisso' : 'Marcar como concluído'}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </article>

      {modal && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl">
            <div className="mb-4 flex items-center justify-between"><div><h3 className="font-semibold text-slate-900">Novo compromisso</h3><p className="text-xs text-slate-500">Adicione à sua agenda e convide usuários.</p></div><button type="button" onClick={() => setModal(false)} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100"><X size={17}/></button></div>
            <div className="space-y-3">
              <div className="flex items-center gap-2"><input autoFocus value={titulo} onChange={e => setTitulo(e.target.value)} placeholder="Título do compromisso" className="w-full min-w-0 rounded-xl border border-slate-300 p-3 text-sm" /><BotaoMicrofone onResultado={aoFalar} titulo="Ditar compromisso" className="rounded-xl border border-blue-200 bg-blue-50 p-3 text-blue-700"/></div>
              <input type="date" value={data} onChange={e => setData(e.target.value)} className="w-full rounded-xl border border-slate-300 p-3 text-sm" />
              <div className="grid grid-cols-2 gap-2"><label className="text-xs text-slate-500">Início<input type="time" value={inicio} onChange={e => setInicio(e.target.value)} className="mt-1 w-full rounded-xl border border-slate-300 p-3 text-sm"/></label><label className="text-xs text-slate-500">Fim<input type="time" value={fim} onChange={e => setFim(e.target.value)} className="mt-1 w-full rounded-xl border border-slate-300 p-3 text-sm"/></label></div>
              <input value={local} onChange={e => setLocal(e.target.value)} placeholder="Local (opcional)" className="w-full rounded-xl border border-slate-300 p-3 text-sm" />
              {usuarios.length > 0 && <div><p className="mb-2 text-xs font-medium text-slate-600">Convidar usuários</p>
                <input value={buscaUsuario} onChange={e=>setBuscaUsuario(e.target.value)} placeholder="Pesquisar usuário pelo nome..."
                  className="mb-1 w-full rounded-lg border border-slate-300 px-2 py-2 text-xs"/>
                <div className="max-h-32 space-y-1 overflow-y-auto rounded-xl border border-slate-200 p-2">
                  {usuarios.filter(u=>u.nome.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').includes(buscaUsuario.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,''))).map(u=>
                    <label key={u.id} className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-slate-700 hover:bg-slate-50"><input type="checkbox" checked={convidados.includes(u.id)} onChange={()=>alternarConvidado(u.id)}/>{u.nome}</label>)}
                </div>
                <p className="mt-1 text-[11px] text-slate-500">{convidados.length} participante(s) selecionado(s)</p>
              </div>}
              <div className="space-y-2 rounded-xl border border-slate-200 p-2.5">
                <p className="text-xs font-semibold text-slate-700">Repetição do compromisso</p>
                <select value={recorrencia} onChange={e=>setRecorrencia(e.target.value as TipoRecorrencia | '')}
                  className="w-full rounded-lg border border-slate-300 bg-white p-2 text-xs">
                  <option value="">Uma vez</option><option value="semanal">Toda semana (mesmo dia)</option>
                  <option value="dia_fixo_mes">Todo mês (mesmo dia)</option><option value="dia_util_mes">Todo 5º dia útil</option>
                </select>
                {recorrencia==='dia_util_mes'&&<p className="text-[11px] text-amber-700">Conferir feriados aplicáveis ao setor antes de confirmar o vencimento.</p>}
              </div>
              {erroAgenda&&<p role="alert" className="rounded-lg bg-red-50 p-2 text-xs text-red-700">{erroAgenda}</p>}
              <button type="button" onClick={() => void salvar()} disabled={salvando || !titulo.trim()} className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 py-3 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-50"><Clock3 size={15}/>{salvando ? 'Salvando...' : 'Salvar compromisso'}</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
