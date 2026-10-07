'use client'

import { useParams } from 'next/navigation'
import VendaObraCentral from '@/components/clientes/VendaObraCentral'

export default function VendaClientePage(){
  const params=useParams()
  const clienteId=String(params?.id||'')
  const vendaId=String(params?.vendaId||'')
  return <VendaObraCentral clienteId={clienteId} vendaId={vendaId}/>
}
