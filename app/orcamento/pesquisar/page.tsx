'use client'

import Link from 'next/link'
import { ArrowLeft, Search } from 'lucide-react'

// Busca de orcamentos por nome do cliente, data, numero do orcamento e
// cidade. A funcionalidade completa entra numa proxima etapa; por enquanto
// esta tela so existe pra o link "Pesquisar orcamento" ja funcionar.
export default function PesquisarOrcamento() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-brand-navyLight">
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center gap-4">
          <Link href="/orcamento" className="p-2 hover:bg-slate-100 rounded-lg transition">
            <ArrowLeft size={20} />
          </Link>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/icons/icon-mark.png" alt="" className="w-8 h-8" />
          <div>
            <h1 className="text-lg font-bold text-slate-800">Pesquisar orçamento</h1>
            <p className="text-sm text-slate-500">Por nome do cliente, data, número do orçamento ou cidade</p>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-8">
        <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center">
          <Search size={28} className="mx-auto text-slate-300 mb-3" />
          <p className="text-sm text-slate-500">
            A busca de orçamentos está em construção. Por enquanto, você pode encontrar orçamentos pelo{' '}
            <Link href="/kanban" className="text-brand-navy hover:underline">Painel de Orçamentos</Link>
            {' '}ou pela página do{' '}
            <Link href="/clientes" className="text-brand-navy hover:underline">cliente</Link>.
          </p>
        </div>
      </main>
    </div>
  )
}
