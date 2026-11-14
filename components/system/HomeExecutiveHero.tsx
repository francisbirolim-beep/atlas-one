'use client'

import Link from 'next/link'
import { FilePlus2, Search, ShoppingCart, Users } from 'lucide-react'
import type { HomeModuloId } from '@/lib/homeUsuario'

const MODULOS_PADRAO: HomeModuloId[] = ['orcamentos','clientes','tarefas','calendario']

// Apenas atalhos de navegação: remover um botão da Home nunca remove sua tela ou função.
// Respeita a personalização da Home existente para cada usuário.
export default function HomeExecutiveHero({modulos = MODULOS_PADRAO}:{modulos?:HomeModuloId[]}) {
  const podeOrcamento = modulos.includes('orcamentos')
  const podeCliente = modulos.includes('clientes') || podeOrcamento
  const podeVenda = podeCliente
  const botao = 'group flex min-h-12 items-center gap-2.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-left shadow-sm transition hover:border-blue-300 hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-500'
  const icone = 'grid h-8 w-8 shrink-0 place-items-center rounded-lg'
  const titulo = 'truncate text-xs font-bold text-slate-900 sm:text-[13px]'

  return (
    <section className="mx-auto w-full max-w-[1500px] px-3 pt-3 sm:px-4 md:px-8" aria-label="Acessos rápidos">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {podeOrcamento && <Link href="/orcamento-rapido" className={botao}>
          <span className={icone+' bg-blue-100 text-blue-700'}><FilePlus2 size={19}/></span>
          <span className={titulo}>Novo Orçamento</span>
        </Link>}
        {podeVenda && <Link href="/balcao/consulta-preco" className={botao}>
          <span className={icone+' bg-amber-100 text-amber-700'}><Search size={19}/></span>
          <span className={titulo}>Consulta de Preço</span>
        </Link>}
        {podeVenda && <Link href="/balcao" className={botao}>
          <span className={icone+' bg-emerald-100 text-emerald-700'}><ShoppingCart size={19}/></span>
          <span className={titulo}>Venda</span>
        </Link>}
        {podeCliente && <Link href="/clientes/identificar" className={botao}>
          <span className={icone+' bg-violet-100 text-violet-700'}><Users size={19}/></span>
          <span className={titulo}>Cliente 360</span>
        </Link>}
      </div>
    </section>
  )
}
