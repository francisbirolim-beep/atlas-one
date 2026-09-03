import Link from 'next/link'

export default function Fornecedor360Layout({ children, params }: { children: React.ReactNode; params: { id: string } }) {
  const base = `/fornecedores/${params.id}`
  return (
    <>
      <div className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-3xl gap-2 px-4 py-2 text-xs font-medium">
          <Link href={base} className="rounded-lg px-3 py-2 text-slate-600 hover:bg-slate-100">Fornecedor 360</Link>
          <Link href={`${base}/catalogos`} className="rounded-lg px-3 py-2 text-brand-navy hover:bg-slate-100">Catálogos e produtos</Link>
        </div>
      </div>
      {children}
    </>
  )
}
