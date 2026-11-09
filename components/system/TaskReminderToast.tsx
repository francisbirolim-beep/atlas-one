'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { AlarmClock, Check, Clock3, X } from 'lucide-react'
import { usuarioAtual } from '@/lib/auth'
import { assinarNovasNotificacoes } from '@/lib/notificacoes'
import { concluirTarefa } from '@/lib/tarefas'
import {
  lembreteTarefaVencido, listarEstadosLembretesTarefas, listarTarefasAbertasParaLembrete, salvarLembreteTarefa,
} from '@/lib/tarefaLembretes'
import type { TarefaPessoal } from '@/lib/tipos'

type OpcaoAdiar = '15' | '60' | '240' | 'amanha'

function dataAdiamento(opcao: OpcaoAdiar) {
  const d = new Date()
  if (opcao === 'amanha') {
    d.setDate(d.getDate() + 1)
    d.setHours(9, 0, 0, 0)
  } else {
    d.setMinutes(d.getMinutes() + Number(opcao))
  }
  return d.toISOString()
}

function dataTarefa(iso?: string | null) {
  if (!iso) return 'Sem prazo definido'
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
  }).format(new Date(iso))
}

/**
 * Alertas de tarefa em qualquer tela autenticada do Atlas.
 * Só reapresenta tarefas abertas, e respeita o adiamento persistido no banco.
 * A consulta periódica também cobre uma atribuição feita enquanto a aba ficou suspensa.
 */
export default function TaskReminderToast() {
  const [tarefa, setTarefa] = useState<TarefaPessoal | null>(null)
  const [opcao, setOpcao] = useState<OpcaoAdiar>('60')
  const [salvando, setSalvando] = useState(false)
  const usuarioIdRef = useRef<string | null>(null)
  const avisoRef = useRef<TarefaPessoal | null>(null)
  const consultandoRef = useRef(false)
  const atualizarRef = useRef<() => Promise<void>>(async () => {})

  useEffect(() => {
    let ativo = true
    let intervalo: ReturnType<typeof setInterval> | null = null
    let desinscrever: (() => void) | undefined

    async function atualizar() {
      const usuarioId = usuarioIdRef.current
      if (!ativo || !usuarioId || !navigator.onLine || consultandoRef.current) return
      consultandoRef.current = true
      try {
        const abertas = await listarTarefasAbertasParaLembrete(usuarioId)
        if (!ativo || !abertas) return
        const estados = await listarEstadosLembretesTarefas(usuarioId, abertas.map(t => t.id))
        if (!ativo || !estados) return // A migration precisa estar aplicada para um adiamento confiável.
        if (avisoRef.current) {
          const atual = abertas.find(t => t.id === avisoRef.current?.id)
          if (atual) return
          avisoRef.current = null
          setTarefa(null)
        }

        const agora = Date.now()
        const candidata = abertas
          .filter(t => lembreteTarefaVencido(estados[t.id], agora))
          .sort((a, b) => (b.atribuida_em || b.created_at || '').localeCompare(a.atribuida_em || a.created_at || ''))[0]
        if (!candidata) return

        // Persistir antes de abrir impede que um refresh apresente o mesmo aviso em sequência.
        const gravado = await salvarLembreteTarefa(candidata.id, usuarioId)
        if (!ativo || !gravado) return
        avisoRef.current = candidata
        setTarefa(candidata)
      } finally {
        consultandoRef.current = false
      }
    }

    atualizarRef.current = atualizar
    void usuarioAtual().then(usuario => {
      if (!ativo || !usuario) return
      usuarioIdRef.current = usuario.id
      void atualizar()

      // A criação para outro usuário gera notificação em tempo real.
      desinscrever = assinarNovasNotificacoes(usuario.id, notificacao => {
        if (notificacao.categoria === 'tarefas') void atualizar()
      })
      intervalo = setInterval(() => void atualizar(), 30_000)
    })
    const aoVoltar = () => { if (document.visibilityState === 'visible') void atualizar() }
    const aoFoco = () => void atualizar()
    const aoAtualizar = () => {
      // Outro componente pode ter concluído a tarefa exibida nesta mesma sessão.
      void atualizar()
    }
    document.addEventListener('visibilitychange', aoVoltar)
    window.addEventListener('focus', aoFoco)
    window.addEventListener('atlas:tarefas-atualizadas', aoAtualizar)
    return () => {
      ativo = false
      usuarioIdRef.current = null
      atualizarRef.current = async () => {}
      if (intervalo) clearInterval(intervalo)
      desinscrever?.()
      document.removeEventListener('visibilitychange', aoVoltar)
      window.removeEventListener('focus', aoFoco)
      window.removeEventListener('atlas:tarefas-atualizadas', aoAtualizar)
    }
  }, [])

  async function concluir() {
    if (!tarefa || salvando) return
    setSalvando(true)
    const ok = await concluirTarefa(tarefa.id)
    setSalvando(false)
    if (!ok) { window.alert('Não foi possível concluir a tarefa. Tente novamente.'); return }
    avisoRef.current = null
    setTarefa(null)
    window.dispatchEvent(new Event('atlas:tarefas-atualizadas'))
    void atualizarRef.current()
  }

  async function adiar(opcaoEscolhida = opcao) {
    if (!tarefa || salvando || !usuarioIdRef.current) return
    setSalvando(true)
    const estado = await salvarLembreteTarefa(tarefa.id, usuarioIdRef.current, dataAdiamento(opcaoEscolhida))
    setSalvando(false)
    if (!estado) { window.alert('Não foi possível adiar o lembrete. Tente novamente.'); return }
    avisoRef.current = null
    setTarefa(null)
    void atualizarRef.current()
  }

  function fechar() {
    // O último aviso já foi registrado: o mesmo item volta após 15 minutos.
    avisoRef.current = null
    setTarefa(null)
  }

  if (!tarefa) return null

  return (
    <aside
      role="status"
      aria-live="polite"
      aria-label="Lembrete de tarefa pendente"
      className="fixed right-3 top-20 z-[115] w-[min(calc(100vw-24px),390px)] rounded-2xl border border-amber-200 bg-white p-4 text-slate-900 shadow-2xl sm:right-5 sm:top-20"
    >
      <div className="flex items-start gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-amber-50 text-amber-700"><AlarmClock size={20}/></span>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-extrabold uppercase tracking-wide text-amber-700">{(Date.now() - new Date(tarefa.atribuida_em || tarefa.created_at || 0).getTime()) < 5 * 60_000 ? 'Nova tarefa recebida' : 'Lembrete de tarefa'}</p>
          <p className="mt-0.5 break-words text-sm font-semibold">{tarefa.titulo}</p>
          {tarefa.solicitante_nome && <p className="mt-1 text-xs text-slate-500">Enviada por {tarefa.solicitante_nome}</p>}
          <p className="mt-1 flex items-center gap-1 text-xs text-slate-500"><Clock3 size={13}/>{dataTarefa(tarefa.data_hora)}</p>
        </div>
        <button type="button" disabled={salvando} onClick={fechar} title="Fechar por enquanto; o lembrete voltará" aria-label="Fechar lembrete por enquanto" className="rounded-lg p-1 text-slate-400 hover:bg-slate-100"><X size={16}/></button>
      </div>
      <div className="mt-3 flex items-center gap-2">
        <select value={opcao} onChange={e => setOpcao(e.target.value as OpcaoAdiar)} aria-label="Prazo para reapresentar lembrete" className="min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-2 py-2 text-xs text-slate-700">
          <option value="15">15 minutos</option>
          <option value="60">1 hora</option>
          <option value="240">4 horas</option>
          <option value="amanha">Amanhã às 9h</option>
        </select>
        <button type="button" disabled={salvando} onClick={() => void adiar()} className="inline-flex items-center gap-1 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-2 text-xs font-semibold text-amber-800 hover:bg-amber-100 disabled:opacity-50"><AlarmClock size={13}/>Adiar</button>
        <button type="button" disabled={salvando} onClick={() => void concluir()} className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-2.5 py-2 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"><Check size={13}/>Concluir</button>
      </div>
      <p className="mt-2 text-[11px] text-slate-500">O lembrete volta até a conclusão. <Link href="/tarefas" className="font-semibold text-blue-700 underline-offset-2 hover:underline">Abrir tarefas</Link></p>
    </aside>
  )
}
