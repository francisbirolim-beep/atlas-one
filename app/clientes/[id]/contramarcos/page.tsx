'use client'
import {useParams} from 'next/navigation'
import ContramarcoComercialPage from '@/components/medicao-final/ContramarcoComercialPage'
export default function Page(){const p=useParams();const id=String(p.id||'');return <ContramarcoComercialPage clienteId={id} key={id}/>}
