'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { AlertTriangle, ArrowUpRight, ClipboardCheck, FileText, PackageOpen } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { usuarioAtual } from '@/lib/auth'

type Indicadores = {
  orcamentosAbertos: number
  medicoesPendentes: number
  itensProducao: number
  tarefasAtrasadas: number
}

const inicial: Indicadores = { orcamentosAbertos: 0, medicoesPendentes: 0, itensProducao: 0, tarefasAtrasadas: 0 }

export default function HomeManagementOverview() {
  const [dados, setDados] = useState<Indicadores>(inicial)
  const [carregando, setCarregando] = useState(true)

  useEffect(() => {
    let ativo = true

    async function carregar() {
      const usuario = await usuarioAtual()
      const [orcamentos, medicoes, producao, tarefas] = await Promise.all([
        supabase.from('orcamentos').select('id', { count: 'exact', head: true }).in('status', ['rascunho', 'enviado']),
        supabase.from('medicoes_finais').select('status_operacional'),
        supabase.from('producao_itens').select('id', { count: 'exact', head: true }),
        usuario?.id
          ? supabase.from('tarefas').select('id,data_hora,concluida_em').eq('usuario_id', usuario.id).is('concluida_em', null)
          : Promise.resolve({ data: [] as { id: string; data_hora: string | null; concluida_em: string | null }[] }),
      ])

      if (!ativo) return
      const agora = Date.now()
      const tarefasAtrasadas = (tarefas.data || []).filter(t => t.data_hora && new Date(t.data_hora).getTime() < agora).length
      const medicoesPendentes = (medicoes.data || []).filter(m => m.status_operacional !== 'aprovado').length

      setDados({
        orcamentosAbertos: orcamentos.count || 0,
        medicoesPendentes,
        itensProducao: producao.count || 0,
        tarefasAtrasadas,
      })
      setCarregando(false)
    }

    carregar()
    return () => { ativo = false }
  }, [])

  const cards = [
    { label: 'Orçamentos em aberto', valor: dados.orcamentosAbertos, detalhe: 'status rascunho ou enviado', href: '/kanban', icon: FileText, classe: 'text-emerald-600 bg-emerald-50' },
    { label: 'Medições pendentes', valor: dados.medicoesPendentes, detalhe: 'ainda não aprovadas', href: '/producao/medicao-final', icon: ClipboardCheck, classe: 'text-blue-600 bg-blue-50' },
    { label: 'Itens na produção', valor: dados.itensProducao, detalhe: 'cards no quadro de produção', href: '/producao', icon: PackageOpen, classe: 'text-amber-600 bg-amber-50' },
    { label: 'Tarefas atrasadas', valor: dados.tarefasAtrasadas, detalhe: 'do usuário logado', href: '/tarefas', icon: AlertTriangle, classe: dados.tarefasAtrasadas > 0 ? 'text-red-600 bg-red-50' : 'text-slate-500 bg-slate-50' },
  ]

  return (
    <section className="mx-auto w-full max-w-7xl px-4 pb-8 pt-4 md:px-6 md:pb-10">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map(card => {
          const Icon = card.icon
          return (
            <Link key={card.label} href={card.href} className="group rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md md:p-5">
              <div className="flex items-start justify-between gap-3">
                <span className={`flex h-10 w-10 items-center justify-center rounded-xl ${card.classe}`}><Icon size={18}/></span>
                <ArrowUpRight size={15} className="text-slate-300 transition group-hover:text-slate-600"/>
              </div>
              <p className="mt-4 text-xs font-medium text-slate-500">{card.label}</p>
              <p className="mt-1 text-2xl font-semibold tracking-tight text-slate-950">{carregando ? '—' : card.valor}</p>
              <p className="mt-1 text-[11px] text-slate-400">{carregando ? 'Carregando...' : card.detalhe}</p>
            </Link>
          )
        })}
      </div>
    </section>
  )
}
