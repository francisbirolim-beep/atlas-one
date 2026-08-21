'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowUpRight, FileClock, FileText } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { formatarData, formatarMoeda } from '@/lib/formatacao'

type OrcamentoRecente = {
  id: string
  numero: number | null
  cliente_nome: string | null
  valor_estimado: number | null
  status: string | null
  created_at: string
}

function labelStatus(status?: string | null) {
  if (status === 'aprovado') return 'Aprovado'
  if (status === 'convertido') return 'Convertido'
  if (status === 'enviado') return 'Enviado'
  if (status === 'recusado') return 'Recusado'
  return 'Orçamento'
}

function classeStatus(status?: string | null) {
  if (status === 'aprovado' || status === 'convertido') return 'bg-emerald-500/15 text-emerald-300'
  if (status === 'recusado') return 'bg-red-500/15 text-red-300'
  if (status === 'enviado') return 'bg-blue-500/15 text-blue-300'
  return 'bg-white/10 text-slate-300'
}

export default function HomeRecentQuotes() {
  const [orcamentos, setOrcamentos] = useState<OrcamentoRecente[]>([])
  const [carregando, setCarregando] = useState(true)

  useEffect(() => {
    let ativo = true

    async function carregar() {
      const { data } = await supabase
        .from('orcamentos')
        .select('id,numero,cliente_nome,valor_estimado,status,created_at')
        .order('created_at', { ascending: false })
        .limit(3)

      if (!ativo) return
      setOrcamentos((data as OrcamentoRecente[]) || [])
      setCarregando(false)
    }

    carregar()
    return () => { ativo = false }
  }, [])

  return (
    <section className="mx-auto w-full max-w-7xl px-4 pt-4 md:px-6">
      <article className="rounded-2xl border border-slate-800 bg-slate-950 p-4 text-white shadow-sm md:p-5">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <FileClock size={17} className="text-emerald-400" />
            <div>
              <h2 className="font-semibold">Últimos orçamentos</h2>
              <p className="text-xs text-slate-500">Acompanhe rapidamente os pedidos mais recentes.</p>
            </div>
          </div>
          <Link href="/orcamento/pesquisar" className="inline-flex items-center gap-1 text-xs font-medium text-emerald-300 transition hover:text-emerald-200">
            Ver todos <ArrowUpRight size={13} />
          </Link>
        </div>

        {carregando ? (
          <p className="rounded-xl border border-white/10 bg-white/[0.025] p-4 text-sm text-slate-500">Carregando orçamentos...</p>
        ) : orcamentos.length === 0 ? (
          <div className="rounded-xl border border-white/10 bg-white/[0.025] p-5 text-sm text-slate-400">
            <FileText size={18} className="mb-2 text-emerald-400" />
            Nenhum orçamento encontrado ainda.
          </div>
        ) : (
          <div className="grid gap-2 md:grid-cols-3">
            {orcamentos.map(orcamento => (
              <div key={orcamento.id} className="rounded-xl border border-white/10 bg-white/[0.025] p-3.5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-slate-100">{orcamento.numero ? `Orçamento nº ${orcamento.numero}` : 'Orçamento recente'}</p>
                    <p className="mt-1 truncate text-xs text-slate-500">{orcamento.cliente_nome || 'Cliente não informado'}</p>
                  </div>
                  <span className={`shrink-0 rounded-full px-2 py-1 text-[10px] font-semibold ${classeStatus(orcamento.status)}`}>{labelStatus(orcamento.status)}</span>
                </div>
                <div className="mt-3 flex items-end justify-between gap-2">
                  <strong className="text-sm text-emerald-300">{formatarMoeda(orcamento.valor_estimado)}</strong>
                  <span className="text-[10px] text-slate-500">{formatarData(orcamento.created_at)}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </article>
    </section>
  )
}
