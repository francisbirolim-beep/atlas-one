'use client'

import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import ReciboImpressao from '@/components/financeiro/ReciboImpressao'
import type { ReciboInfo } from '@/lib/financeiroRecibos'
import { tokenAtual } from '@/lib/auth'

export default function ReciboConsolidadoPage() {
  const busca = useSearchParams()
  const ids = busca.get('ids') || ''
  const clienteId = busca.get('clienteId') || ''
  const acao = busca.get('acao') === 'pdf' ? 'pdf' : busca.get('acao') === 'imprimir' ? 'imprimir' : null
  const [dados,setDados] = useState<ReciboInfo | null>(null)
  const [carregando,setCarregando] = useState(true)
  const [erro,setErro] = useState('')

  useEffect(() => {
    let ativo = true
    async function carregar() {
      setCarregando(true)
      setErro('')
      try {
        const token = await tokenAtual()
        if (!token) throw new Error('Sessão expirada. Faça login novamente.')
        const resposta = await fetch(`/api/financeiro/recibo?tipo=receber&ids=${encodeURIComponent(ids)}&clienteId=${encodeURIComponent(clienteId)}`, {
          headers: {Authorization: `Bearer ${token}`}, cache: 'no-store',
        })
        const json = await resposta.json()
        if (!resposta.ok) throw new Error(json.error || 'Não foi possível gerar o recibo.')
        if (ativo) setDados(json.recibo)
      } catch (e) {
        if (ativo) setErro(e instanceof Error ? e.message : 'Não foi possível gerar o recibo.')
      } finally { if (ativo) setCarregando(false) }
    }
    void carregar()
    return () => { ativo = false }
  },[ids,clienteId])

  return <main className="min-h-screen bg-slate-100 p-4 sm:p-8 print:bg-white print:p-0">
    <div className="no-print mx-auto mb-4 max-w-[820px]"><Link href={clienteId?`/clientes/${clienteId}`:'/financeiro/contas-receber'} className="text-sm font-semibold text-blue-700 underline">← Voltar ao cliente</Link></div>
    {carregando ? <p className="text-center text-sm text-slate-600">Conferindo os recebimentos selecionados...</p>
      : erro ? <p role="alert" className="mx-auto max-w-[820px] rounded-xl bg-red-50 p-4 text-sm text-red-700">{erro}</p>
      : dados ? <ReciboImpressao dados={dados} acaoInicial={acao}/> : <p className="text-center">Recibo indisponível.</p>}
  </main>
}
