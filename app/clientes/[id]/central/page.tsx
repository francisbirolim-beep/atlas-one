'use client'

import Link from 'next/link'
import { useParams, useSearchParams } from 'next/navigation'
import Cliente360Dashboard from '@/components/clientes/Cliente360Dashboard'
import Cliente360Andamento from '@/components/clientes/Cliente360Andamento'

export default function CentralClientePage() {
  const params = useParams()
  const searchParams = useSearchParams()
  const id = params?.id as string
  const aba = searchParams?.get('aba') || 'central'
  if (!id) return null

  return <div className="min-h-screen bg-slate-50">
    <nav className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-7xl items-center gap-1 overflow-x-auto px-4 py-2">
        <Link href={`/clientes/${id}/central`} className={`whitespace-nowrap rounded-xl px-4 py-2 text-sm font-semibold ${aba !== 'andamento' ? 'bg-brand-navy text-white' : 'text-slate-600 hover:bg-slate-100'}`}>Central 360</Link>
        <Link href={`/clientes/${id}/central?aba=andamento`} className={`whitespace-nowrap rounded-xl px-4 py-2 text-sm font-semibold ${aba === 'andamento' ? 'bg-brand-navy text-white' : 'text-slate-600 hover:bg-slate-100'}`}>Andamento</Link>
      </div>
    </nav>
    {aba === 'andamento' ? <Cliente360Andamento clienteId={id} /> : <Cliente360Dashboard clienteId={id} />}
  </div>
}
