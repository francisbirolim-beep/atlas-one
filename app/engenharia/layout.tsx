import Link from 'next/link'
import { Calculator, LayoutDashboard, PackageOpen, Settings2, Wrench } from 'lucide-react'

export default function EngenhariaLayout({ children }: { children: React.ReactNode }) {
  return (
    <div>
      <nav className="border-b border-slate-200 bg-white px-4 py-3 md:px-8">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-2">
          <span className="mr-2 text-xs font-bold uppercase tracking-[0.18em] text-slate-400">Engenharia</span>
          <Link href="/engenharia" className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-800">
            <LayoutDashboard size={16} /> Painel da Engenharia
          </Link>
          <Link href="/engenharia/editor-tecnico" className="inline-flex items-center gap-2 rounded-lg border border-violet-200 bg-violet-50 px-3 py-2 text-sm font-semibold text-violet-800 hover:bg-violet-100">
            <Wrench size={16} /> Editor Técnico
          </Link>
          <Link href="/engenharia/editor-acessorios" className="inline-flex items-center gap-2 rounded-lg border border-orange-200 bg-orange-50 px-3 py-2 text-sm font-semibold text-orange-800 hover:bg-orange-100">
            <PackageOpen size={16} /> Acessórios
          </Link>
          <Link href="/engenharia/formulas-corte" className="inline-flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-800 hover:bg-emerald-100">
            <Calculator size={16} /> Fórmulas de Corte
          </Link>
          <Link href="/engenharia/configuracoes-orcamento" className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-800">
            <Settings2 size={16} /> Configurações de orçamento
          </Link>
        </div>
      </nav>
      {children}
    </div>
  )
}
