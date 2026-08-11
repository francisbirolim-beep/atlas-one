'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import {
  AlertTriangle,
  CalendarClock,
  CheckSquare,
  ClipboardCheck,
  Headset,
  KanbanSquare,
  Plus,
  Users,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { usuarioAtual } from '@/lib/auth'

type Alertas = {
  tarefasPendentes: number
  tarefasVencidas: number
  tarefasHoje: number
  assistenciasAtivas: number
}

const inicial: Alertas = {
  tarefasPendentes: 0,
  tarefasVencidas: 0,
  tarefasHoje: 0,
  assistenciasAtivas: 0,
}

function dataLocalIso() {
  const agora = new Date()
  const ano = agora.getFullYear()
  const mes = String(agora.getMonth() + 1).padStart(2, '0')
  const dia = String(agora.getDate()).padStart(2, '0')
  return `${ano}-${mes}-${dia}`
}

export default function HomeOperationalAttention() {
  const [dados, setDados] = useState<Alertas>(inicial)
  const [carregando, setCarregando] = useState(true)

  useEffect(() => {
    let ativo = true

    async function carregar() {
      const usuario = await usuarioAtual()
      const hoje = dataLocalIso()

      const tarefasPromise = usuario?.id
        ? supabase
            .from('tarefas')
            .select('id, data_hora, concluida_em')
            .eq('usuario_id', usuario.id)
            .is('concluida_em', null)
        : Promise.resolve({ data: [] as { id: string; data_hora: string | null; concluida_em: string | null }[] })

      const [tarefas, assistencias] = await Promise.all([
        tarefasPromise,
        supabase
          .from('assistencias')
          .select('id', { count: 'exact', head: true })
          .in('status', ['aberto', 'em_atendimento']),
      ])

      if (!ativo) return

      const listaTarefas = tarefas.data || []
      let vencidas = 0
      let paraHoje = 0

      listaTarefas.forEach((tarefa) => {
        if (!tarefa.data_hora) return
        const data = tarefa.data_hora.slice(0, 10)
        if (data < hoje) vencidas += 1
        if (data === hoje) paraHoje += 1
      })

      setDados({
        tarefasPendentes: listaTarefas.length,
        tarefasVencidas: vencidas,
        tarefasHoje: paraHoje,
        assistenciasAtivas: assistencias.count || 0,
      })
      setCarregando(false)
    }

    carregar()
    return () => { ativo = false }
  }, [])

  const alertas = [
    {
      label: 'Tarefas vencidas',
      valor: dados.tarefasVencidas,
      detalhe: dados.tarefasVencidas > 0 ? 'precisam de atenção' : 'nenhuma pendência vencida',
      href: '/tarefas',
      icon: AlertTriangle,
    },
    {
      label: 'Tarefas para hoje',
      valor: dados.tarefasHoje,
      detalhe: `${dados.tarefasPendentes} pendentes no total`,
      href: '/tarefas',
      icon: CalendarClock,
    },
    {
      label: 'Assistências ativas',
      valor: dados.assistenciasAtivas,
      detalhe: 'abertas ou em atendimento',
      href: '/assistencias',
      icon: Headset,
    },
  ]

  const acoes = [
    { label: 'Novo orçamento', detalhe: 'Cadastrar uma nova proposta', href: '/orcamento-rapido', icon: Plus },
    { label: 'Abrir Kanban', detalhe: 'Acompanhar vendas e processos', href: '/kanban', icon: KanbanSquare },
    { label: 'Medição Final', detalhe: 'Ver medições em andamento', href: '/producao/medicao-final', icon: ClipboardCheck },
    { label: 'Clientes', detalhe: 'Consultar cadastros e histórico', href: '/clientes', icon: Users },
  ]

  return (
    <section className="mx-auto grid w-full max-w-7xl gap-4 px-4 pb-5 pt-4 md:grid-cols-[1.25fr_0.75fr] md:px-6 md:pb-6">
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm md:p-5">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Operação</p>
            <h2 className="mt-1 text-lg font-bold text-slate-900">Atenção necessária</h2>
          </div>
          <Link href="/tarefas" className="text-sm font-medium text-brand-navy hover:underline">
            Ver tarefas
          </Link>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          {alertas.map((alerta) => {
            const Icon = alerta.icon
            return (
              <Link key={alerta.label} href={alerta.href} className="rounded-xl border border-slate-200 p-4 transition hover:border-slate-300 hover:bg-slate-50">
                <div className="flex items-center justify-between gap-3">
                  <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100 text-brand-navy">
                    <Icon size={17} />
                  </span>
                  <span className="text-2xl font-bold tracking-tight text-slate-900">{carregando ? '—' : alerta.valor}</span>
                </div>
                <p className="mt-3 text-sm font-semibold text-slate-700">{alerta.label}</p>
                <p className="mt-1 text-xs text-slate-400">{carregando ? 'Carregando...' : alerta.detalhe}</p>
              </Link>
            )
          })}
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm md:p-5">
        <div className="mb-4">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Atalhos</p>
          <h2 className="mt-1 text-lg font-bold text-slate-900">Ações rápidas</h2>
        </div>

        <div className="grid gap-2 sm:grid-cols-2 md:grid-cols-1 xl:grid-cols-2">
          {acoes.map((acao) => {
            const Icon = acao.icon
            return (
              <Link key={acao.label} href={acao.href} className="group flex items-center gap-3 rounded-xl border border-slate-200 p-3 transition hover:border-slate-300 hover:bg-slate-50">
                <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-slate-100 text-brand-navy transition group-hover:bg-brand-navy group-hover:text-white">
                  <Icon size={17} />
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-semibold text-slate-800">{acao.label}</span>
                  <span className="block truncate text-xs text-slate-400">{acao.detalhe}</span>
                </span>
              </Link>
            )
          })}
        </div>
      </div>
    </section>
  )
}
