'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowUpRight, CalendarDays, KanbanSquare, ShieldCheck } from 'lucide-react'
import { tokenAtual } from '@/lib/auth'

type AcessosPainel = { visaoGeral: boolean; relatorioInstalacoes: boolean }

const etapas = [
  'Vendido', 'Separação', 'Compras', 'Aguardando material',
  'Medição final', 'Produção', 'Instalação', 'Finalizado',
]

/** A Home não lê dados das obras e não antecipa acessos de outros usuários.
 * Só exibe os atalhos depois da autorização do backend para a sessão atual.
 * A consulta leve preserva a velocidade e os fluxos da primeira tela.
 */
export default function HomePainelGeralAcessos() {
  const [acessos, setAcessos] = useState<AcessosPainel | null>(null)

  const atualizar = useCallback(async (signal: AbortSignal) => {
    try {
      const token = await tokenAtual()
      if (signal.aborted || !token) {
        if (!signal.aborted) setAcessos(null)
        return
      }
      const resposta = await fetch('/api/painel-geral-acesso', {
        headers: { Authorization: 'Bearer ' + token },
        cache: 'no-store',
        signal,
      })
      if (!resposta.ok) throw new Error('Acesso não confirmado')
      const dados: unknown = await resposta.json()
      if (signal.aborted) return
      const validado = dados && typeof dados === 'object' ? dados as Record<string, unknown> : {}
      setAcessos({
        visaoGeral: validado.visaoGeral === true,
        relatorioInstalacoes: validado.relatorioInstalacoes === true,
      })
    } catch {
      if (!signal.aborted) setAcessos(null) // falhar fechado
    }
  }, [])

  useEffect(() => {
    let controller = new AbortController()
    void atualizar(controller.signal)
    // Master habilitou acesso em outra aba: ao voltar, atualizar sem recarregar.
    const aoFocar = () => {
      controller.abort()
      controller = new AbortController()
      void atualizar(controller.signal)
    }
    window.addEventListener('focus', aoFocar)
    return () => {
      controller.abort()
      window.removeEventListener('focus', aoFocar)
    }
  }, [atualizar])

  if (!acessos || (!acessos.visaoGeral && !acessos.relatorioInstalacoes)) return null

  return (
    <section aria-label="Painéis autorizados da Visão Geral" className="mx-auto w-full max-w-7xl px-4 pt-4 md:px-6">
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm md:p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-blue-700">Visão Geral</p>
            <h2 className="mt-1 text-lg font-extrabold text-slate-900">Painéis da empresa</h2>
            <p className="text-xs text-slate-500">Abertura rápida dos painéis liberados para seu usuário.</p>
          </div>
          <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-emerald-700">
            <ShieldCheck size={15} /> Acesso autorizado
          </span>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          {acessos.visaoGeral && (
            <Link href="/visao-geral-projetos" className="group flex min-w-0 flex-col rounded-xl border border-blue-200 bg-blue-50/50 p-4 transition hover:border-blue-400 hover:bg-blue-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-500" aria-label="Abrir a Visão Geral de Projetos">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2 text-blue-900">
                  <KanbanSquare size={20} />
                  <strong className="text-sm">Visão Geral de Projetos</strong>
                </div>
                <ArrowUpRight size={18} className="shrink-0 text-blue-700 transition group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
              </div>
              <p className="mt-2 text-xs text-slate-600">Acompanhe as oito etapas, compras paralelas e pendências de cada obra.</p>
              <div className="mt-3 flex flex-wrap gap-1" aria-label="Etapas do Kanban Geral">
                {etapas.map(etapa => (
                  <span key={etapa} className="rounded-md border border-blue-100 bg-white px-1.5 py-1 text-[10px] font-medium text-slate-600">{etapa}</span>
                ))}
              </div>
              <span className="mt-3 text-xs font-bold text-blue-700">Abrir Kanban Geral</span>
            </Link>
          )}
          {acessos.relatorioInstalacoes && (
            <Link href="/relatorios/instalacoes" className="group flex min-w-0 flex-col rounded-xl border border-indigo-200 bg-indigo-50/40 p-4 transition hover:border-indigo-400 hover:bg-indigo-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-500" aria-label="Abrir Relatório de Instalações">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2 text-indigo-900">
                  <CalendarDays size={20} />
                  <strong className="text-sm">Relatório de Instalações</strong>
                </div>
                <ArrowUpRight size={18} className="shrink-0 text-indigo-700 transition group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
              </div>
              <p className="mt-2 text-xs text-slate-600">Calendário de instalações, planejamento mensal e capacidade da equipe.</p>
              <div className="mt-3 grid grid-cols-3 gap-2" aria-hidden="true">
                {['Calendário', 'Metas mensais', 'Capacidade'].map(item => (
                  <span key={item} className="rounded-md border border-indigo-100 bg-white px-1.5 py-2 text-center text-[10px] font-medium text-slate-600">{item}</span>
                ))}
              </div>
              <span className="mt-auto pt-3 text-xs font-bold text-indigo-700">Abrir relatório e calendário</span>
            </Link>
          )}
        </div>
      </div>
    </section>
  )
}
