'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowUpRight, CalendarDays, KanbanSquare, ShieldCheck } from 'lucide-react'
import { tokenAtual } from '@/lib/auth'

type AcessosPainel = { visaoGeral: boolean; relatorioInstalacoes: boolean }

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
    <section aria-label="Painéis autorizados da empresa" className="mx-auto w-full max-w-[1500px] px-3 pt-2 sm:px-4 md:px-8">
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 shadow-sm">
        <strong className="mr-1 text-xs font-semibold text-slate-700">Painéis da empresa</strong>
        {acessos.visaoGeral && (
          <Link href="/visao-geral-projetos" className="inline-flex items-center gap-1.5 rounded-lg border border-blue-100 bg-blue-50 px-2.5 py-1.5 text-xs font-semibold text-blue-800 transition hover:bg-blue-100">
            <KanbanSquare size={14}/> Visão Geral de Projetos <ArrowUpRight size={12}/>
          </Link>
        )}
        {acessos.relatorioInstalacoes && (
          <Link href="/relatorios/instalacoes" className="inline-flex items-center gap-1.5 rounded-lg border border-indigo-100 bg-indigo-50 px-2.5 py-1.5 text-xs font-semibold text-indigo-800 transition hover:bg-indigo-100">
            <CalendarDays size={14}/> Instalações <ArrowUpRight size={12}/>
          </Link>
        )}
        <span className="ml-auto inline-flex items-center gap-1 text-[10px] text-emerald-700"><ShieldCheck size={13}/> Acesso autorizado</span>
      </div>
    </section>
  )
}
