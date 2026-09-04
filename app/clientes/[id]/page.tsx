'use client'

import { useParams } from 'next/navigation'
import Cliente360Dashboard from '@/components/clientes/Cliente360Dashboard'

export default function DetalheCliente() {
  const params = useParams()
  const id = params?.id as string

  if (!id) return null

  return <Cliente360Dashboard clienteId={id} />
}
