import Link from 'next/link'
import { FileSpreadsheet, Ruler, Factory } from 'lucide-react'

export default function ProducaoEtapasBar() {
  return (
    <section className="mx-auto w-full max-w-6xl px-4 pt-5">
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-3 flex items-center gap-2">
          <Factory size={17} className="text-slate-400" />
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[.14em] text-slate-400">Fluxo da produção</p>
            <h2 className="text-sm font-bold text-slate-900">Etapas técnicas</h2>
          </div>
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          <Link href="/producao/medicao-final" className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 transition hover:border-slate-300 hover:bg-white">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-white text-brand-navy shadow-sm"><Ruler size={19}/></span>
            <div><p className="text-sm font-semibold text-slate-800">Medição Final</p><p className="text-xs text-slate-500">Medidas finais, checklist e fotos da obra</p></div>
          </Link>
          <Link href="/producao/plano-corte" className="flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50/50 px-4 py-3 transition hover:border-emerald-300 hover:bg-white">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-white text-emerald-700 shadow-sm"><FileSpreadsheet size={19}/></span>
            <div><p className="text-sm font-semibold text-slate-800">Plano de Corte</p><p className="text-xs text-slate-500">Produto, receita, variáveis, perfis e acessórios</p></div>
          </Link>
        </div>
      </div>
    </section>
  )
}
