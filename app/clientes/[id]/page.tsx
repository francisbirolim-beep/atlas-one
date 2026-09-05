'use client'

import Link from 'next/link'
import { useParams } from 'next/navigation'
import { GitBranch } from 'lucide-react'
import Cliente360Dashboard from '@/components/clientes/Cliente360Dashboard'

export default function DetalheCliente() {
  const params = useParams()
  const id = params?.id as string

  if (!id) return null

  return <>
    <div className="border-b border-blue-100 bg-blue-50/70 px-4 py-2 sm:px-6">
      <div className="mx-auto flex max-w-7xl justify-end">
        <Link href={`/clientes/${id}/orcamentos-revisoes`} className="inline-flex items-center gap-2 rounded-lg border border-blue-200 bg-white px-3 py-1.5 text-xs font-bold text-blue-700 hover:bg-blue-50">
          <GitBranch size={14}/> Versões V1/V2/V3 dos orçamentos
        </Link>
      </div>
    </div>
    <Cliente360Dashboard clienteId={id} />
  </>
}
