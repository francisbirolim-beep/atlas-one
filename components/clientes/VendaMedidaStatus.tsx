'use client'

import { useCallback, useEffect, useState } from 'react'
import { Ruler } from 'lucide-react'
import { supabase } from '@/lib/supabase'

const LABEL: Record<string, string> = {
  aguardando_liberacao: 'Aguardando liberação',
  liberado: 'Liberada para medir',
  em_medicao: 'Em medição',
  com_pendencia: 'Com pendência',
  concluido: 'Concluída · aguardando conferência',
  aprovado: 'Aprovada',
}

export default function VendaMedidaStatus({ clienteId, obraId, orcamentoId, onAbrir }: {
  clienteId: string
  obraId: string | null
  orcamentoId: string
  onAbrir: () => void
}) {
  const [status, setStatus] = useState('Consultando...')
  const [erro, setErro] = useState(false)

  const carregar = useCallback(async () => {
    const escopo = obraId
      ? `obra_id.eq.${obraId},orcamento_id.eq.${orcamentoId}`
      : `orcamento_id.eq.${orcamentoId}`
    const { data, error } = await supabase.from('medicoes_finais')
      .select('id,orcamento_id,status_operacional,created_at')
      .eq('cliente_id', clienteId).or(escopo)
      .order('created_at', { ascending: false })
    if (error) { setErro(true); setStatus('Consultar medida final'); return }
    const principal = (data || []).find(m => m.orcamento_id === orcamentoId) || data?.[0]
    setErro(false)
    setStatus(principal ? LABEL[principal.status_operacional || ''] || 'Iniciada' : 'Não iniciada')
  }, [clienteId, obraId, orcamentoId])

  useEffect(() => {
    void carregar()
    window.addEventListener('focus', carregar)
    window.addEventListener('atlas-medicao-atualizada', carregar)
    return () => {
      window.removeEventListener('focus', carregar)
      window.removeEventListener('atlas-medicao-atualizada', carregar)
    }
  }, [carregar])

  return (
    <button type="button" onClick={onAbrir} title="Consultar a Medida Final desta obra"
      className="mt-2 inline-flex min-h-9 items-center gap-2 rounded-full border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-bold text-blue-800 hover:bg-blue-100">
      <Ruler size={15} aria-hidden="true" />
      Medida Final: {status}
      <span className="sr-only">{erro ? 'Não foi possível atualizar agora' : 'Abrir detalhes'}</span>
    </button>
  )
}
