'use client'

import Link from 'next/link'
import { redirect, useParams, useSearchParams } from 'next/navigation'
import Cliente360Dashboard from '@/components/clientes/Cliente360Dashboard'
import Cliente360Andamento from '@/components/clientes/Cliente360Andamento'

export default function CentralClientePage() {
  const params = useParams()
  const searchParams = useSearchParams()
  const id = params?.id as string
  const aba = searchParams?.get('aba') || 'central'
  if (!id) return null

  // O cadastro aprovado é a entrada principal do Cliente 360.
  // Endereços legados continuam funcionando:
  // ?aba=central mantém a Central anterior; ?aba=andamento mantém o andamento.
  if (!searchParams?.has('aba')) redirect('/clientes/' + encodeURIComponent(id))

  return <div className="min-h-screen bg-slate-50">
    <nav className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-7xl items-center gap-1 overflow-x-auto px-4 py-2">
        <Link href={`/clientes/${id}`} className="whitespace-nowrap rounded-xl px-4 py-2 text-sm font-semibold text-brand-navy hover:bg-slate-100">Cadastro e obras</Link>
        <Link href={`/clientes/${id}/central?aba=central`} className={`whitespace-nowrap rounded-xl px-4 py-2 text-sm font-semibold ${aba !== 'andamento' ? 'bg-brand-navy text-white' : 'text-slate-600 hover:bg-slate-100'}`}>Central 360</Link>
        <Link href={`/clientes/${id}/central?aba=andamento`} className={`whitespace-nowrap rounded-xl px-4 py-2 text-sm font-semibold ${aba === 'andamento' ? 'bg-brand-navy text-white' : 'text-slate-600 hover:bg-slate-100'}`}>Andamento</Link>
      </div>
    </nav>
    {aba === 'andamento' ? <Cliente360Andamento clienteId={id} /> : <Cliente360Dashboard clienteId={id} />}
  </div>
}
