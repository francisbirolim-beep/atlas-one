'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { Check, CheckSquare, Clock3, Plus, X } from 'lucide-react'
import { usuarioAtual } from '@/lib/auth'
import { listarUsuariosConvidaveis } from '@/lib/eventos'
import { concluirTarefa, listarColunasTarefas, listarTarefas } from '@/lib/tarefas'
import { atribuirTarefa, type PrioridadeTarefa } from '@/lib/tarefasColaboracao'
import { criarRecorrenciaAtlas } from '@/lib/agendaRecorrenciaCliente'
import RecurrenceFields, { type OpcaoRecorrencia } from './RecurrenceFields'
import type { TarefaPessoal, TarefaPessoalColuna, Usuario } from '@/lib/tipos'

function dataHoje() {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const dia = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${dia}`
}

function dataHoraLabel(iso?: string | null) {
  if (!iso) return 'Sem prazo'
  return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }).format(new Date(iso))
}

export default function HomeTasksBlock({ ocultarPainel = false }: { ocultarPainel?: boolean }) {
  const [usuario, setUsuario] = useState<Usuario | null>(null)
  const [tarefas, setTarefas] = useState<TarefaPessoal[]>([])
  const [colunas, setColunas] = useState<TarefaPessoalColuna[]>([])
  const [carregando, setCarregando] = useState(true)
  const [modal, setModal] = useState(false)
  const [titulo, setTitulo] = useState('')
  const [data, setData] = useState(dataHoje())
  const [hora, setHora] = useState('09:00')
  const [responsaveisIds, setResponsaveisIds] = useState<string[]>([])
  const [buscaResponsavel, setBuscaResponsavel] = useState('')
  const [descricao, setDescricao] = useState('')
  const [responsaveis, setResponsaveis] = useState<{ id: string; nome: string }[]>([])
  const [prioridade, setPrioridade] = useState<PrioridadeTarefa>('normal')
  const [repeticao, setRepeticao] = useState<OpcaoRecorrencia>('nenhuma')
  const [diasSemana, setDiasSemana] = useState<number[]>([])
  const [nDiaUtil, setNDiaUtil] = useState(5)
  const [salvando, setSalvando] = useState(false)

  useEffect(() => {
    let ativo = true
    usuarioAtual().then(async u => {
      if (!ativo) return
      setUsuario(u)
      if (!u) { setCarregando(false); return }
      const [lista, cls] = await Promise.all([listarTarefas(u.id), listarColunasTarefas(u.id)])
      if (!ativo) return
      setTarefas(lista)
      setColunas(cls)
      setCarregando(false)
    })
    return () => { ativo = false }
  }, [])

  useEffect(() => {
    const abrir = () => void abrirModal()
    window.addEventListener('atlas:nova-tarefa', abrir)
    return () => window.removeEventListener('atlas:nova-tarefa', abrir)
  }, [usuario])

  // O aviso global pode concluir uma tarefa; manter o painel sincronizado.
  useEffect(() => {
    if (!usuario) return
    const atualizar = () => { void listarTarefas(usuario.id).then(setTarefas) }
    window.addEventListener('atlas:tarefas-atualizadas', atualizar)
    return () => window.removeEventListener('atlas:tarefas-atualizadas', atualizar)
  }, [usuario])

  const abertas = useMemo(() => tarefas
    .filter(t => !t.concluida_em)
    .sort((a, b) => {
      if (a.data_hora && b.data_hora) return new Date(a.data_hora).getTime() - new Date(b.data_hora).getTime()
      if (a.data_hora) return -1
      if (b.data_hora) return 1
      return (b.created_at || '').localeCompare(a.created_at || '')
    }), [tarefas])

  const agora = new Date()
  const inicioHoje = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate()).getTime()
  const fimHoje = inicioHoje + 86400000

  async function abrirModal() {
    if (!usuario) return
    setResponsaveisIds([usuario.id])
    setModal(true)
    if (responsaveis.length === 0) {
      const outros = await listarUsuariosConvidaveis(usuario.id)
      setResponsaveis([{ id: usuario.id, nome: usuario.nome }, ...outros])
    }
  }

  async function concluir(tarefa: TarefaPessoal) {
    setTarefas(prev => prev.map(t => t.id === tarefa.id ? { ...t, concluida_em: new Date().toISOString() } : t))
    const ok = await concluirTarefa(tarefa.id)
    if (!ok) {
      setTarefas(prev => prev.map(t => t.id === tarefa.id ? tarefa : t))
      alert('Não foi possível concluir a tarefa. Tente novamente.')
    } else {
      window.dispatchEvent(new Event('atlas:tarefas-atualizadas'))
    }
  }

  async function salvar() {
    if (!usuario || !titulo.trim() || responsaveisIds.length === 0 || salvando) return
    setSalvando(true)
    const dataHora = data ? new Date(data + 'T' + (hora || '09:00') + ':00').toISOString() : null
    try {
      if (repeticao === 'nenhuma') {
        const resultado = await atribuirTarefa({
          responsaveisIds, titulo: titulo.trim(), descricao: descricao.trim(),
          dataHora, prioridade,
        })
        if (!resultado.ok) {
          alert(resultado.error || 'Não foi possível atribuir a tarefa.')
          return
        }
      } else {
        const resultado = await criarRecorrenciaAtlas({
          tipoRegistro: 'tarefa', responsaveisIds, titulo: titulo.trim(),
          descricao: descricao.trim(), baseData: data, horaInicio: hora,
          prioridade, frequencia: repeticao, diasSemana, nDiaUtil,
        })
        if (!resultado.ok) {
          alert(resultado.error || 'Não foi possível cadastrar a tarefa recorrente.')
          return
        }
        if (resultado.aviso) alert(resultado.aviso)
      }
      setTarefas(await listarTarefas(usuario.id))
      window.dispatchEvent(new Event('atlas:tarefas-atualizadas'))
      setTitulo('')
      setDescricao('')
      setBuscaResponsavel('')
      setPrioridade('normal')
      setRepeticao('nenhuma')
      setDiasSemana([])
      setNDiaUtil(5)
      setModal(false)
    } catch {
      alert('Falha ao criar a tarefa. Nenhum cartão foi atualizado nesta tela.')
    } finally {
      setSalvando(false)
    }
  }

  return (
    <>
      {!ocultarPainel && (
        <article className="h-full min-w-0 rounded-2xl border border-slate-200 bg-white p-3 text-slate-900 shadow-sm sm:p-4">
          <div className="mb-3 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <CheckSquare size={19} className="text-blue-600" />
              <h2 className="text-base font-bold">Minhas tarefas</h2>
            </div>
            <Link href="/tarefas" className="text-xs font-semibold text-blue-700 hover:underline">Ver todas</Link>
          </div>
          {carregando ? (
            <p className="py-8 text-sm text-slate-400">Carregando tarefas...</p>
          ) : abertas.length === 0 ? (
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-5 text-sm text-slate-500">
              <Check size={16} className="mb-2 text-emerald-600" />Nenhuma tarefa aberta.
            </div>
          ) : (
            <div className="space-y-1.5">
              {abertas.slice(0, 4).map(tarefa => {
                const prazo = tarefa.data_hora ? new Date(tarefa.data_hora).getTime() : null
                const vencida = prazo !== null && prazo < Date.now()
                const venceHoje = prazo !== null && prazo >= inicioHoje && prazo < fimHoje
                const cor = vencida ? 'border-l-red-500' : venceHoje ? 'border-l-amber-400' : 'border-l-blue-500'
                return (
                  <div key={tarefa.id} className={'flex min-w-0 items-center gap-2 rounded-lg border border-slate-200 border-l-4 bg-white px-2.5 py-2 shadow-sm ' + cor}>
                    <button type="button" onClick={() => void concluir(tarefa)}
                      className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-slate-300 text-transparent transition hover:border-emerald-500 hover:text-emerald-600"
                      title="Marcar como concluída" aria-label={'Concluir tarefa ' + tarefa.titulo}>
                      <Check size={14} />
                    </button>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-semibold text-slate-900" title={tarefa.titulo}>{tarefa.titulo}</p>
                      <p className="mt-0.5 truncate text-[11px] text-slate-500">
                        {tarefa.descricao || (tarefa.solicitante_nome ? 'De: ' + tarefa.solicitante_nome : 'Tarefa pessoal')}
                      </p>
                    </div>
                    <span className={'shrink-0 rounded-md px-1.5 py-1 text-[10px] font-semibold ' + (vencida ? 'bg-red-50 text-red-700' : venceHoje ? 'bg-amber-50 text-amber-700' : 'bg-slate-100 text-slate-600')}>
                      <Clock3 size={11} className="mr-0.5 inline" />{dataHoraLabel(tarefa.data_hora)}
                    </span>
                  </div>
                )
              })}
              {abertas.length > 4 && <Link href="/tarefas" className="block pt-1 text-center text-xs font-semibold text-blue-700 hover:underline">Mais {abertas.length - 4} tarefa(s)</Link>}
            </div>
          )}
        </article>
      )}

      {modal && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-sm">
          <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl">
            <div className="mb-4 flex items-center justify-between"><div><h3 className="font-semibold text-slate-900">Nova tarefa</h3><p className="text-xs text-slate-500">Crie para você ou atribua a outro usuário.</p></div><button type="button" onClick={() => setModal(false)} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100"><X size={17}/></button></div>
            <div className="space-y-3">
              <input autoFocus value={titulo} onChange={e => setTitulo(e.target.value)} placeholder="O que precisa ser feito?" className="w-full rounded-xl border border-slate-300 p-3 text-sm" />
              <textarea rows={2} value={descricao} onChange={e => setDescricao(e.target.value)} placeholder="Instruções ou observações (opcional)" className="w-full rounded-xl border border-slate-300 p-3 text-sm" />
              <div className="grid grid-cols-2 gap-2"><input type="date" value={data} onChange={e => setData(e.target.value)} className="rounded-xl border border-slate-300 p-3 text-sm"/><input type="time" value={hora} onChange={e => setHora(e.target.value)} className="rounded-xl border border-slate-300 p-3 text-sm"/></div>
              <RecurrenceFields repeticao={repeticao} onRepeticao={setRepeticao}
                diasSemana={diasSemana} onDiasSemana={setDiasSemana} nDiaUtil={nDiaUtil} onNDiaUtil={setNDiaUtil} />
              <div className="rounded-xl border border-slate-200 p-2">
                <p className="mb-2 text-xs font-semibold text-slate-700">Responsáveis ({responsaveisIds.length}) — selecione um ou vários</p>
                <input type="search" value={buscaResponsavel} onChange={e => setBuscaResponsavel(e.target.value)}
                  placeholder="Pesquisar funcionário pelo nome" className="mb-2 w-full rounded-lg border border-slate-200 px-2.5 py-2 text-sm" />
                <div className="max-h-32 space-y-1 overflow-y-auto">
                  {responsaveis.filter(r => r.nome.toLocaleLowerCase('pt-BR').includes(buscaResponsavel.trim().toLocaleLowerCase('pt-BR')))
                    .map(r => <label key={r.id} className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm text-slate-700 hover:bg-slate-50">
                      <input type="checkbox" checked={responsaveisIds.includes(r.id)} onChange={() => setResponsaveisIds(antes =>
                        antes.includes(r.id) ? antes.filter(id => id !== r.id) : [...antes, r.id])} />
                      {r.nome}{r.id === usuario?.id ? ' (você)' : ''}
                    </label>)}
                </div>
                <p className="mt-1.5 text-[11px] text-slate-500">A mesma tarefa aparece no Kanban dos responsáveis e de quem criou.</p>
              </div>
              <select value={prioridade} onChange={e => setPrioridade(e.target.value as PrioridadeTarefa)} className="w-full rounded-xl border border-slate-300 p-3 text-sm"><option value="baixa">Prioridade baixa</option><option value="normal">Prioridade normal</option><option value="alta">Prioridade alta</option><option value="urgente">Urgente</option></select>
              <button type="button" onClick={() => void salvar()} disabled={salvando || !titulo.trim() || responsaveisIds.length === 0} className="w-full rounded-xl bg-emerald-600 py-3 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-50">{salvando ? 'Salvando...' : 'Salvar tarefa'}</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
