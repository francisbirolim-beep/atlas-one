'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { ArrowLeft, ArrowRight, Check, Clock3, Columns3, GripVertical, MoreHorizontal, Pencil, Plus } from 'lucide-react'
import { tokenAtual, usuarioAtual } from '@/lib/auth'
import {
  concluirTarefa, criarColunaTarefa, listarColunasTarefas, listarTarefas,
  moverTarefa, reabrirTarefa, renomearColunaTarefa, reordenarColunasTarefa,
} from '@/lib/tarefas'
import { confirmarMovimentoKanban } from '@/lib/kanbanConfirmacao'
import type { TarefaPessoal, TarefaPessoalColuna, Usuario } from '@/lib/tipos'

type Delegada = TarefaPessoal & { responsavel_nome: string; coluna_nome: string }
async function buscarDelegadas(): Promise<Delegada[]> {
  const token = await tokenAtual()
  if (!token) return []
  try {
    const r = await fetch('/api/tarefas/delegadas', { cache: 'no-store', headers: { Authorization: 'Bearer ' + token } })
    if (!r.ok) return []
    const json = await r.json()
    return Array.isArray(json.tarefas) ? json.tarefas : []
  } catch { return [] }
}
function etapaDelegada(t: Delegada): 'pedido' | 'andamento' | 'aguardando' | 'concluido' {
  if (t.concluida_em) return 'concluido'
  const nome = semAcentos(t.coluna_nome || '')
  if (/andamento|execucao|fazendo/.test(nome)) return 'andamento'
  if (/aguard|espera/.test(nome)) return 'aguardando'
  return 'pedido'
}
function CardDelegado({ tarefa }: { tarefa: Delegada }) {
  return (
    <div className="rounded-lg border border-violet-200 bg-white px-2 py-2 shadow-sm">
      <p className="truncate text-xs font-semibold text-slate-800" title={tarefa.titulo}>{tarefa.titulo}</p>
      <p className="mt-0.5 truncate text-[11px] text-violet-700">Responsável: {tarefa.responsavel_nome}</p>
      <p className="mt-0.5 truncate text-[10px] text-slate-600">Prazo: {dataPrazo(tarefa.data_hora)}</p>
      <p className="mt-0.5 truncate text-[10px] text-slate-500">Situação: {tarefa.concluida_em ? 'Concluído' : tarefa.coluna_nome}</p>
    </div>
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

export default function HomePersonalKanban() {
  const [usuario, setUsuario] = useState<Usuario | null>(null)
  const [colunas, setColunas] = useState<TarefaPessoalColuna[]>([])
  const [tarefas, setTarefas] = useState<TarefaPessoal[]>([])
  const [delegadas, setDelegadas] = useState<Delegada[]>([])
  const [carregando, setCarregando] = useState(true)
  const [personalizando, setPersonalizando] = useState(false)
  const [salvando, setSalvando] = useState(false)
  const [arrastando, setArrastando] = useState<string | null>(null)
  const [menuTarefaAberto, setMenuTarefaAberto] = useState<string | null>(null)
  const [erro, setErro] = useState('')
  const [mesSelecionado, setMesSelecionado] = useState(mesAtual)
  const [todosPeriodos, setTodosPeriodos] = useState(false)
  const [manterPendenciasAnteriores, setManterPendenciasAnteriores] = useState(true)
  const [busca, setBusca] = useState('')
  const [filtro, setFiltro] = useState<'todos' | 'atrasadas' | 'urgentes' | 'alta' | 'sem-prazo'>('todos')


  useEffect(() => {
    let ativo = true
    usuarioAtual().then(async u => {
      if (!ativo) return
      setUsuario(u)
      if (u) {
        const [cls, ts, ds] = await Promise.all([listarColunasTarefas(u.id), listarTarefas(u.id), buscarDelegadas()])
        if (ativo) { setColunas(cls); setTarefas(ts); setDelegadas(ds) }
      }
      if (ativo) setCarregando(false)
    }).catch(() => { if (ativo) setCarregando(false) })
    return () => { ativo = false }
  }, [])

  const atualizar = useCallback(async () => {
    if (!usuario) return
    const [cls, ts, ds] = await Promise.all([listarColunasTarefas(usuario.id), listarTarefas(usuario.id), buscarDelegadas()])
    setColunas(cls)
    setTarefas(ts)
    setDelegadas(ds)
  }, [usuario])

  useEffect(() => {
    if (!usuario) return
    const aoAtualizar = () => { void atualizar() }
    const aoFocar = () => { if (document.visibilityState === 'visible') aoAtualizar() }
    window.addEventListener('atlas:tarefas-atualizadas', aoAtualizar)
    window.addEventListener('focus', aoFocar)
    const intervalo = window.setInterval(aoFocar, 45000)
    return () => {
      window.removeEventListener('atlas:tarefas-atualizadas', aoAtualizar)
      window.removeEventListener('focus', aoFocar)
      window.clearInterval(intervalo)
    }
  }, [usuario, atualizar])

  const final = useMemo(() => colunas.find((c, i) => tipoColuna(c, i) === 'concluido'), [colunas])
  const colunaExibida = (t: TarefaPessoal) => t.concluida_em && final ? final.id : t.coluna_id
  const abertas = tarefas.filter(t => !t.concluida_em)
  const atrasadas = abertas.filter(t => t.data_hora && new Date(t.data_hora).getTime() < Date.now()).length

  const tarefasFiltradas = useMemo(() => {
    const consulta = semAcentos(busca.trim())
    const agora = Date.now()
    return tarefas.filter(t => {
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
  }, [tarefas, todosPeriodos, mesSelecionado, manterPendenciasAnteriores, busca, filtro])

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

  function limparFiltros() {
    setMesSelecionado(mesAtual())
    setTodosPeriodos(false)
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
    <article className="min-w-0 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm sm:p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="flex items-center gap-2"><Columns3 size={18} className="text-blue-700" /><h2 className="text-base font-bold text-slate-900" title={`${abertas.length} tarefas em aberto, ${atrasadas} atrasadas`}>Meu Kanban pessoal</h2></div>
          <p className="mt-1 text-xs text-slate-500">Organize suas demandas, mova os cartões e personalize as colunas conforme sua rotina.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={() => void novaColuna()} disabled={salvando} className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"><Plus size={14}/> Adicionar coluna</button>
          <button type="button" aria-pressed={personalizando} onClick={() => setPersonalizando(v => !v)} className="rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50">Personalizar colunas</button>
          <button type="button" onClick={() => window.dispatchEvent(new Event('atlas:nova-tarefa'))} className="inline-flex items-center gap-1 rounded-lg border border-blue-200 bg-blue-50 px-2.5 py-2 text-xs font-semibold text-blue-700 hover:bg-blue-100"><Plus size={14}/> Adicionar card</button>
        </div>
      </div>
      <div className="mb-3 flex flex-wrap items-end gap-2 rounded-xl border border-slate-200 bg-slate-50/80 p-2.5" aria-label="Filtros e período do Kanban pessoal">
        <div className="min-w-0">
          <label htmlFor="kanban-pessoal-mes" className="mb-1 block text-[11px] font-semibold text-slate-600">Período</label>
          <div className="flex items-center gap-1">
            <button type="button" disabled={todosPeriodos} title="Mês anterior" aria-label="Mês anterior"
              onClick={() => setMesSelecionado(m => mesAdjacente(m, -1))}
              className="rounded-lg border border-slate-200 bg-white p-2 text-slate-600 hover:bg-slate-100 disabled:opacity-40"><ArrowLeft size={13}/></button>
            <input id="kanban-pessoal-mes" aria-label="Selecionar mês do Kanban" type="month" value={mesSelecionado}
              onChange={e => { if (/^\d{4}-\d{2}$/.test(e.target.value)) { setMesSelecionado(e.target.value); setTodosPeriodos(false) } }}
              disabled={todosPeriodos} className="h-8 w-[146px] rounded-lg border border-slate-200 bg-white px-2 text-xs font-semibold text-slate-700 disabled:opacity-50" />
            <button type="button" disabled={todosPeriodos} title="Próximo mês" aria-label="Próximo mês"
              onClick={() => setMesSelecionado(m => mesAdjacente(m, 1))}
              className="rounded-lg border border-slate-200 bg-white p-2 text-slate-600 hover:bg-slate-100 disabled:opacity-40"><ArrowRight size={13}/></button>
          </div>
        </div>
        <label className="flex min-h-8 cursor-pointer items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2 text-[11px] font-medium text-slate-700">
          <input type="checkbox" checked={todosPeriodos} onChange={e => setTodosPeriodos(e.target.checked)} className="accent-blue-600" />
          Todos os períodos
        </label>
        <label className="min-w-[165px] flex-1">
          <span className="mb-1 block text-[11px] font-semibold text-slate-600">Pesquisar tarefa ou cliente</span>
          <input type="search" value={busca} onChange={e => setBusca(e.target.value)}
            placeholder="Nome, cliente ou descrição..." className="h-8 w-full rounded-lg border border-slate-200 bg-white px-2.5 text-xs text-slate-700" />
        </label>
        <label className="min-w-[120px]">
          <span className="mb-1 block text-[11px] font-semibold text-slate-600">Filtro</span>
          <select value={filtro} onChange={e => setFiltro(e.target.value as typeof filtro)}
            className="h-8 w-full rounded-lg border border-slate-200 bg-white px-2 text-xs text-slate-700">
            <option value="todos">Todas as tarefas</option>
            <option value="atrasadas">Atrasadas</option>
            <option value="urgentes">Urgentes</option>
            <option value="alta">Prioridade alta</option>
            <option value="sem-prazo">Sem prazo</option>
          </select>
        </label>
        <button type="button" onClick={limparFiltros} className="h-8 rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-semibold text-blue-700 hover:bg-blue-50">
          Limpar filtros
        </button>
        <div className="flex w-full flex-wrap items-center justify-between gap-2 text-[11px] text-slate-600">
          <span>Exibindo: <strong className="text-slate-800">{todosPeriodos ? 'Todos os períodos' : periodoExtenso(mesSelecionado)}</strong> · {tarefasFiltradas.length + delegadasFiltradas.length} tarefa(s)</span>
          {!todosPeriodos && (
            <label className="flex cursor-pointer items-center gap-1.5 text-slate-600" title="Mantém visíveis tarefas abertas de meses anteriores, sem alterar os concluídos do mês">
              <input type="checkbox" checked={manterPendenciasAnteriores} onChange={e => setManterPendenciasAnteriores(e.target.checked)} className="accent-blue-600" />
              Incluir pendências anteriores
            </label>
          )}
        </div>
      </div>
      {erro && <p role="alert" className="mb-3 rounded-lg bg-red-50 p-2 text-xs text-red-700">{erro}</p>}
      {personalizando && (
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-blue-100 bg-blue-50/50 p-2.5">
          <p className="text-xs text-slate-600">Renomeie e reordene suas colunas usando os controles de cada título. A organização vale só para você.</p>
        </div>
      )}
      {carregando ? <p className="py-8 text-center text-sm text-slate-500">Carregando seu Kanban...</p> : colunas.length === 0 ? (
        <div className="py-8 text-center text-sm text-slate-500">As colunas ainda não estão disponíveis. <button type="button" onClick={() => void atualizar()} className="text-blue-700 underline">Tentar novamente</button></div>
      ) : (
        <div className="flex min-w-0 gap-3 overflow-x-auto pb-2" aria-label="Colunas do Kanban pessoal">
          <section className="w-[224px] min-w-[224px] flex-1 overflow-hidden rounded-xl border border-violet-200 border-l-4 border-l-violet-600 bg-violet-50/70 p-0 sm:min-w-[235px]">
            <div className="mb-2 flex min-h-10 items-center gap-1.5 bg-violet-200 px-2.5 py-2">
              <span className="h-2 w-2 shrink-0 rounded-full bg-violet-600"/>
              <h3 className="truncate text-xs font-bold text-violet-900">Pedidos de tarefa</h3>
              <span className="rounded-full bg-white px-1.5 text-[10px] text-violet-700">{delegadasFiltradas.filter(t => etapaDelegada(t) === 'pedido').length}</span>
            </div>
            <div className="max-h-[260px] min-h-[220px] space-y-1.5 overflow-y-auto px-2 pb-2">
              {delegadasFiltradas.filter(t => etapaDelegada(t) === 'pedido').length === 0 &&
                <p className="rounded-lg border border-dashed border-violet-200 bg-white/70 px-2 py-5 text-center text-[11px] text-violet-400">Nenhum pedido aguardando início</p>}
              {delegadasFiltradas.filter(t => etapaDelegada(t) === 'pedido').map(t => <CardDelegado key={t.id} tarefa={t}/>)}
            </div>
          </section>
          {colunas.map((col, i) => {
            const visual = cores[tipoColuna(col, i)]
            const delegadasDaEtapa = delegadasFiltradas.filter(t => etapaDelegada(t) === tipoColuna(col, i))
            const itens = tarefasFiltradas.filter(t => colunaExibida(t) === col.id).sort((a, b) =>
              (a.data_hora ? new Date(a.data_hora).getTime() : Infinity) - (b.data_hora ? new Date(b.data_hora).getTime() : Infinity))
            return (
              <section key={col.id} onDragOver={e => { e.preventDefault(); setArrastando(col.id) }} onDragLeave={() => setArrastando(null)} onDrop={e => {
                e.preventDefault(); setArrastando(null)
                const id = e.dataTransfer.getData('text/plain')
                const tarefa = tarefas.find(t => t.id === id)
                if (tarefa) void mudarColuna(tarefa, col.id)
              }} className={'w-[224px] min-w-[224px] flex-1 overflow-hidden rounded-xl border border-slate-200 border-l-4 p-0 sm:min-w-[235px] ' + visual.lateral + ' ' + visual.fundo + (arrastando === col.id ? ' ring-2 ring-blue-400' : '')}>
                <div className={'mb-2 flex min-h-10 items-center justify-between gap-1 px-2.5 py-2 ' + visual.cabecalho}>
                  <div className="flex min-w-0 items-center gap-1.5">
                    <span className={'h-2 w-2 shrink-0 rounded-full ' + visual.marcador}/>
                    <h3 className={'truncate text-xs font-bold ' + visual.texto} title={col.nome}>{col.nome}</h3>
                    <span className="rounded-full bg-white px-1.5 text-[10px] text-slate-500">{itens.length + delegadasDaEtapa.length}</span>
                  </div>
                  {personalizando && <div className="flex items-center gap-0.5">
                    <button type="button" disabled={salvando || i === 0} onClick={() => void deslocarColuna(i, -1)} aria-label={'Mover ' + col.nome + ' para a esquerda'} className="rounded p-1 text-slate-500 hover:bg-white disabled:opacity-30"><ArrowLeft size={12}/></button>
                    <button type="button" disabled={salvando || i === colunas.length - 1} onClick={() => void deslocarColuna(i, 1)} aria-label={'Mover ' + col.nome + ' para a direita'} className="rounded p-1 text-slate-500 hover:bg-white disabled:opacity-30"><ArrowRight size={12}/></button>
                    <button type="button" disabled={salvando} onClick={() => void editarColuna(col)} aria-label={'Renomear ' + col.nome} className="rounded p-1 text-slate-500 hover:bg-white disabled:opacity-30"><Pencil size={12}/></button>
                  </div>}
                </div>
                <div className="max-h-[260px] min-h-[220px] space-y-1.5 overflow-y-auto px-2 pb-2 pr-2">
                  {itens.length === 0 && delegadasDaEtapa.length === 0 && <p className="rounded-lg border border-dashed border-slate-200 bg-white/70 px-2 py-5 text-center text-[11px] text-slate-400">Nenhuma tarefa neste período</p>}
                  {delegadasDaEtapa.map(t => <CardDelegado key={t.id} tarefa={t}/>)}
                  {itens.map(t => {
                    const atrasada = !t.concluida_em && t.data_hora && new Date(t.data_hora).getTime() < Date.now()
                    const menuAberto = menuTarefaAberto === t.id
                    return (
                      <div key={t.id} draggable={!salvando} onDragStart={e => e.dataTransfer.setData('text/plain', t.id)}
                        className={'rounded-lg border bg-white px-2 py-2 shadow-sm ' + (atrasada ? 'border-red-300' : 'border-slate-200')}>
                        <div className="flex min-w-0 items-center gap-1.5">
                          <GripVertical size={13} className="shrink-0 cursor-grab text-slate-400" aria-hidden="true" />
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-xs font-semibold leading-4 text-slate-800" title={t.titulo}>{t.titulo}</p>
                            {t.descricao && <p className="mt-0.5 truncate text-[11px] leading-4 text-slate-500" title={t.descricao}>{t.descricao}</p>}
                          </div>
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
      )}
    </article>
  )
}
