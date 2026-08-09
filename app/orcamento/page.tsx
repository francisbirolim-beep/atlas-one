'use client'

import Link from 'next/link'
import { ArrowLeft, Plus, Search } from 'lucide-react'

export default function OrcamentoHub() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-brand-navyLight">
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center gap-4">
          <Link href="/" className="p-2 hover:bg-slate-100 rounded-lg transition">
            <ArrowLeft size={20} />
          </Link>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/icons/icon-mark.png" alt="" className="w-8 h-8" />
          <div>
            <h1 className="text-lg font-bold text-slate-800">Orçamento</h1>
            <p className="text-sm text-slate-500">Criar um orçamento novo ou encontrar um já feito</p>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-8 space-y-3">
        <Link
          href="/orcamento/novo"
          className="w-full flex items-center gap-3 bg-white rounded-2xl border border-slate-200 p-5 hover:border-brand-navy transition"
        >
          <span className="p-2.5 rounded-xl bg-brand-navyLight text-brand-navy flex-shrink-0">
            <Plus size={20} />
          </span>
          <span>
            <span className="block text-sm font-semibold text-slate-800">Novo orçamento</span>
            <span className="block text-xs text-slate-500">Começar um orçamento do zero para um cliente</span>
          </span>
        </Link>

        <Link
          href="/orcamento/pesquisar"
          className="w-full flex items-center gap-3 bg-white rounded-2xl border border-slate-200 p-5 hover:border-brand-navy transition"
        >
          <span className="p-2.5 rounded-xl bg-brand-navyLight text-brand-navy flex-shrink-0">
            <Search size={20} />
          </span>
          <span>
            <span className="block text-sm font-semibold text-slate-800">Pesquisar orçamento</span>
            <span className="block text-xs text-slate-500">Por nome do cliente, data, número do orçamento ou cidade</span>
          </span>
        </Link>
      </main>
    </div>
  )
}
