'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, ArrowRight, Check, CheckCircle2, Clock3, Columns3, GripVertical, Pencil, Plus, RefreshCw } from 'lucide-react'
import { usuarioAtual } from '@/lib/auth'
import {
  concluirTarefa, criarColunaTarefa, listarColunasTarefas, listarTarefas,
  moverTarefa, reabrirTarefa, renomearColunaTarefa, reordenarColunasTarefa,
} from '@/lib/tarefas'
import { confirmarMovimentoKanban } from '@/lib/kanbanConfirmacao'
import type { TarefaPessoal, TarefaPessoalColuna, Usuario } from '@/lib/tipos'

const cores = {
  inicial: { lateral: 'border-l-slate-500', fundo: 'bg-slate-50', texto: 'text-slate-700', marcador: 'bg-slate-500' },
  andamento: { lateral: 'border-l-blue-600', fundo: 'bg-blue-50/60', texto: 'text-blue-800', marcador: 'bg-blue-600' },
  aguardando: { lateral: 'border-l-amber-500', fundo: 'bg-amber-50/60', texto: 'text-amber-800', marcador: 'bg-amber-500' },
  concluido: { lateral: 'border-l-emerald-600', fundo: 'bg-emerald-50/60', texto: 'text-emerald-800', marcador: 'bg-emerald-600' },
}

function semAcentos(s: string) {
  return s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
}

function tipoColuna(coluna: TarefaPessoalColuna, indice: number) {
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

export default function HomePersonalKanban() {
  const [usuario, setUsuario] = useState<Usuario | null>(null)
  const [colunas, setColunas] = useState<TarefaPessoalColuna[]>([])
  const [tarefas, setTarefas] = useState<TarefaPessoal[]>([])
  const [carregando, setCarregando] = useState(true)
  const [personalizando, setPersonalizando] = useState(false)
  const [salvando, setSalvando] = useState(false)
  const [arrastando, setArrastando] = useState<string | null>(null)
  const [erro, setErro] = useState('')

  useEffect(() => {
    let ativo = true
    usuarioAtual().then(async u => {
      if (!ativo) return
      setUsuario(u)
      if (u) {
        const [cls, ts] = await Promise.all([listarColunasTarefas(u.id), listarTarefas(u.id)])
        if (ativo) { setColunas(cls); setTarefas(ts) }
      }
      if (ativo) setCarregando(false)
    }).catch(() => { if (ativo) setCarregando(false) })
    return () => { ativo = false }
  }, [])

  const atualizar = useCallback(async () => {
    if (!usuario) return
    const [cls, ts] = await Promise.all([listarColunasTarefas(usuario.id), listarTarefas(usuario.id)])
    setColunas(cls)
    setTarefas(ts)
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
          <div className="flex items-center gap-2"><Columns3 size={18} className="text-blue-700" /><h2 className="text-base font-bold text-slate-900">Meu Kanban de Trabalho</h2></div>
          <p className="mt-1 text-xs text-slate-500">Suas tarefas entram em A fazer; organize as etapas do seu jeito.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={() => window.dispatchEvent(new Event('atlas:nova-tarefa'))} className="inline-flex items-center gap-1 rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-700"><Plus size={14}/> Nova tarefa</button>
          <button type="button" aria-pressed={personalizando} onClick={() => setPersonalizando(v => !v)} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50">Personalizar colunas</button>
        </div>
      </div>
      <div className="mb-3 flex flex-wrap gap-2 text-[11px]">
        <span className="rounded-full bg-blue-50 px-2.5 py-1 font-medium text-blue-700">{abertas.length} em aberto</span>
        <span className="rounded-full bg-red-50 px-2.5 py-1 font-medium text-red-700">{atrasadas} atrasadas</span>
        <Link href="/tarefas" className="ml-auto text-blue-700 hover:underline">Abrir Kanban completo</Link>
      </div>
      {erro && <p role="alert" className="mb-3 rounded-lg bg-red-50 p-2 text-xs text-red-700">{erro}</p>}
      {personalizando && (
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-blue-100 bg-blue-50/50 p-2.5">
          <p className="text-xs text-slate-600">Renomeie e mude a ordem das suas colunas. A organização vale só para você.</p>
          <button type="button" onClick={() => void novaColuna()} disabled={salvando} className="inline-flex items-center gap-1 rounded-lg bg-white px-3 py-2 text-xs font-semibold text-blue-700 shadow-sm disabled:opacity-50"><Plus size={14}/> Adicionar coluna</button>
        </div>
      )}
      {carregando ? <p className="py-8 text-center text-sm text-slate-500">Carregando seu Kanban...</p> : colunas.length === 0 ? (
        <div className="py-8 text-center text-sm text-slate-500">As colunas ainda não estão disponíveis. <button type="button" onClick={() => void atualizar()} className="text-blue-700 underline">Tentar novamente</button></div>
      ) : (
        <div className="flex min-w-0 gap-3 overflow-x-auto pb-2" aria-label="Colunas do Kanban pessoal">
          {colunas.map((col, i) => {
            const visual = cores[tipoColuna(col, i)]
            const itens = tarefas.filter(t => colunaExibida(t) === col.id).sort((a, b) =>
              (a.data_hora ? new Date(a.data_hora).getTime() : Infinity) - (b.data_hora ? new Date(b.data_hora).getTime() : Infinity))
            return (
              <section key={col.id} onDragOver={e => { e.preventDefault(); setArrastando(col.id) }} onDragLeave={() => setArrastando(null)} onDrop={e => {
                e.preventDefault(); setArrastando(null)
                const id = e.dataTransfer.getData('text/plain')
                const tarefa = tarefas.find(t => t.id === id)
                if (tarefa) void mudarColuna(tarefa, col.id)
              }} className={'w-[224px] min-w-[224px] flex-1 rounded-xl border border-slate-200 border-l-4 p-2.5 sm:min-w-[235px] ' + visual.lateral + ' ' + visual.fundo + (arrastando === col.id ? ' ring-2 ring-blue-400' : '')}>
                <div className="mb-2 flex min-h-7 items-center justify-between gap-1">
                  <div className="flex min-w-0 items-center gap-1.5">
                    <span className={'h-2 w-2 shrink-0 rounded-full ' + visual.marcador}/>
                    <h3 className={'truncate text-xs font-bold ' + visual.texto} title={col.nome}>{col.nome}</h3>
                    <span className="rounded-full bg-white px-1.5 text-[10px] text-slate-500">{itens.length}</span>
                  </div>
                  {personalizando && <div className="flex items-center gap-0.5">
                    <button type="button" disabled={salvando || i === 0} onClick={() => void deslocarColuna(i, -1)} aria-label={'Mover ' + col.nome + ' para a esquerda'} className="rounded p-1 text-slate-500 hover:bg-white disabled:opacity-30"><ArrowLeft size={12}/></button>
                    <button type="button" disabled={salvando || i === colunas.length - 1} onClick={() => void deslocarColuna(i, 1)} aria-label={'Mover ' + col.nome + ' para a direita'} className="rounded p-1 text-slate-500 hover:bg-white disabled:opacity-30"><ArrowRight size={12}/></button>
                    <button type="button" disabled={salvando} onClick={() => void editarColuna(col)} aria-label={'Renomear ' + col.nome} className="rounded p-1 text-slate-500 hover:bg-white disabled:opacity-30"><Pencil size={12}/></button>
                  </div>}
                </div>
                <div className="max-h-[460px] min-h-[120px] space-y-2 overflow-y-auto pr-0.5">
                  {itens.length === 0 && <p className="rounded-lg border border-dashed border-slate-200 bg-white/70 px-2 py-5 text-center text-[11px] text-slate-400">Nenhuma tarefa</p>}
                  {itens.map(t => {
                    const atrasada = !t.concluida_em && t.data_hora && new Date(t.data_hora).getTime() < Date.now()
                    return <div key={t.id} draggable={!salvando} onDragStart={e => e.dataTransfer.setData('text/plain', t.id)} className={'rounded-lg border bg-white p-2.5 shadow-sm ' + (atrasada ? 'border-red-300' : 'border-slate-200')}>
                      <div className="flex items-start gap-1.5"><GripVertical size={13} className="mt-0.5 shrink-0 text-slate-300"/><p className="min-w-0 flex-1 break-words text-xs font-semibold text-slate-800">{t.titulo}</p></div>
                      {t.descricao && <p className="mt-1 line-clamp-2 text-[11px] text-slate-500">{t.descricao}</p>}
                      {t.solicitante_nome && <p className="mt-1 truncate text-[10px] text-slate-500">De: {t.solicitante_nome}</p>}
                      <p className={'mt-1.5 flex items-center gap-1 text-[10px] ' + (atrasada ? 'font-semibold text-red-600' : 'text-slate-500')}><Clock3 size={11}/>{dataPrazo(t.data_hora)}</p>
                      {t.prioridade && t.prioridade !== 'normal' && <p className="mt-1 text-[10px] font-semibold uppercase text-amber-700">{t.prioridade}</p>}
                      <div className="mt-2 flex items-center gap-1">
                        <select aria-label={'Mover tarefa ' + t.titulo} value={colunaExibida(t)} disabled={salvando} onChange={e => void mudarColuna(t, e.target.value)} className="min-w-0 flex-1 rounded border border-slate-200 bg-white px-1.5 py-1 text-[10px] text-slate-600">
                          {colunas.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
                        </select>
                        <button type="button" title={t.concluida_em ? 'Reabrir tarefa' : 'Marcar como concluída'} aria-label={t.concluida_em ? 'Reabrir tarefa' : 'Concluir tarefa'} disabled={salvando} onClick={() => void alternarConclusao(t)} className={'rounded p-1.5 disabled:opacity-50 ' + (t.concluida_em ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600 hover:bg-emerald-100')}><Check size={13}/></button>
                      </div>
                    </div>
                  })}
                </div>
              </section>
            )
          })}
        </div>
      )}
      <p className="mt-2 text-[11px] text-slate-400"><CheckCircle2 size={12} className="mr-1 inline"/> Organização pessoal. Mover cards não muda o status comercial ou financeiro.</p>
    </article>
  )
}
