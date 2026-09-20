'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function AbrirMedidaFinalCliente() {
  const params = useParams()
  const router = useRouter()
  const clienteId = params?.clienteId as string
  const [mensagem, setMensagem] = useState('Abrindo Medida Final...')

  useEffect(() => {
    if (!clienteId) return
    const chave = `atlas-medicao-cliente-${clienteId}`

    async function abrir() {
      if (navigator.onLine) {
        const { data } = await supabase
          .from('medicoes_finais')
          .select('id')
          .eq('cliente_id', clienteId)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle()

        if (data?.id) {
          localStorage.setItem(chave, data.id)
          router.replace(`/producao/medicao-final/${data.id}`)
          return
        }
        router.replace(`/clientes/${clienteId}?aba=medicoes&novaMedida=1`)
        return
      }

      const medicaoId = localStorage.getItem(chave)
      if (medicaoId) {
        router.replace(`/producao/medicao-final/${medicaoId}`)
        return
      }
      setMensagem('Abra a Medida Final deste cliente uma vez com internet para disponibilizá-la offline neste aparelho.')
    }

    abrir()
  }, [clienteId, router])

  return <div className="min-h-[100dvh] bg-slate-50 p-6 text-center text-slate-600"><p className="mt-24 font-semibold">{mensagem}</p></div>
}
