'use client'

import { useState, useEffect } from 'react'
import { ArrowLeft, TrendingUp, FileText, CheckCircle, XCircle } from 'lucide-react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { formatarMoeda, formatarNumero, formatarPercentual } from '@/lib/formatacao'

export default function Dashboard() {
  const [stats, setStats] = useState({
    total: 0,
    aprovados: 0,
    recusados: 0,
    valorTotal: 0,
    taxaConversao: 0,
  })
  const [carregando, setCarregando] = useState(true)

  useEffect(() => {
    carregar()
  }, [])

  async function carregar() {
    const { data } = await supabase.from('orcamentos').select('valor_estimado, status')

    if (data) {
      const total = data.length
      const aprovados = data.filter(o => o.status === 'aprovado' || o.status === 'convertido').length
      const recusados = data.filter(o => o.status === 'recusado').length
      const valorTotal = data.reduce((s, o) => s + (o.valor_estimado || 0), 0)
      const taxaConversao = total > 0 ? (aprovados / total) * 100 : 0
      setStats({ total, aprovados, recusados, valorTotal, taxaConversao })
    }
    setCarregando(false)
  }

  if (carregando) {
    return <div className="min-h-screen flex items-center justify-center text-slate-400">Carregando...</div>
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-brand-navyLight">
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center gap-4">
          <Link href="/" className="p-2 hover:bg-slate-100 rounded-lg transition">
            <ArrowLeft size={20} />
          </Link>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/icons/icon-mark.png" alt="" className="w-8 h-8" />
          <h1 className="text-lg font-bold text-slate-800">Dashboard</h1>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-8">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-white rounded-2xl border border-slate-200 p-5">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 bg-brand-navyLight rounded-lg"><FileText size={20} className="text-brand-navy" /></div>
              <span className="text-sm text-slate-500">Total</span>
            </div>
            <p className="text-2xl font-bold text-slate-800">{formatarNumero(stats.total)}</p>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 p-5">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 bg-brand-tealLight rounded-lg"><CheckCircle size={20} className="text-brand-teal" /></div>
              <span className="text-sm text-slate-500">Aprovados</span>
            </div>
            <p className="text-2xl font-bold text-brand-teal">{formatarNumero(stats.aprovados)}</p>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 p-5">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 bg-red-100 rounded-lg"><XCircle size={20} className="text-red-600" /></div>
              <span className="text-sm text-slate-500">Recusados</span>
            </div>
            <p className="text-2xl font-bold text-red-500">{formatarNumero(stats.recusados)}</p>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 p-5">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 bg-purple-100 rounded-lg"><TrendingUp size={20} className="text-purple-600" /></div>
              <span className="text-sm text-slate-500">Conversão</span>
            </div>
            <p className="text-2xl font-bold text-purple-600">{formatarPercentual(stats.taxaConversao, 1)}</p>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-6">
          <h2 className="text-lg font-bold text-slate-800 mb-2">Resumo financeiro</h2>
          <div className="flex items-baseline gap-2">
            <p className="text-3xl font-bold text-brand-teal">{formatarMoeda(stats.valorTotal)}</p>
            <span className="text-sm text-slate-400">em orçamentos emitidos</span>
          </div>
        </div>
      </main>
    </div>
  )
}
