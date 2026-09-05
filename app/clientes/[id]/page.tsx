'use client'

import { useParams } from 'next/navigation'
import Cliente360DashboardV2 from '@/components/clientes/Cliente360DashboardV2'

export default function DetalheCliente() {
  const params = useParams()
  const id = params?.id as string

  if (!id) return null

  return <Cliente360DashboardV2 clienteId={id} />
}
