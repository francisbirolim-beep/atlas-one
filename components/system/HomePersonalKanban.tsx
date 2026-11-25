'use client'

import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent, type ReactNode } from 'react'
import { ArrowLeft, ArrowRight, Check, Clock3, Columns3, GripVertical, MoreHorizontal, Pencil, Plus } from 'lucide-react'
import { usuarioAtual } from '@/lib/auth'
import { buscarDelegadasHome, carregarTrabalhoHome } from '@/lib/homeLeituras'
import {
  concluirTarefa, criarColunaTarefa, listarColunasTarefas, listarTarefas,
  moverTarefa, reabrirTarefa, renomearColunaTarefa, reordenarColunasTarefa,
} from '@/lib/tarefas'
import { listarEventosDoUsuario, listarConclusoesEventosUsuario, concluirEventoUsuario, reabrirEventoUsuario, listarConvidados, type EventoComConvite } from '@/lib/eventos'
import { confirmarMovimentoKanban } from '@/lib/kanbanConfirmacao'
import { listarEquipe, movimentarEquipe, avisarMudancaEquipe, type EquipeTarefa, type StatusEquipe } from '@/lib/tarefasEquipeCliente'
import CardTarefaEquipe from '@/components/system/CardTarefaEquipe'
import DetalheTarefaEquipe from '@/components/system/DetalheTarefaEquipe'
import type { TarefaPessoal, TarefaPessoalColuna, Usuario } from '@/lib/tipos'

type Delegada = TarefaPessoal & { responsavel_nome: string; coluna_nome: string }
function etapaDelegada(t: Delegada): 'pedido' | 'andamento' | 'aguardando' | 'concluido' {
  if (t.concluida_em) return 'concluido'
  const nome = semAcentos(t.coluna_nome || '')
  if (/andamento|execucao|fazendo/.test(nome)) return 'andamento'
  if (/aguard|espera/.test(nome)) return 'aguardando'
  return 'pedido'
}
function CardDelegado({ tarefa, onAbrir }: { tarefa: Delegada; onAbrir: () => void }) {
  return (
    <button type="button" onClick={onAbrir} className="block w-full rounded-lg border border-violet-200 bg-white px-2 py-2 text-left shadow-sm" aria-label={'Abrir tarefa ' + tarefa.titulo}>
      <p className="truncate text-xs font-semibold text-slate-800" title={tarefa.titulo}>{tarefa.titulo}</p>
      <p className="mt-0.5 truncate text-[11px] text-violet-700">Responsável: {tarefa.responsavel_nome}</p>
      <p className="mt-0.5 truncate text-[10px] text-slate-600">Prazo: {dataPrazo(tarefa.data_hora)}</p>
      <p className="mt-0.5 truncate text-[10px] text-slate-500">Situação: {tarefa.concluida_em ? 'Concluído' : tarefa.coluna_nome}</p>
    </button>
  )
}
const cores = {
  inicial: { lateral: 'border-l-slate-500', fundo: 'bg-slate-100/70', cabecalho: 'bg-slate-200', texto: 'text-slate-800', marcador: 'bg-slate-500' },
  andamento: { lateral: 'border-l-blue-600', fundo: 'bg-blue-50/70', cabecalho: 'bg-blue-200', texto: 'text-blue-900', marcador: 'bg-blue-600' },
  aguardando: { lateral: 'border-l-amber-500', fundo: 'bg-amber-50/70', cabecalho: 'bg-amber-200', texto: 'text-amber-900', marcador: 'bg-amber-500' },
  concluido: { lateral: 'border-l-emerald-600', fundo: 'bg-emerald-50/70', cabecalho: 'bg-emerald-200', texto: 'text-emerald-900', marcador: 'bg-emerald-600' },
}

function semAcentos(s: string) {
  return s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
}

function tipoColuna(coluna: TarefaPessoalColuna, indice: number): keyof typeof cores {
  const nome = semAcentos(coluna.nome)
  if (/conclu|finaliz|feito|feita/.test(nome)) return 'concluido'
  if (/aguard|espera|pendente/.test(nome)) return 'aguardando'
  if (/andamento|execucao|fazendo/.test(nome)) return 'andamento'
  return indice === 0 ? 'inicial' : indice % 2 ? 'andamento' : 'aguardando'
}

function dataPrazo(iso?: string | null) {
  if (!iso) return 'Sem prazo'
  return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }).format(new Date(iso))
}


/** Mês local do usuário; não usar recorte UTC para evitar trocas de dia perto da meia-noite. */
function mesDaData(iso?: string | null): string | null {
  if (!iso) return null
  const data = new Date(iso)
  if (Number.isNaN(data.getTime())) return null
  return `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, '0')}`
}

function mesAtual() {
  return mesDaData(new Date().toISOString())!
}

function mesAdjacente(mes: string, deslocamento: number): string {
  const [ano, numero] = mes.split('-').map(Number)
  const nova = new Date(ano, numero - 1 + deslocamento, 1)
  return `${nova.getFullYear()}-${String(nova.getMonth() + 1).padStart(2, '0')}`
}

function periodoExtenso(mes: string) {
  const [ano, numero] = mes.split('-').map(Number)
  return new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' }).format(new Date(ano, numero - 1, 1))
}

type DetalheLocal = { tipo: 'evento' | 'pessoal' | 'delegada'; id: string }

function dataCompleta(iso?: string | null) {
  if (!iso) return 'Não informado'
  const data = new Date(iso)
  return Number.isNaN(data.getTime()) ? 'Não informado' : new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(data)
}

function JanelaDetalhe({ titulo, onFechar, children }: { titulo: string; onFechar: () => void; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const dialog = ref.current
    if (dialog && !dialog.open) dialog.showModal()
    return () => { if (dialog?.open) dialog.close() }
  }, [])
  return <dialog ref={ref} onCancel={e => { e.preventDefault(); onFechar() }}
    aria-label={titulo} className="m-auto w-[calc(100%-2rem)] max-w-lg max-h-[85dvh] overflow-y-auto rounded-2xl border border-slate-200 bg-white p-0 text-slate-900 shadow-xl backdrop:bg-slate-900/40">
    <header className="sticky top-0 z-10 flex items-start justify-between gap-3 border-b border-slate-200 bg-white p-4">
      <h2 className="min-w-0 break-words text-base font-bold">{titulo}</h2>
      <button type="button" onClick={onFechar} className="shrink-0 rounded-lg border border-slate-200 px-3 py-2 text-sm">Fechar</button>
    </header>
    <div className="space-y-3 break-words p-4 text-sm">{children}</div>
  </dialog>
}

function ConvidadosDetalhe({ id }: { id: string }) {
  const [nomes, setNomes] = useState<string[] | null>(null)
  useEffect(() => {
    let ativo = true
    setNomes(null)
    void listarConvidados(id).then(lista => {
      if (ativo) setNomes(lista.map(c => c.nome ? c.nome + ' (' + c.status + ')' : 'Participante (' + c.status + ')'))
    }).catch(() => { if (ativo) setNomes([]) })
    return () => { ativo = false }
  }, [id])
  return <p><strong>Convidados:</strong> {nomes === null ? 'Carregando...' : nomes.length ? nomes.join(', ') : 'Nenhum convidado disponível'}</p>
}

// Alça independente da rolagem: o cartão só muda após soltar e confirmar.
function AlcaMobile({ onMover, disabled }: { onMover: (direcao: -1 | 1) => void; disabled: boolean }) {
  const inicio = useRef<{ id: number; x: number; y: number } | null>(null)
  const [deslocamento, setDeslocamento] = useState(0)
  function cancelar() { inicio.current = null; setDeslocamento(0) }
  function iniciar(e: PointerEvent<HTMLButtonElement>) {
    if (disabled || !e.isPrimary || e.pointerType === 'mouse') return
    inicio.current = { id: e.pointerId, x: e.clientX, y: e.clientY }
    e.currentTarget.setPointerCapture(e.pointerId)
  }
  function finalizar(e: PointerEvent<HTMLButtonElement>) {
    const p = inicio.current
    cancelar()
    if (!p || p.id !== e.pointerId || disabled) return
    const dx = e.clientX - p.x, dy = e.clientY - p.y
    if (Math.abs(dx) >= 55 && Math.abs(dx) > Math.abs(dy) * 1.3) onMover(dx > 0 ? 1 : -1)
  }
  return <button type="button" data-kanban-drag disabled={disabled}
    onPointerDown={iniciar} onPointerMove={e => { const p = inicio.current; if (p?.id === e.pointerId) setDeslocamento(e.clientX - p.x) }}
    onPointerUp={finalizar} onPointerCancel={cancelar} onLostPointerCapture={cancelar}
    aria-label="Arraste para mover à coluna anterior ou seguinte"
    className="flex w-full touch-none select-none items-center justify-center gap-1 rounded-md border border-slate-200 bg-slate-50 px-2 py-2 text-xs font-semibold text-slate-600 disabled:opacity-40 md:hidden">
    <GripVertical size={14}/> {deslocamento > 30 ? 'Solte para mover à direita' : deslocamento < -30 ? 'Solte para mover à esquerda' : 'Arraste para mover a tarefa'}
  </button>
}

export default function HomePersonalKanban({ somenteEquipe = false }: { somenteEquipe?: boolean } = {}) {
  const [usuario, setUsuario] = useState<Usuario | null>(null)
  const [colunas, setColunas] = useState<TarefaPessoalColuna[]>([])
  const [tarefas, setTarefas] = useState<TarefaPessoal[]>([])
  const [delegadas, setDelegadas] = useState<Delegada[]>([])
  const [equipe, setEquipe] = useState<EquipeTarefa[]>([])
  const [eventos, setEventos] = useState<EventoComConvite[]>([])
  const [conclusoesEventos, setConclusoesEventos] = useState<Record<string,string>>({})
  const [aba, setAba] = useState<'minhas'|'delegadas'>('minhas')
  const [colunaMobile, setColunaMobile] = useState<string | null>(null)
  const [detalheId, setDetalheId] = useState<string|null>(null)
  const [detalheLocal, setDetalheLocal] = useState<DetalheLocal | null>(null)
  const toqueColuna = useRef<{ x: number; y: number; id: number } | null>(null)
  const bloquearCliqueAte = useRef(0)
  const [carregando, setCarregando] = useState(true)
  const [personalizando, setPersonalizando] = useState(false)
  const [filtrosAbertos,setFiltrosAbertos] = useState(false)
  const [salvando, setSalvando] = useState(false)
  const [arrastando, setArrastando] = useState<string | null>(null)
  const [menuTarefaAberto, setMenuTarefaAberto] = useState<string | null>(null)
  const [erro, setErro] = useState('')
  const [mesSelecionado, setMesSelecionado] = useState(mesAtual)
  const [todosPeriodos, setTodosPeriodos] = useState(true)
  const [manterPendenciasAnteriores, setManterPendenciasAnteriores] = useState(true)
  const [busca, setBusca] = useState('')
  const [filtro, setFiltro] = useState<'todos' | 'atrasadas' | 'urgentes' | 'alta' | 'sem-prazo'>('todos')


  useEffect(() => {
    let ativo = true
    usuarioAtual().then(async u => {
      if (!ativo) return
      setUsuario(u)
      if (u) {
        const {colunas:cls,tarefas:ts,delegadas:ds,equipe:es,eventos:ev,conclusoes:ce} = await carregarTrabalhoHome(u.id)
        if (ativo) { setColunas(cls); setTarefas(ts); setDelegadas(ds); setEquipe(es); setEventos(ev); setConclusoesEventos(ce) }
      }
      if (ativo) setCarregando(false)
    }).catch(() => { if (ativo) setCarregando(false) })
    return () => { ativo = false }
  }, [])

  const atualizar = useCallback(async () => {
    if (!usuario) return
    const [cls, ts, ds, es, ev, ce] = await Promise.all([listarColunasTarefas(usuario.id), listarTarefas(usuario.id), buscarDelegadasHome(), listarEquipe().catch(()=>[]), listarEventosDoUsuario(usuario.id), listarConclusoesEventosUsuario(usuario.id)])
    setColunas(cls)
    setTarefas(ts)
    setDelegadas(ds)
    setEquipe(es)
    setEventos(ev)
    setConclusoesEventos(ce)
  }, [usuario])

  useEffect(() => {
    if (!usuario) return
    const aoAtualizar = () => { void atualizar() }
    const aoFocar = () => { if (document.visibilityState === 'visible') aoAtualizar() }
    window.addEventListener('atlas:tarefas-atualizadas', aoAtualizar)
    window.addEventListener('atlas:tarefas-equipe-atualizadas', aoAtualizar)
    window.addEventListener('atlas:eventos-atualizados', aoAtualizar)
    document.addEventListener('visibilitychange', aoFocar)
    window.addEventListener('focus', aoFocar)
    const intervalo = window.setInterval(aoFocar, 45000)
    return () => {
      window.removeEventListener('atlas:tarefas-atualizadas', aoAtualizar)
      window.removeEventListener('atlas:tarefas-equipe-atualizadas', aoAtualizar)
      window.removeEventListener('atlas:eventos-atualizados', aoAtualizar)
      document.removeEventListener('visibilitychange', aoFocar)
      window.removeEventListener('focus', aoFocar)
      window.clearInterval(intervalo)
    }
  }, [usuario, atualizar])

  useEffect(()=>{
    const aoAbrir=(ev:Event)=>{ const id=(ev as CustomEvent<{id?:string}>).detail?.id; if(id)setDetalheId(id) }
    window.addEventListener('atlas:abrir-tarefa-equipe',aoAbrir)
    const id=new URLSearchParams(window.location.search).get('tarefa')
    if(id)setDetalheId(id)
    return()=>window.removeEventListener('atlas:abrir-tarefa-equipe',aoAbrir)
  },[])

  const final = useMemo(() => colunas.find((c, i) => tipoColuna(c, i) === 'concluido'), [colunas])
  const inicial = colunas.find((c,i)=>tipoColuna(c,i)==='inicial') || colunas[0]
  const etapasMobile = [...(aba === 'delegadas' ? [{id:'pedidos',nome:'Pedidos de tarefa'}] : []), ...colunas]
  const etapaMobile = etapasMobile.find(c=>c.id===colunaMobile) || (aba === 'minhas' ? inicial : etapasMobile[0])
  const indiceMobile = etapasMobile.findIndex(c=>c.id===etapaMobile?.id)
  const eventoAberto = detalheLocal?.tipo === 'evento' ? eventos.find(e => e.id === detalheLocal.id) : undefined
  const pessoalAberta = detalheLocal?.tipo === 'pessoal' ? tarefas.find(t => t.id === detalheLocal.id) : undefined
  const delegadaAberta = detalheLocal?.tipo === 'delegada' ? delegadas.find(t => t.id === detalheLocal.id) : undefined
  const tarefaAberta = pessoalAberta || delegadaAberta
  function navegarMobile(direcao: -1 | 1) {
    const destino = etapasMobile[indiceMobile + direcao]
    if (destino) setColunaMobile(destino.id)
  }
  function destinoEquipeMobile(indice: number, direcao: -1 | 1): StatusEquipe | null {
    const destino = colunas[indice + direcao]
    if (!destino) return null
    const tipo = tipoColuna(destino, indice + direcao)
    return tipo === 'concluido' ? 'concluido' : tipo === 'andamento' ? 'em_andamento' : tipo === 'aguardando' ? 'aguardando' : 'a_fazer'
  }
  const trocarAba = (nova: 'minhas'|'delegadas') => { setAba(nova); setColunaMobile(null) }
  const colunaExibida = (t: TarefaPessoal) => t.concluida_em && final ? final.id : t.coluna_id
  const abertas = (somenteEquipe ? [] : tarefas).filter(t => !t.concluida_em)
  const atrasadas = abertas.filter(t => t.data_hora && new Date(t.data_hora).getTime() < Date.now()).length

  const tarefasFiltradas = useMemo(() => {
    const consulta = semAcentos(busca.trim())
    const agora = Date.now()
    return (somenteEquipe ? [] : tarefas).filter(t => {
      const concluida = Boolean(t.concluida_em)
      if (!todosPeriodos) {
        // Concluídos: mês de conclusão. Abertos: prazo (ou criação, quando não houver prazo).
        const mesReferencia = mesDaData(concluida ? t.concluida_em : t.data_hora || t.atribuida_em || t.created_at)
        if (concluida) {
          if (mesReferencia !== mesSelecionado) return false
        } else if (mesReferencia !== mesSelecionado) {
          // Uma pendência antiga nunca deve sumir silenciosamente do fluxo de trabalho.
          if (!manterPendenciasAnteriores || (mesReferencia !== null && mesReferencia > mesSelecionado)) return false
        }
      }
      if (consulta && !semAcentos([t.titulo, t.descricao || '', t.solicitante_nome || ''].join(' ')).includes(consulta)) return false
      if (filtro === 'atrasadas') return !concluida && Boolean(t.data_hora) && new Date(t.data_hora!).getTime() < agora
      if (filtro === 'urgentes') return t.prioridade === 'urgente'
      if (filtro === 'alta') return t.prioridade === 'alta'
      if (filtro === 'sem-prazo') return !t.data_hora
      return true
    })
  }, [tarefas, somenteEquipe, todosPeriodos, mesSelecionado, manterPendenciasAnteriores, busca, filtro])

  const delegadasFiltradas = useMemo(() => {
    const consulta = semAcentos(busca.trim())
    return delegadas.filter(t => {
      const concluida = Boolean(t.concluida_em)
      const mes = mesDaData(concluida ? t.concluida_em : t.data_hora || t.atribuida_em || t.created_at)
      if (!todosPeriodos && (concluida ? mes !== mesSelecionado : mes !== mesSelecionado &&
        (!manterPendenciasAnteriores || Boolean(mes && mes > mesSelecionado)))) return false
      if (consulta && !semAcentos([t.titulo, t.descricao || '', t.responsavel_nome].join(' ')).includes(consulta)) return false
      if (filtro === 'atrasadas') return !concluida && Boolean(t.data_hora) && new Date(t.data_hora!).getTime() < Date.now()
      if (filtro === 'urgentes') return t.prioridade === 'urgente'
      if (filtro === 'alta') return t.prioridade === 'alta'
      if (filtro === 'sem-prazo') return !t.data_hora
      return true
    })
  }, [delegadas, todosPeriodos, mesSelecionado, manterPendenciasAnteriores, busca, filtro])

  const equipeFiltrada = useMemo(()=>{
    const consulta=semAcentos(busca.trim())
    return equipe.filter(t=>{
      const envolve=aba==='minhas'
        ? t.responsaveis_ids.includes(usuario?.id||'')
        : t.criado_por_id===usuario?.id
      if(!envolve)return false
      const concluida=t.status==='concluido'
      const mes=mesDaData(concluida?t.concluida_em:t.data_hora||t.created_at)
      if(!todosPeriodos && (concluida?mes!==mesSelecionado:
        mes!==mesSelecionado && (!manterPendenciasAnteriores || Boolean(mes&&mes>mesSelecionado))))return false
      if(consulta && !semAcentos([t.titulo,t.descricao||'',t.criador_nome,...t.responsaveis_nomes].join(' ')).includes(consulta))return false
      if(filtro==='atrasadas')return !concluida&&Boolean(t.data_hora)&&new Date(t.data_hora!).getTime()<Date.now()
      if(filtro==='urgentes')return t.prioridade==='urgente'
      if(filtro==='alta')return t.prioridade==='alta'
      if(filtro==='sem-prazo')return !t.data_hora
      return true
    })
  },[equipe,aba,usuario,mesSelecionado,todosPeriodos,manterPendenciasAnteriores,busca,filtro])

  const eventosFiltrados = useMemo(() => {
    const consulta = semAcentos(busca.trim())
    if (aba !== 'minhas' || filtro === 'urgentes' || filtro === 'alta' || filtro === 'sem-prazo') return []
    return Array.from(new Map(eventos.map(e => [e.id,e])).values()).filter(e => {
      if (e.meuStatus === 'recusado') return false
      const concluido = conclusoesEventos[e.id]
      const mes = mesDaData(concluido || e.data_inicio)
      if (!todosPeriodos && (concluido ? mes !== mesSelecionado :
        mes !== mesSelecionado && (!manterPendenciasAnteriores || Boolean(mes && mes > mesSelecionado)))) return false
      if (consulta && !semAcentos([e.titulo,e.descricao||'',e.local||''].join(' ')).includes(consulta)) return false
      if (filtro === 'atrasadas') return !concluido && new Date(e.data_inicio).getTime() < Date.now()
      return true
    })
  }, [eventos, conclusoesEventos, aba, filtro, busca, todosPeriodos, mesSelecionado, manterPendenciasAnteriores])

  async function alternarEvento(e: EventoComConvite) {
    if (!usuario || salvando) return
    setSalvando(true); setErro('')
    try {
      const ok = conclusoesEventos[e.id] ? await reabrirEventoUsuario(e.id, usuario.id) : await concluirEventoUsuario(e.id, usuario.id)
      if (!ok) throw new Error('Não foi possível atualizar o compromisso.')
      window.dispatchEvent(new Event('atlas:eventos-atualizados'))
      await atualizar()
    } catch (err) { setErro(err instanceof Error ? err.message : 'Erro ao atualizar o compromisso.') }
    finally { setSalvando(false) }
  }

  function etapaEquipe(t:EquipeTarefa):'pedido'|'a_fazer'|'em_andamento'|'aguardando'|'concluido'{
    if(usuario && t.status==='a_fazer' && t.criado_por_id===usuario.id &&
       !t.responsaveis_ids.includes(usuario.id))return 'pedido'
    return t.status
  }

  async function mudarEquipe(t:EquipeTarefa,destino:StatusEquipe){
    if(salvando||t.status===destino)return
    if(!usuario||!t.responsaveis_ids.includes(usuario.id)){
      setErro('Somente os responsáveis movimentam pedidos. O andamento é atualizado automaticamente.')
      return
    }
    const nomes:Record<StatusEquipe,string>={a_fazer:'A fazer',em_andamento:'Em andamento',aguardando:'Aguardando',concluido:'Concluído'}
    if(!confirmarMovimentoKanban({
      card:t.titulo,origem:nomes[t.status],destino:nomes[destino],
      retrocesso:['a_fazer','em_andamento','aguardando','concluido'].indexOf(destino)<
        ['a_fazer','em_andamento','aguardando','concluido'].indexOf(t.status),
    }))return
    setSalvando(true);setErro('')
    try{await movimentarEquipe(t.id,destino);avisarMudancaEquipe();await atualizar()}
    catch(e){setErro(e instanceof Error?e.message:'Não foi possível alterar a tarefa.')}
    finally{setSalvando(false)}
  }

  function limparFiltros() {
    setMesSelecionado(mesAtual())
    setTodosPeriodos(true)
    setManterPendenciasAnteriores(true)
    setBusca('')
    setFiltro('todos')
  }


  async function mudarColuna(t: TarefaPessoal, destinoId: string) {
    if (salvando || colunaExibida(t) === destinoId) return
    const origem = colunas.find(c => c.id === colunaExibida(t))
    const destino = colunas.find(c => c.id === destinoId)
    if (!destino) return
    if (!confirmarMovimentoKanban({
      card: t.titulo, origem: origem?.nome || 'Etapa anterior', destino: destino.nome,
      retrocesso: colunas.findIndex(c => c.id === destinoId) < colunas.findIndex(c => c.id === colunaExibida(t)),
    })) return
    setSalvando(true)
    setErro('')
    try {
      if (!(await moverTarefa(t.id, destinoId))) throw new Error('Não foi possível mover a tarefa.')
      if (final?.id === destinoId && !t.concluida_em && !(await concluirTarefa(t.id))) {
        throw new Error('A tarefa foi movida, mas não foi possível concluir.')
      }
      if (final?.id !== destinoId && t.concluida_em && !(await reabrirTarefa(t.id))) {
        throw new Error('A tarefa foi movida, mas não foi possível reabrir.')
      }
      window.dispatchEvent(new Event('atlas:tarefas-atualizadas'))
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro ao mover tarefa.')
    } finally {
      await atualizar()
      setSalvando(false)
    }
  }

  async function alternarConclusao(t: TarefaPessoal) {
    if (salvando) return
    setSalvando(true)
    setErro('')
    const ok = t.concluida_em ? await reabrirTarefa(t.id) : await concluirTarefa(t.id)
    if (!ok) setErro('Não foi possível atualizar a conclusão da tarefa.')
    else window.dispatchEvent(new Event('atlas:tarefas-atualizadas'))
    await atualizar()
    setSalvando(false)
  }

  async function novaColuna() {
    if (!usuario || salvando) return
    const nome = window.prompt('Nome da nova coluna do seu Kanban:')
    if (!nome?.trim()) return
    setSalvando(true)
    const criada = await criarColunaTarefa(usuario.id, nome.trim().slice(0, 70))
    if (!criada) setErro('Não foi possível criar a coluna.')
    await atualizar()
    setSalvando(false)
  }

  async function editarColuna(c: TarefaPessoalColuna) {
    if (salvando) return
    const nome = window.prompt('Novo nome da coluna:', c.nome)
    if (!nome?.trim() || nome.trim() === c.nome) return
    setSalvando(true)
    if (!(await renomearColunaTarefa(c.id, nome.trim().slice(0, 70)))) setErro('Não foi possível renomear a coluna.')
    await atualizar()
    setSalvando(false)
  }

  async function deslocarColuna(indice: number, direcao: -1 | 1) {
    if (!usuario || salvando || indice + direcao < 0 || indice + direcao >= colunas.length) return
    const proxima = [...colunas]
    const [movida] = proxima.splice(indice, 1)
    proxima.splice(indice + direcao, 0, movida)
    setColunas(proxima)
    setSalvando(true)
    const ok = await reordenarColunasTarefa(usuario.id, proxima)
    if (!ok) setErro('Não foi possível salvar a nova ordem das colunas.')
    await atualizar()
    setSalvando(false)
  }

  return (
    <>
    <article className="atlas-kanban-pessoal w-full min-w-0 max-w-full rounded-2xl border border-slate-200 bg-white p-3 shadow-sm sm:p-4">
      <div className="mb-3 flex min-w-0 flex-wrap items-center justify-between gap-2">
        <div>
          <div className="flex items-center gap-2"><Columns3 size={18} className="text-blue-700"/>
            <h2 className="text-base font-bold text-slate-900" title={`${abertas.length} abertas, ${atrasadas} atrasadas`}>{somenteEquipe ? 'Tarefas de equipe e compromissos' : 'Meu Kanban pessoal'}</h2>
          </div>
          <p className="mt-0.5 text-[11px] text-slate-500">Organize suas demandas, mova os cartões e personalize as colunas conforme sua rotina.</p>
        </div>
        <div className="atlas-kanban-pessoal-filtros flex min-w-0 flex-wrap items-center gap-1.5">
          <div className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-0.5 text-[11px]">
            <button type="button" onClick={()=>trocarAba('minhas')}
              className={'rounded-md px-2.5 py-1.5 font-semibold '+(aba==='minhas'?'bg-blue-600 text-white':'text-slate-600 hover:bg-white')}>Minhas tarefas</button>
            <button type="button" onClick={()=>trocarAba('delegadas')}
              className={'rounded-md px-2.5 py-1.5 font-semibold '+(aba==='delegadas'?'bg-blue-600 text-white':'text-slate-600 hover:bg-white')}>
              Pedidos que fiz
            </button>
          </div>
          <button type="button" disabled={todosPeriodos} title="Mês anterior" aria-label="Mês anterior"
            onClick={()=>setMesSelecionado(m=>mesAdjacente(m,-1))} className="rounded-lg border border-slate-200 p-1.5 text-slate-600 disabled:opacity-40"><ArrowLeft size={13}/></button>
          <input type="month" aria-label="Mês das tarefas" value={mesSelecionado} disabled={todosPeriodos}
            onChange={e=>{if(/^\d{4}-\d{2}$/.test(e.target.value)){setMesSelecionado(e.target.value);setTodosPeriodos(false)}}}
            className="h-8 min-w-0 w-[125px] rounded-lg border border-slate-200 bg-white px-1.5 text-[11px] font-semibold text-slate-700 disabled:opacity-50"/>
          <button type="button" disabled={todosPeriodos} title="Próximo mês" aria-label="Próximo mês"
            onClick={()=>setMesSelecionado(m=>mesAdjacente(m,1))} className="rounded-lg border border-slate-200 p-1.5 text-slate-600 disabled:opacity-40"><ArrowRight size={13}/></button>
          <input type="search" aria-label="Pesquisar tarefa ou cliente" value={busca} onChange={e=>setBusca(e.target.value)}
            placeholder="Pesquisar tarefa ou cliente..." className="h-8 w-full min-w-0 sm:w-[190px] rounded-lg border border-slate-200 bg-white px-2 text-[11px] text-slate-700"/>
          {!somenteEquipe && <><button type="button" onClick={()=>window.dispatchEvent(new Event('atlas:tarefa-equipe-nova'))}
            className="inline-flex h-8 items-center gap-1 rounded-lg bg-blue-600 px-2.5 text-[11px] font-semibold text-white hover:bg-blue-700">
            <Plus size={13}/> Nova tarefa
          </button>
          <button type="button" onClick={()=>window.dispatchEvent(new Event('atlas:novo-compromisso'))}
            className="inline-flex h-8 items-center gap-1 rounded-lg bg-violet-600 px-2.5 text-[11px] font-semibold text-white hover:bg-violet-700">
            <Plus size={13}/> Novo compromisso
          </button></>}
          <details className="relative">
            <summary aria-label="Mais opções do Kanban" title="Colunas e filtros"
              className="flex h-8 w-8 cursor-pointer list-none items-center justify-center rounded-lg border border-slate-200 bg-white font-bold text-slate-600 hover:bg-slate-50">•••</summary>
            <div className="absolute right-0 top-9 z-30 flex w-48 flex-col gap-1 rounded-xl border border-slate-200 bg-white p-1.5 text-left shadow-xl">
              <button type="button" onClick={()=>void novaColuna()} disabled={salvando} className="rounded-lg p-2 text-left text-xs text-slate-700 hover:bg-slate-50">+ Adicionar coluna</button>
              <button type="button" onClick={()=>setPersonalizando(p=>!p)} className="rounded-lg p-2 text-left text-xs text-slate-700 hover:bg-slate-50">Personalizar colunas</button>
              <button type="button" onClick={()=>setFiltrosAbertos(p=>!p)} className="rounded-lg p-2 text-left text-xs text-slate-700 hover:bg-slate-50">Filtros avançados</button>
            </div>
          </details>
        </div>
      </div>
      <div className="mb-2 flex flex-wrap items-center gap-3 text-xs text-slate-600"><label className="flex items-center gap-1.5"><input type="checkbox" checked={todosPeriodos} onChange={e=>setTodosPeriodos(e.target.checked)} className="accent-blue-600"/> Todos os períodos</label><span className="md:hidden">Deslize para trocar de coluna ou use as setas.</span></div>
      {filtrosAbertos && <div className="mb-3 flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-xs">
        <label className="flex cursor-pointer items-center gap-1.5">
          <input type="checkbox" checked={manterPendenciasAnteriores} onChange={e=>setManterPendenciasAnteriores(e.target.checked)} className="accent-blue-600"/> Incluir pendências anteriores
        </label>
        <select value={filtro} onChange={e=>setFiltro(e.target.value as typeof filtro)}
          aria-label="Filtrar prioridades ou atrasos" className="h-8 rounded-lg border border-slate-200 bg-white px-2 text-xs">
          <option value="todos">Todas as tarefas</option><option value="atrasadas">Atrasadas</option>
          <option value="urgentes">Urgentes</option><option value="alta">Prioridade alta</option><option value="sem-prazo">Sem prazo</option>
        </select>
        <button type="button" onClick={limparFiltros} className="rounded-lg bg-white px-2.5 py-2 font-semibold text-blue-700">Limpar filtros</button>
        <span className="text-slate-500">Exibindo: {todosPeriodos?'Todos os períodos':periodoExtenso(mesSelecionado)} · {tarefasFiltradas.length+(aba==='delegadas'?delegadasFiltradas.length:0)+equipeFiltrada.length+eventosFiltrados.length} registro(s)</span>
      </div>}
      {erro && <p role="alert" className="mb-3 rounded-lg bg-red-50 p-2 text-xs text-red-700">{erro}</p>}
      {personalizando && (
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-blue-100 bg-blue-50/50 p-2.5">
          <p className="text-xs text-slate-600">Renomeie e reordene suas colunas usando os controles de cada título. A organização vale só para você.</p>
        </div>
      )}
      {carregando ? <p className="py-8 text-center text-sm text-slate-500">Carregando seu Kanban...</p> : colunas.length === 0 ? (
        <div className="py-8 text-center text-sm text-slate-500">As colunas ainda não estão disponíveis. <button type="button" onClick={() => void atualizar()} className="text-blue-700 underline">Tentar novamente</button></div>
      ) : (
        <>
        <div className="atlas-kanban-pessoal-navegacao mb-3 grid grid-cols-[2rem_minmax(0,1fr)_2rem] items-center gap-2 md:hidden">
          <button type="button" aria-label="Coluna anterior" disabled={indiceMobile<=0} onClick={()=>setColunaMobile(etapasMobile[indiceMobile-1]?.id||null)} className="flex h-9 items-center justify-center rounded-lg border border-slate-200 disabled:opacity-30"><ArrowLeft size={16}/></button>
          <select aria-label="Coluna do Kanban" value={etapaMobile?.id||''} onChange={e=>setColunaMobile(e.target.value)} className="h-9 w-full min-w-0 rounded-lg border border-slate-200 bg-white px-2 text-sm font-semibold text-slate-700">{etapasMobile.map(c=><option key={c.id} value={c.id}>{c.nome}</option>)}</select>
          <button type="button" aria-label="Próxima coluna" disabled={indiceMobile<0||indiceMobile>=etapasMobile.length-1} onClick={()=>setColunaMobile(etapasMobile[indiceMobile+1]?.id||null)} className="flex h-9 items-center justify-center rounded-lg border border-slate-200 disabled:opacity-30"><ArrowRight size={16}/></button>
          <p className="col-span-3 text-center text-[11px] text-slate-500">Coluna {indiceMobile+1} de {etapasMobile.length}</p>
        </div>
        <div className="atlas-kanban-pessoal-colunas flex w-full min-w-0 max-w-full touch-pan-y gap-3 overflow-x-auto overscroll-x-contain pb-3 md:touch-auto" aria-label="Colunas do Kanban pessoal" role="region" tabIndex={0}
          onTouchStart={e => {
            toqueColuna.current = null
            if (window.matchMedia('(min-width: 768px)').matches || e.touches.length !== 1 ||
              (e.target instanceof Element && e.target.closest('[data-kanban-drag],select,input,textarea'))) return
            const t = e.touches[0]
            toqueColuna.current = { x: t.clientX, y: t.clientY, id: t.identifier }
          }}
          onTouchEnd={e => {
            const inicio = toqueColuna.current
            toqueColuna.current = null
            if (!inicio || e.touches.length) return
            const t = Array.from(e.changedTouches).find(t => t.identifier === inicio.id)
            if (!t) return
            const dx = t.clientX - inicio.x, dy = t.clientY - inicio.y
            if (Math.abs(dx) >= 55 && Math.abs(dx) > Math.abs(dy) * 1.4) {
              bloquearCliqueAte.current = Date.now() + 350
              navegarMobile(dx < 0 ? 1 : -1)
            }
          }}
          onTouchCancel={() => { toqueColuna.current = null }}
          onClickCapture={e => { if (Date.now() < bloquearCliqueAte.current) { e.preventDefault(); e.stopPropagation() } }}>
          <section data-mobile-ativa={etapaMobile?.id==='pedidos'} className="atlas-kanban-pessoal-coluna w-[224px] min-w-[224px] flex-1 overflow-hidden rounded-xl border border-violet-200 border-l-4 border-l-violet-600 bg-violet-50/70 p-0 sm:min-w-[235px]">
            <div className="mb-2 flex min-h-10 items-center gap-1.5 bg-violet-200 px-2.5 py-2">
              <span className="h-2 w-2 shrink-0 rounded-full bg-violet-600"/>
              <h3 className="truncate text-xs font-bold text-violet-900">Pedidos de tarefa</h3>
              <span className="rounded-full bg-white px-1.5 text-[10px] text-violet-700">{(aba==='delegadas'?delegadasFiltradas.filter(t => etapaDelegada(t) === 'pedido').length:0) + equipeFiltrada.filter(t=>etapaEquipe(t)==='pedido').length}</span>
            </div>
            <div className="max-h-[260px] min-h-[220px] space-y-1.5 overflow-y-auto px-2 pb-2">
              {(aba!=='delegadas'||delegadasFiltradas.filter(t => etapaDelegada(t) === 'pedido').length === 0) && equipeFiltrada.filter(t=>etapaEquipe(t)==='pedido').length === 0 &&
                <p className="rounded-lg border border-dashed border-violet-200 bg-white/70 px-2 py-5 text-center text-[11px] text-violet-400">Nenhum pedido aguardando início</p>}
              {aba==='delegadas'&&delegadasFiltradas.filter(t => etapaDelegada(t) === 'pedido').map(t => <CardDelegado key={t.id} tarefa={t} onAbrir={()=>setDetalheLocal({tipo:'delegada',id:t.id})}/>)}
              {equipeFiltrada.filter(t=>etapaEquipe(t)==='pedido').map(t=><CardTarefaEquipe key={t.id} tarefa={t} onAbrir={()=>setDetalheId(t.id)}/>)}
            </div>
          </section>
          {colunas.map((col, i) => {
            const visual = cores[tipoColuna(col, i)]
            const delegadasDaEtapa = aba==='delegadas' ? delegadasFiltradas.filter(t => etapaDelegada(t) === tipoColuna(col, i)) : []
            const etapa: StatusEquipe = tipoColuna(col,i)==='concluido'?'concluido':
              tipoColuna(col,i)==='andamento'?'em_andamento':
              tipoColuna(col,i)==='aguardando'?'aguardando':'a_fazer'
            const equipesDaEtapa = equipeFiltrada.filter(t=>etapaEquipe(t)===etapa)
            const eventosDaEtapa = eventosFiltrados.filter(e => conclusoesEventos[e.id] ? col.id === (final?.id || colunas[colunas.length-1]?.id) : col.id === inicial?.id)
            const itens = tarefasFiltradas.filter(t => colunaExibida(t) === col.id).sort((a, b) =>
              (a.data_hora ? new Date(a.data_hora).getTime() : Infinity) - (b.data_hora ? new Date(b.data_hora).getTime() : Infinity))
            return (
              <section key={col.id} data-mobile-ativa={etapaMobile?.id===col.id} onDragOver={e => { e.preventDefault(); setArrastando(col.id) }} onDragLeave={() => setArrastando(null)} onDrop={e => {
                e.preventDefault(); setArrastando(null)
                const id = e.dataTransfer.getData('text/plain')
                const tarefa = tarefas.find(t => t.id === id)
                if (id.startsWith('equipe:')) {
                  const compartilhada = equipe.find(t=>t.id===id.slice(7))
                  if(compartilhada)void mudarEquipe(compartilhada,etapa)
                } else if (tarefa) void mudarColuna(tarefa, col.id)
              }} className={'atlas-kanban-pessoal-coluna w-[224px] min-w-[224px] flex-1 overflow-hidden rounded-xl border border-slate-200 border-l-4 p-0 sm:min-w-[235px] ' + visual.lateral + ' ' + visual.fundo + (arrastando === col.id ? ' ring-2 ring-blue-400' : '')}>
                <div className={'mb-2 flex min-h-10 items-center justify-between gap-1 px-2.5 py-2 ' + visual.cabecalho}>
                  <div className="flex min-w-0 items-center gap-1.5">
                    <span className={'h-2 w-2 shrink-0 rounded-full ' + visual.marcador}/>
                    <h3 className={'truncate text-xs font-bold ' + visual.texto} title={col.nome}>{col.nome}</h3>
                    <span className="rounded-full bg-white px-1.5 text-[10px] text-slate-500">{itens.length + delegadasDaEtapa.length + equipesDaEtapa.length + eventosDaEtapa.length}</span>
                  </div>
                  {personalizando && <div className="flex items-center gap-0.5">
                    <button type="button" disabled={salvando || i === 0} onClick={() => void deslocarColuna(i, -1)} aria-label={'Mover ' + col.nome + ' para a esquerda'} className="rounded p-1 text-slate-500 hover:bg-white disabled:opacity-30"><ArrowLeft size={12}/></button>
                    <button type="button" disabled={salvando || i === colunas.length - 1} onClick={() => void deslocarColuna(i, 1)} aria-label={'Mover ' + col.nome + ' para a direita'} className="rounded p-1 text-slate-500 hover:bg-white disabled:opacity-30"><ArrowRight size={12}/></button>
                    <button type="button" disabled={salvando} onClick={() => void editarColuna(col)} aria-label={'Renomear ' + col.nome} className="rounded p-1 text-slate-500 hover:bg-white disabled:opacity-30"><Pencil size={12}/></button>
                  </div>}
                </div>
                <div className="max-h-[260px] min-h-[220px] space-y-1.5 overflow-y-auto px-2 pb-2 pr-2">
                  {itens.length === 0 && delegadasDaEtapa.length === 0 && equipesDaEtapa.length === 0 && eventosDaEtapa.length === 0 && <p className="rounded-lg border border-dashed border-slate-200 bg-white/70 px-2 py-5 text-center text-[11px] text-slate-400">Nenhuma tarefa neste período</p>}
                  {eventosDaEtapa.map(e => (
                    <div key={'evento:'+e.id} className="rounded-lg border border-slate-200 border-l-4 border-l-violet-500 bg-white p-2 shadow-sm">
                      <button type="button" onClick={()=>setDetalheLocal({tipo:'evento',id:e.id})} className="block w-full text-left" aria-label={'Abrir compromisso '+e.titulo}>
                      <p className="text-[10px] font-semibold uppercase text-violet-700">Compromisso · {e.meuStatus === 'proprio' ? 'Agenda própria' : 'Convite recebido'}</p>
                      <p className="break-words text-xs font-semibold text-slate-900">{e.titulo}</p>
                      <p className="mt-1 text-[11px] text-slate-600">{dataPrazo(e.data_inicio)}{e.data_fim ? ' – '+dataPrazo(e.data_fim) : ''}</p>
                      {e.local && <p className="break-words text-[11px] text-slate-500">{e.local}</p>}
                      <p className="text-[11px] text-slate-500">Responsável: {usuario?.nome}</p>
                      <span className="mt-1 block text-[11px] font-semibold text-blue-700">Ver detalhes</span>
                      </button>
                      <button type="button" disabled={salvando} onClick={()=>void alternarEvento(e)} className="mt-2 rounded-md border border-slate-200 px-2 py-1 text-xs font-semibold text-slate-700 disabled:opacity-50">{conclusoesEventos[e.id] ? 'Reabrir' : 'Concluir compromisso'}</button>
                    </div>
                  ))}
                  {delegadasDaEtapa.map(t => <CardDelegado key={t.id} tarefa={t} onAbrir={()=>setDetalheLocal({tipo:'delegada',id:t.id})}/>)}
                  {equipesDaEtapa.map(t=><div key={t.id}>
                    <CardTarefaEquipe tarefa={t} onAbrir={()=>setDetalheId(t.id)}
                      podeArrastar={Boolean(usuario&&t.responsaveis_ids.includes(usuario.id))}/>
                    {usuario&&t.responsaveis_ids.includes(usuario.id)&&<AlcaMobile disabled={salvando} onMover={direcao=>{
                      const destino = destinoEquipeMobile(i, direcao)
                      if (destino) void mudarEquipe(t, destino)
                    }}/>}
                  </div>)}
                  {itens.map(t => {
                    const atrasada = !t.concluida_em && t.data_hora && new Date(t.data_hora).getTime() < Date.now()
                    const menuAberto = menuTarefaAberto === t.id
                    return (
                      <div key={t.id} draggable={!salvando} onDragStart={e => e.dataTransfer.setData('text/plain', t.id)}
                        className={'rounded-lg border bg-white px-2 py-2 shadow-sm ' + (atrasada ? 'border-red-300' : 'border-slate-200')}>
                        <div className="flex min-w-0 items-center gap-1.5">
                          <GripVertical size={13} className="shrink-0 cursor-grab text-slate-400" aria-hidden="true" />
                          <button type="button" onClick={()=>setDetalheLocal({tipo:'pessoal',id:t.id})} className="min-w-0 flex-1 text-left" aria-label={'Abrir tarefa '+t.titulo}>
                            <p className="truncate text-xs font-semibold leading-4 text-slate-800" title={t.titulo}>{t.titulo}</p>
                            {t.descricao && <p className="mt-0.5 truncate text-[11px] leading-4 text-slate-500" title={t.descricao}>{t.descricao}</p>}
                          </button>
                          <span className={'flex shrink-0 items-center gap-0.5 rounded-md px-1.5 py-1 text-[9px] whitespace-nowrap ' +
                            (atrasada ? 'bg-red-50 font-semibold text-red-700' : 'bg-slate-100 text-slate-600')}>
                            <Clock3 size={10} />{dataPrazo(t.data_hora)}
                          </span>
                          <button type="button" aria-label={'Opções da tarefa ' + t.titulo} aria-expanded={menuAberto}
                            onClick={() => setMenuTarefaAberto(atual => atual === t.id ? null : t.id)}
                            className="shrink-0 rounded p-1 text-slate-500 hover:bg-slate-100">
                            <MoreHorizontal size={14} />
                          </button>
                        </div>
                        <div className="mt-1 md:hidden"><AlcaMobile disabled={salvando} onMover={direcao=>{
                          const destino = colunas[i + direcao]
                          if (destino) void mudarColuna(t, destino.id)
                        }}/></div>
                        {menuAberto && (
                          <div className="mt-2 space-y-1.5 border-t border-slate-100 pt-2" aria-label={'Ações da tarefa ' + t.titulo}>
                            {t.solicitante_nome && <p className="text-[10px] text-slate-500">De: {t.solicitante_nome}</p>}
                            {t.prioridade && t.prioridade !== 'normal' && <p className="text-[10px] font-semibold uppercase text-amber-700">{t.prioridade}</p>}
                            <div className="flex items-center gap-1.5">
                              <select aria-label={'Mover tarefa ' + t.titulo} value={colunaExibida(t)} disabled={salvando}
                                onChange={e => void mudarColuna(t, e.target.value)}
                                className="min-w-0 flex-1 rounded border border-slate-200 bg-white px-1.5 py-1 text-[11px] text-slate-600">
                                {colunas.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
                              </select>
                              <button type="button" title={t.concluida_em ? 'Reabrir tarefa' : 'Marcar como concluída'}
                                aria-label={t.concluida_em ? 'Reabrir tarefa' : 'Concluir tarefa'} disabled={salvando}
                                onClick={() => void alternarConclusao(t)}
                                className={'rounded p-1.5 disabled:opacity-50 ' + (t.concluida_em ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600 hover:bg-emerald-100')}>
                                <Check size={13}/>
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </section>
            )
          })}
        </div>
        </>
      )}
    </article>
    <DetalheTarefaEquipe id={detalheId} onFechar={()=>setDetalheId(null)}/>
    {detalheLocal && (eventoAberto || tarefaAberta) && <JanelaDetalhe key={detalheLocal.tipo+':'+detalheLocal.id} titulo={eventoAberto?.titulo || tarefaAberta?.titulo || 'Detalhes'} onFechar={()=>setDetalheLocal(null)}>
      {eventoAberto && <>
        <p className="font-semibold text-violet-700">Compromisso · {eventoAberto.meuStatus === 'proprio' ? 'Agenda própria' : 'Convite recebido'}</p>
        <p><strong>Início:</strong> {dataCompleta(eventoAberto.data_inicio)}</p>
        <p><strong>Fim:</strong> {dataCompleta(eventoAberto.data_fim)}</p>
        <p><strong>Local:</strong> {eventoAberto.local || 'Não informado'}</p>
        <p><strong>Situação:</strong> {conclusoesEventos[eventoAberto.id] ? 'Concluído por você' : 'A fazer'}</p>
        <ConvidadosDetalhe id={eventoAberto.id}/>
        <div className="rounded-lg bg-slate-50 p-3"><strong>Descrição</strong><p className="mt-1 whitespace-pre-wrap">{eventoAberto.descricao || 'Sem descrição'}</p></div>
        <button type="button" disabled={salvando} onClick={()=>void alternarEvento(eventoAberto)} className="w-full rounded-lg border border-slate-300 px-3 py-2 font-semibold disabled:opacity-50">{conclusoesEventos[eventoAberto.id] ? 'Reabrir compromisso' : 'Concluir compromisso'}</button>
      </>}
      {tarefaAberta && <>
        <p><strong>Responsável:</strong> {delegadaAberta?.responsavel_nome || usuario?.nome || 'Não informado'}</p>
        {tarefaAberta.solicitante_nome && <p><strong>Solicitante:</strong> {tarefaAberta.solicitante_nome}</p>}
        <p><strong>Prazo:</strong> {dataCompleta(tarefaAberta.data_hora)}</p>
        <p><strong>Prioridade:</strong> {tarefaAberta.prioridade || 'normal'}</p>
        <p><strong>Situação:</strong> {tarefaAberta.concluida_em ? 'Concluída' : delegadaAberta?.coluna_nome || colunas.find(c=>c.id===tarefaAberta.coluna_id)?.nome || 'A fazer'}</p>
        <div className="rounded-lg bg-slate-50 p-3"><strong>Descrição</strong><p className="mt-1 whitespace-pre-wrap">{tarefaAberta.descricao || 'Sem descrição'}</p></div>
        {pessoalAberta && <>
          <label className="block font-semibold">Mover tarefa
            <select value={colunaExibida(pessoalAberta)} disabled={salvando} onChange={e=>void mudarColuna(pessoalAberta,e.target.value)} className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2">
              {colunas.map(c=><option key={c.id} value={c.id}>{c.nome}</option>)}
            </select>
          </label>
          <button type="button" disabled={salvando} onClick={()=>void alternarConclusao(pessoalAberta)} className="w-full rounded-lg border border-slate-300 px-3 py-2 font-semibold disabled:opacity-50">{pessoalAberta.concluida_em ? 'Reabrir tarefa' : 'Concluir tarefa'}</button>
        </>}
      </>}
      {erro && <p role="alert" className="rounded-lg bg-red-50 p-2 text-red-700">{erro}</p>}
    </JanelaDetalhe>}
    </>
  )
}
