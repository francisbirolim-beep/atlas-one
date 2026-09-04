import Link from 'next/link'
import { Building2, FileText, History, PackageSearch, ReceiptText, ShoppingCart, WalletCards } from 'lucide-react'

export default function Fornecedor360Layout({ children, params }: { children: React.ReactNode; params: { id: string } }) {
  const base = `/fornecedores/${params.id}`
  const links = [
    { href: base, label: 'Visão geral', icon: Building2 },
    { href: `${base}/catalogos`, label: 'Catálogos e produtos', icon: PackageSearch },
    { href: `${base}#compras`, label: 'Compras', icon: ShoppingCart },
    { href: `${base}#cotacoes`, label: 'Cotações', icon: ReceiptText },
    { href: `${base}#condicoes`, label: 'Condições comerciais', icon: WalletCards },
    { href: `${base}#historico`, label: 'Histórico', icon: History },
    { href: `${base}/catalogos#documentos`, label: 'Documentos', icon: FileText },
  ]

  return (
    <>
      <div className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl gap-2 overflow-x-auto px-4 py-2 text-xs font-medium">
          {links.map(({ href, label, icon: Icon }) => (
            <Link
              key={`${href}-${label}`}
              href={href}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-2 text-slate-600 transition hover:bg-slate-100 hover:text-brand-navy"
            >
              <Icon size={14} />
              {label}
            </Link>
          ))}
        </div>
      </div>
      {children}
    </>
  )
}
