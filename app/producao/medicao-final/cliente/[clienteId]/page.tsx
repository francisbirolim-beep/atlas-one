'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function AbrirMedidaFinalCliente() {
  const params = useParams()
  const router = useRouter()
  const clienteId = params?.clienteId as string
  const [mensagem, setMensagem] = useState('Abrindo Medida Final...')
  const [tentativa, setTentativa] = useState(0)
  const [erro, setErro] = useState(false)

  useEffect(() => {
    if (!clienteId) return
    const chave = `atlas-medicao-cliente-${clienteId}`
    let cancelado = false
    setErro(false)
    setMensagem('Abrindo Medida Final...')

    async function abrir() {
      if (navigator.onLine) {
        const { data, error } = await supabase
          .from('medicoes_finais')
          .select('id')
          .eq('cliente_id', clienteId)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle()

        if (cancelado) return
        if (error) throw error

        let medicaoId = data?.id || null

        // Importações antigas do WVetro podem ter criado a medição com cliente_id nulo,
        // mantendo o vínculo correto pelo orçamento. Recupera esse vínculo sem regravar dados.
        if (!medicaoId) {
          const { data: orcamentos, error: erroOrcamentos } = await supabase
            .from('orcamentos')
            .select('id')
            .eq('cliente_id', clienteId)

          if (erroOrcamentos) throw erroOrcamentos

          const orcamentoIds = (orcamentos || []).map(item => item.id).filter(Boolean)
          if (orcamentoIds.length > 0) {
            const { data: medicaoPorOrcamento, error: erroMedicaoPorOrcamento } = await supabase
              .from('medicoes_finais')
              .select('id')
              .in('orcamento_id', orcamentoIds)
              .order('created_at', { ascending: false })
              .limit(1)
              .maybeSingle()

            if (erroMedicaoPorOrcamento) throw erroMedicaoPorOrcamento
            medicaoId = medicaoPorOrcamento?.id || null
          }
        }

        if (medicaoId) {
          // Cache is optional: unavailable storage must not prevent navigation.
          try { localStorage.setItem(chave, medicaoId) } catch {}
          router.replace(`/producao/medicao-final/${medicaoId}`)
          return
        }

        setMensagem('Nenhuma Medição Final disponível para este cliente. Confira as medições no cadastro do cliente e seu acesso.')
        return
      }

      const medicaoId = localStorage.getItem(chave)
      if (cancelado) return
      if (medicaoId) {
        router.replace(`/producao/medicao-final/${medicaoId}`)
        return
      }
      setMensagem('Abra a Medida Final deste cliente uma vez com internet para disponibilizá-la offline neste aparelho.')
    }

    void abrir().catch(() => {
      if (cancelado) return
      setErro(true)
      setMensagem('Não foi possível carregar a Medição Final. Confira sua conexão e seu acesso e tente novamente. Os dados salvos foram preservados.')
    })
    return () => { cancelado = true }
  }, [clienteId, router, tentativa])

  return <div className="min-h-[100dvh] bg-slate-50 p-6 text-center text-slate-600">
    <p className="mt-24 font-semibold" role={erro ? 'alert' : 'status'}>{mensagem}</p>
    {erro && <button className="mt-4 rounded-lg bg-blue-700 px-4 py-2 text-white" onClick={() => setTentativa(v => v + 1)}>Tentar novamente</button>}
  </div>
}
