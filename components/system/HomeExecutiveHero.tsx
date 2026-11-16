'use client'

import Link from 'next/link'
import { FilePlus2, FileText, Search, ShoppingCart, Users } from 'lucide-react'
import type { HomeModuloId } from '@/lib/homeUsuario'

// Faixa comercial aprovada: os atalhos de navegação são iguais para todos os usuários.
// A autorização para consultar dados continua sendo verificada pelas APIs de cada tela.
// As telas comerciais aprovadas mantêm o aviso de simulação até o fluxo de gravação ser implementado.
export default function HomeExecutiveHero({ modulos: _modulos }: { modulos?: HomeModuloId[] }) {
  void _modulos
  const botao = 'group flex min-h-12 items-center gap-2.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-left shadow-sm transition hover:border-blue-300 hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-500'
  const icone = 'grid h-8 w-8 shrink-0 place-items-center rounded-lg'
  const titulo = 'truncate text-xs font-bold text-slate-900 sm:text-[13px]'

  return (
    <section className="mx-auto w-full max-w-[1500px] px-3 pt-3 sm:px-4 md:px-8" aria-label="Acessos rápidos">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-5">
        <Link href="/orcamento-rapido" className={botao}>
          <span className={icone+' bg-blue-100 text-blue-700'}><FilePlus2 size={19}/></span>
          <span className={titulo}>Pedido de Orçamento</span>
        </Link>
        <Link href="/previews/consulta-preco" className={botao}>
          <span className={icone+' bg-amber-100 text-amber-700'}><Search size={19}/></span>
          <span className={titulo}>Consulta de Preço</span>
        </Link>
        <Link href="/previews/orcamento" className={botao}>
          <span className={icone+' bg-indigo-100 text-indigo-700'}><FileText size={19}/></span>
          <span className={titulo}>Orçamento</span>
        </Link>
        <Link href="/previews/venda" className={botao}>
          <span className={icone+' bg-emerald-100 text-emerald-700'}><ShoppingCart size={19}/></span>
          <span className={titulo}>Venda</span>
        </Link>
        <Link href="/clientes/identificar" className={botao}>
          <span className={icone+' bg-violet-100 text-violet-700'}><Users size={19}/></span>
          <span className={titulo}>Cliente 360</span>
        </Link>
      </div>
    </section>
  )
}
