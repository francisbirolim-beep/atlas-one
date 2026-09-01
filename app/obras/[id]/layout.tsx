'use client'

import Link from 'next/link'
import { useParams, usePathname } from 'next/navigation'
import { Boxes, Building2, Factory } from 'lucide-react'

export default function ObraLayout({ children }: { children: React.ReactNode }) {
  const params = useParams()
  const pathname = usePathname()
  const obraId = String(params?.id || '')
  const links = [
    { href: `/obras/${obraId}`, label: 'Visão da Obra', icon: Building2, ativo: pathname === `/obras/${obraId}` },
    { href: `/obras/${obraId}/materiais`, label: 'Materiais / Estoque', icon: Boxes, ativo: pathname.startsWith(`/obras/${obraId}/materiais`) },
    { href: `/producao?obra=${obraId}`, label: 'Produção', icon: Factory, ativo: false },
  ]

  return <div>
    <nav className="border-b border-slate-200 bg-white px-4 py-2 md:px-8">
      <div className="mx-auto flex max-w-7xl gap-2 overflow-x-auto">
        {links.map(item => { const Icon = item.icon; return <Link key={item.href} href={item.href} className={`inline-flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold ${item.ativo ? 'bg-amber-50 text-amber-800' : 'text-slate-600 hover:bg-slate-50'}`}><Icon size={15}/>{item.label}</Link> })}
      </div>
    </nav>
    {children}
  </div>
}
