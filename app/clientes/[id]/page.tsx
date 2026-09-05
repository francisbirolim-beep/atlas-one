'use client'

import Link from 'next/link'
import { useParams } from 'next/navigation'
import { WalletCards } from 'lucide-react'
import Cliente360DashboardV2 from '@/components/clientes/Cliente360DashboardV2'

export default function DetalheCliente() {
  const params = useParams()
  const id = params?.id as string

  if (!id) return null

  return <>
    <div className="border-b border-emerald-100 bg-emerald-50/70 px-4 py-2 sm:px-6">
      <div className="mx-auto flex max-w-7xl justify-end">
        <Link href={`/clientes/${id}/financeiro/recebimento`} className="inline-flex items-center gap-2 rounded-lg border border-emerald-200 bg-white px-3 py-1.5 text-xs font-bold text-emerald-700 hover:bg-emerald-50">
          <WalletCards size={14}/> Receber por parcelas
        </Link>
      </div>
    </div>
    <Cliente360DashboardV2 clienteId={id} />
  </>
}
